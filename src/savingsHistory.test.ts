import { describe, expect, it } from "vitest";
import { aggregateSavings, type SavingsRecord } from "./savingsHistory";

const records: SavingsRecord[] = [
  {
    recordedAt: "2026-10-01T12:00:00.000Z",
    scheduledSpotCostNok: 4,
    immediateSpotCostNok: 10,
    savingsNok: 6,
    energyKwh: 8,
    comparableJobs: 2,
  },
  {
    recordedAt: "2026-10-05T12:00:00.000Z",
    scheduledSpotCostNok: 6,
    immediateSpotCostNok: 10,
    savingsNok: 4,
    energyKwh: 12,
    comparableJobs: 3,
  },
  {
    recordedAt: "2026-09-30T23:00:00.000Z",
    scheduledSpotCostNok: 1,
    immediateSpotCostNok: 2,
    savingsNok: 1,
    energyKwh: 1,
    comparableJobs: 1,
  },
];

describe("savings history", () => {
  it("aggregates a half-open reporting period", () => {
    const result = aggregateSavings(
      records,
      "2026-10-01T00:00:00.000Z",
      "2026-11-01T00:00:00.000Z",
    );
    expect(result).toMatchObject({
      records: 2,
      comparableJobs: 5,
      energyKwh: 20,
      scheduledSpotCostNok: 10,
      immediateSpotCostNok: 20,
      savingsNok: 10,
      savingsPercent: 50,
    });
  });

  it("uses an exclusive end boundary", () => {
    const result = aggregateSavings(
      records,
      "2026-10-01T00:00:00.000Z",
      "2026-10-05T12:00:00.000Z",
    );
    expect(result.records).toBe(1);
    expect(result.savingsNok).toBe(6);
  });

  it("omits percentage when baseline cost is zero", () => {
    const result = aggregateSavings([{
      recordedAt: "2026-10-01T00:00:00.000Z",
      scheduledSpotCostNok: 0,
      immediateSpotCostNok: 0,
      savingsNok: 0,
      energyKwh: 1,
      comparableJobs: 1,
    }]);
    expect(result.savingsPercent).toBeUndefined();
  });
});
