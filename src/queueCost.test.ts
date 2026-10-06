import { describe, expect, it } from "vitest";
import { summarizeQueueCost } from "./queueCost";
import type { FlexibleJob, ScheduleDecision } from "./scheduler";

const jobs: FlexibleJob[] = [
  {
    id: "render",
    durationMinutes: 120,
    earliestStart: "2026-10-07T00:00:00.000Z",
    deadline: "2026-10-07T06:00:00.000Z",
    priority: "normal",
    pool: "render",
    estimatedPowerWatts: 1000,
  },
  {
    id: "ci",
    durationMinutes: 60,
    earliestStart: "2026-10-07T00:00:00.000Z",
    deadline: "2026-10-07T06:00:00.000Z",
    priority: "normal",
    pool: "ci",
  },
  {
    id: "missed",
    durationMinutes: 60,
    earliestStart: "2026-10-07T00:00:00.000Z",
    deadline: "2026-10-07T01:00:00.000Z",
    priority: "low",
  },
];

const decisions: ScheduleDecision[] = [
  {
    status: "scheduled",
    jobId: "render",
    startsAt: "2026-10-07T02:00:00.000Z",
    endsAt: "2026-10-07T04:00:00.000Z",
    averageOrePerKwh: 20,
    prices: [],
    estimatedEnergyKwh: 2,
    estimatedSpotCostNok: 0.4,
  },
  {
    status: "scheduled",
    jobId: "ci",
    startsAt: "2026-10-07T02:00:00.000Z",
    endsAt: "2026-10-07T03:00:00.000Z",
    averageOrePerKwh: 20,
    prices: [],
  },
  {
    status: "unschedulable",
    jobId: "missed",
    reason: "insufficient-price-coverage",
  },
];

describe("queue cost summary", () => {
  it("summarizes known costs, unknown costs and pools", () => {
    const result = summarizeQueueCost(jobs, { decisions });
    expect(result).toMatchObject({
      scheduledJobs: 2,
      unschedulableJobs: 1,
      estimatedEnergyKwh: 2,
      estimatedSpotCostNok: 0.4,
      unknownCostJobs: 1,
    });
    expect(result.pools.render).toMatchObject({
      scheduledJobs: 1,
      estimatedEnergyKwh: 2,
      estimatedSpotCostNok: 0.4,
      unknownCostJobs: 0,
    });
    expect(result.pools.ci.unknownCostJobs).toBe(1);
  });
});
