import type { FlexibleJob, ScheduleDecision } from "./scheduler";

export type ScheduleEvent = {
  schema: "powerpilot.schedule.v1";
  id: string;
  jobId: string;
  decision: ScheduleDecision["status"];
  priority: FlexibleJob["priority"];
  startsAt?: string;
  endsAt?: string;
  estimatedEnergyKwh?: number;
  estimatedSpotCostNok?: number;
};

export function createScheduleEvent(
  job: FlexibleJob,
  decision: ScheduleDecision,
): ScheduleEvent {
  if (decision.status === "unschedulable") {
    return {
      schema: "powerpilot.schedule.v1",
      id: `${job.id}:unschedulable:${decision.reason}`,
      jobId: job.id,
      decision: decision.status,
      priority: job.priority,
    };
  }

  return {
    schema: "powerpilot.schedule.v1",
    id: `${job.id}:${decision.status}:${decision.startsAt}`,
    jobId: job.id,
    decision: decision.status,
    priority: job.priority,
    startsAt: decision.startsAt,
    endsAt: decision.endsAt,
    ...(decision.estimatedEnergyKwh === undefined ? {} : {
      estimatedEnergyKwh: decision.estimatedEnergyKwh,
      estimatedSpotCostNok: decision.estimatedSpotCostNok,
    }),
  };
}
