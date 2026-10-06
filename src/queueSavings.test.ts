import { describe, expect, it } from "vitest";
import type { HourlyPrice } from "./domain";
import { compareQueueToImmediate } from "./queueSavings";
import type { FlexibleJob, ScheduleDecision } from "./scheduler";

const prices: HourlyPrice[] = [100, 80, 20, 10].map((orePerKwh, hour) => ({
  area: "NO2",
  startsAt: `2026-10-07T0${hour}:00:00.000Z`,
  orePerKwh,
}));

const job: FlexibleJob = {
  id: "render",
  durationMinutes: 120,
  earliestStart: "2026-10-07T00:00:00.000Z",
  deadline: "2026-10-07T04:00:00.000Z",
  priority: "low",
  estimatedPowerWatts: 1000,
};

const decision: ScheduleDecision = {
  status: "scheduled",
  jobId: "render",
  startsAt: "2026-10-07T02:00:00.000Z",
  endsAt: "2026-10-07T04:00:00.000Z",
  averageOrePerKwh: 15,
  prices: prices.slice(2),
  estimatedEnergyKwh: 2,
  estimatedSpotCostNok: 0.3,
};

describe("queue savings", () => {
  it("compares scheduled cost to earliest possible execution", () => {
    const result = compareQueueToImmediate([job], { decisions: [decision] }, prices);
    expect(result.scheduledSpotCostNok).toBeCloseTo(0.3);
    expect(result.immediateSpotCostNok).toBeCloseTo(1.8);
    expect(result.savingsNok).toBeCloseTo(1.5);
    expect(result.savingsPercent).toBeCloseTo(83.333333);
    expect(result.comparableJobs).toBe(1);
    expect(result.excludedJobs).toBe(0);
  });

  it("excludes jobs without enough information instead of inventing savings", () => {
    const unknown = { ...job, id: "unknown", estimatedPowerWatts: undefined };
    const result = compareQueueToImmediate(
      [unknown],
      { decisions: [{ ...decision, jobId: "unknown", estimatedEnergyKwh: undefined, estimatedSpotCostNok: undefined }] },
      prices,
    );
    expect(result).toEqual({ comparableJobs: 0, excludedJobs: 1 });
  });

  it("does not claim a percentage when immediate cost is zero", () => {
    const freePrices = prices.map((price, index) => index < 2 ? { ...price, orePerKwh: 0 } : price);
    const freeDecision = { ...decision, estimatedSpotCostNok: 0 };
    const result = compareQueueToImmediate([job], { decisions: [freeDecision] }, freePrices);
    expect(result.savingsPercent).toBeUndefined();
  });
});
