import { describe, expect, it } from "vitest";
import { createScheduleEvent } from "./scheduleEvent";
import type { FlexibleJob, ScheduleDecision } from "./scheduler";

const job: FlexibleJob = {
  id: "render-42",
  durationMinutes: 120,
  earliestStart: "2026-10-07T00:00:00.000Z",
  deadline: "2026-10-07T06:00:00.000Z",
  priority: "low",
  estimatedPowerWatts: 500,
};

describe("schedule event", () => {
  it("creates a stable versioned event for a scheduled job", () => {
    const decision: ScheduleDecision = {
      status: "scheduled",
      jobId: job.id,
      startsAt: "2026-10-07T02:00:00.000Z",
      endsAt: "2026-10-07T04:00:00.000Z",
      averageOrePerKwh: 15,
      prices: [],
      estimatedEnergyKwh: 1,
      estimatedSpotCostNok: 0.15,
    };
    expect(createScheduleEvent(job, decision)).toEqual({
      schema: "powerpilot.schedule.v1",
      id: "render-42:scheduled:2026-10-07T02:00:00.000Z",
      jobId: "render-42",
      decision: "scheduled",
      priority: "low",
      startsAt: "2026-10-07T02:00:00.000Z",
      endsAt: "2026-10-07T04:00:00.000Z",
      estimatedEnergyKwh: 1,
      estimatedSpotCostNok: 0.15,
    });
  });

  it("identifies unschedulable decisions deterministically", () => {
    expect(createScheduleEvent(job, {
      status: "unschedulable",
      jobId: job.id,
      reason: "insufficient-price-coverage",
    })).toEqual({
      schema: "powerpilot.schedule.v1",
      id: "render-42:unschedulable:insufficient-price-coverage",
      jobId: "render-42",
      decision: "unschedulable",
      priority: "low",
    });
  });
});
