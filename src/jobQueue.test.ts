import { describe, expect, it } from "vitest";
import type { HourlyPrice } from "./domain";
import { planJobQueue } from "./jobQueue";
import type { FlexibleJob } from "./scheduler";

const prices: HourlyPrice[] = [80, 10, 20, 90].map((orePerKwh, hour) => ({
  area: "NO2",
  startsAt: `2026-10-07T0${hour}:00:00.000Z`,
  orePerKwh,
}));

const makeJob = (id: string, priority: FlexibleJob["priority"]): FlexibleJob => ({
  id,
  durationMinutes: 60,
  earliestStart: "2026-10-07T00:00:00.000Z",
  deadline: "2026-10-07T04:00:00.000Z",
  priority,
});

describe("job queue planner", () => {
  it("gives the cheapest slot to the higher-priority job at capacity one", () => {
    const plan = planJobQueue(
      [makeJob("low", "low"), makeJob("high", "high")],
      prices,
      1,
      new Date("2026-10-07T00:00:00.000Z"),
    );
    expect(plan.decisions.map(d => d.jobId)).toEqual(["high", "low"]);
    expect(plan.decisions[0].status === "scheduled" && plan.decisions[0].startsAt)
      .toBe("2026-10-07T01:00:00.000Z");
    expect(plan.decisions[1].status === "scheduled" && plan.decisions[1].startsAt)
      .toBe("2026-10-07T02:00:00.000Z");
  });

  it("allows jobs to share a slot when capacity permits", () => {
    const plan = planJobQueue(
      [makeJob("a", "low"), makeJob("b", "low")],
      prices,
      2,
      new Date("2026-10-07T00:00:00.000Z"),
    );
    expect(plan.decisions.every(d => d.status === "scheduled")).toBe(true);
    expect(plan.decisions.map(d => d.status === "scheduled" ? d.startsAt : null))
      .toEqual(["2026-10-07T01:00:00.000Z", "2026-10-07T01:00:00.000Z"]);
  });

  it("uses earlier deadline before job id at equal priority", () => {
    const later = { ...makeJob("a", "normal"), deadline: "2026-10-07T04:00:00.000Z" };
    const earlier = { ...makeJob("z", "normal"), deadline: "2026-10-07T03:00:00.000Z" };
    const plan = planJobQueue([later, earlier], prices, 1, new Date("2026-10-07T00:00:00.000Z"));
    expect(plan.decisions[0].jobId).toBe("z");
  });

  it("respects a shared power budget", () => {
    const render = { ...makeJob("render", "high"), estimatedPowerWatts: 1500 };
    const compile = { ...makeJob("compile", "normal"), estimatedPowerWatts: 800 };
    const extra = { ...makeJob("extra", "low"), estimatedPowerWatts: 500 };
    const plan = planJobQueue(
      [extra, compile, render],
      prices,
      3,
      new Date("2026-10-07T00:00:00.000Z"),
      2500,
    );
    const starts = Object.fromEntries(plan.decisions.map(d => [
      d.jobId,
      d.status === "scheduled" ? d.startsAt : d.status,
    ]));
    expect(starts.render).toBe("2026-10-07T01:00:00.000Z");
    expect(starts.compile).toBe("2026-10-07T01:00:00.000Z");
    expect(starts.extra).toBe("2026-10-07T02:00:00.000Z");
  });

  it("requires known job power when a power budget is enforced", () => {
    const plan = planJobQueue(
      [makeJob("unknown", "low")],
      prices,
      2,
      new Date("2026-10-07T00:00:00.000Z"),
      2500,
    );
    expect(plan.decisions[0]).toMatchObject({
      jobId: "unknown",
      status: "unschedulable",
    });
  });

  it("rejects an invalid power budget", () => {
    expect(() => planJobQueue([], prices, 1, new Date(), 0)).toThrow("maxPowerWatts");
  });

  it("enforces independent resource pool capacities", () => {
    const renderA = { ...makeJob("render-a", "normal"), pool: "render", estimatedPowerWatts: 1200 };
    const renderB = { ...makeJob("render-b", "normal"), pool: "render", estimatedPowerWatts: 1200 };
    const ci = { ...makeJob("ci", "normal"), pool: "ci", estimatedPowerWatts: 400 };
    const plan = planJobQueue(
      [renderA, renderB, ci],
      prices,
      4,
      new Date("2026-10-07T00:00:00.000Z"),
      4000,
      {
        render: { maxConcurrentJobs: 1, maxPowerWatts: 2500 },
        ci: { maxConcurrentJobs: 3, maxPowerWatts: 600 },
      },
    );
    const starts = Object.fromEntries(plan.decisions.map(d => [
      d.jobId,
      d.status === "scheduled" ? d.startsAt : d.status,
    ]));
    expect(starts["render-a"]).toBe("2026-10-07T01:00:00.000Z");
    expect(starts["render-b"]).toBe("2026-10-07T02:00:00.000Z");
    expect(starts.ci).toBe("2026-10-07T01:00:00.000Z");
  });

  it("rejects invalid queue capacity", () => {
    expect(() => planJobQueue([], prices, 0)).toThrow("maxConcurrentJobs");
  });
});
