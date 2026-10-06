import { describe, expect, it } from "vitest";
import type { HourlyPrice } from "./domain";
import { scheduleJob, type FlexibleJob } from "./scheduler";

const prices = (values: number[]): HourlyPrice[] =>
  values.map((orePerKwh, hour) => ({
    area: "NO2",
    startsAt: `2026-10-07T${String(hour).padStart(2, "0")}:00:00.000Z`,
    orePerKwh,
  }));

const job = (overrides: Partial<FlexibleJob> = {}): FlexibleJob => ({
  id: "render-1",
  durationMinutes: 120,
  earliestStart: "2026-10-07T00:00:00.000Z",
  deadline: "2026-10-07T06:00:00.000Z",
  priority: "normal",
  ...overrides,
});

describe("smart scheduler", () => {
  it("selects the cheapest contiguous window within constraints", () => {
    const result = scheduleJob(job(), prices([80, 70, 20, 10, 60, 90]));
    expect(result.status).toBe("scheduled");
    if (result.status === "scheduled") {
      expect(result.startsAt).toBe("2026-10-07T02:00:00.000Z");
      expect(result.endsAt).toBe("2026-10-07T04:00:00.000Z");
      expect(result.averageOrePerKwh).toBe(15);
    }
  });

  it("uses the earliest window when equal-price windows tie", () => {
    const result = scheduleJob(job({ durationMinutes: 60 }), prices([50, 10, 10, 80]));
    expect(result.status === "scheduled" && result.startsAt)
      .toBe("2026-10-07T01:00:00.000Z");
  });

  it("allows a job to end exactly at its deadline", () => {
    const result = scheduleJob(job({
      durationMinutes: 120,
      earliestStart: "2026-10-07T02:00:00.000Z",
      deadline: "2026-10-07T04:00:00.000Z",
    }), prices([90, 90, 20, 10]));
    expect(result.status).toBe("scheduled");
  });

  it("rejects a missing interval instead of guessing through the gap", () => {
    const input = prices([10, 20]);
    input[1] = { ...input[1], startsAt: "2026-10-07T02:00:00.000Z" };
    expect(scheduleJob(job({ deadline: "2026-10-07T03:00:00.000Z" }), input)).toMatchObject({
      status: "unschedulable",
      reason: "no-contiguous-window",
    });
  });

  it("reports insufficient coverage when no candidate can fit", () => {
    expect(scheduleJob(job({ durationMinutes: 180 }), prices([10, 20]))).toMatchObject({
      status: "unschedulable",
      reason: "insufficient-price-coverage",
    });
  });

  it("returns run-now when the job has reached its last feasible start", () => {
    const result = scheduleJob(
      job({
        durationMinutes: 120,
        earliestStart: "2026-10-07T02:00:00.000Z",
        deadline: "2026-10-07T06:00:00.000Z",
      }),
      prices([90, 90, 40, 30, 20, 10]),
      new Date("2026-10-07T04:00:00.000Z"),
    );
    expect(result.status).toBe("run-now");
    if (result.status === "run-now") {
      expect(result.startsAt).toBe("2026-10-07T04:00:00.000Z");
      expect(result.endsAt).toBe("2026-10-07T06:00:00.000Z");
    }
  });

  it("keeps a cheaper future window scheduled before the last feasible start", () => {
    const result = scheduleJob(
      job(),
      prices([80, 70, 50, 40, 20, 10]),
      new Date("2026-10-07T01:00:00.000Z"),
    );
    expect(result.status).toBe("scheduled");
  });

  it("rejects sub-hour jobs until interval-aware scheduling lands", () => {
    expect(scheduleJob(job({ durationMinutes: 90 }), prices([10, 20, 30]))).toMatchObject({
      status: "unschedulable",
      reason: "invalid-job",
    });
  });
});
