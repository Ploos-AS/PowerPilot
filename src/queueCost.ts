import type { FlexibleJob, ScheduleDecision } from "./scheduler";
import type { QueuePlan } from "./jobQueue";

export type QueueCostSummary = {
  scheduledJobs: number;
  unschedulableJobs: number;
  estimatedEnergyKwh: number;
  estimatedSpotCostNok: number;
  unknownCostJobs: number;
  pools: Record<string, {
    scheduledJobs: number;
    estimatedEnergyKwh: number;
    estimatedSpotCostNok: number;
    unknownCostJobs: number;
  }>;
};

export function summarizeQueueCost(
  jobs: FlexibleJob[],
  plan: QueuePlan,
): QueueCostSummary {
  const jobsById = new Map(jobs.map(job => [job.id, job]));
  const summary: QueueCostSummary = {
    scheduledJobs: 0,
    unschedulableJobs: 0,
    estimatedEnergyKwh: 0,
    estimatedSpotCostNok: 0,
    unknownCostJobs: 0,
    pools: {},
  };

  for (const decision of plan.decisions) {
    if (decision.status === "unschedulable") {
      summary.unschedulableJobs++;
      continue;
    }

    summary.scheduledJobs++;
    const job = jobsById.get(decision.jobId);
    const poolName = job?.pool ?? "default";
    const pool = summary.pools[poolName] ??= {
      scheduledJobs: 0,
      estimatedEnergyKwh: 0,
      estimatedSpotCostNok: 0,
      unknownCostJobs: 0,
    };
    pool.scheduledJobs++;

    if (
      decision.estimatedEnergyKwh === undefined ||
      decision.estimatedSpotCostNok === undefined
    ) {
      summary.unknownCostJobs++;
      pool.unknownCostJobs++;
      continue;
    }

    summary.estimatedEnergyKwh += decision.estimatedEnergyKwh;
    summary.estimatedSpotCostNok += decision.estimatedSpotCostNok;
    pool.estimatedEnergyKwh += decision.estimatedEnergyKwh;
    pool.estimatedSpotCostNok += decision.estimatedSpotCostNok;
  }

  return summary;
}
