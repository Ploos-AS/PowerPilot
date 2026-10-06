import type { HourlyPrice } from "./domain";
import type { FlexibleJob } from "./scheduler";
import type { QueuePlan } from "./jobQueue";
import { summarizeQueueCost } from "./queueCost";

const HOUR_MS = 60 * 60 * 1000;

export type QueueSavings = {
  scheduledSpotCostNok?: number;
  immediateSpotCostNok?: number;
  savingsNok?: number;
  savingsPercent?: number;
  comparableJobs: number;
  excludedJobs: number;
};

export function compareQueueToImmediate(
  jobs: FlexibleJob[],
  plan: QueuePlan,
  prices: HourlyPrice[],
): QueueSavings {
  const scheduled = summarizeQueueCost(jobs, plan);
  const decisionsById = new Map(plan.decisions.map(decision => [decision.jobId, decision]));
  const sorted = [...prices].sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));

  let scheduledComparable = 0;
  let immediate = 0;
  let comparableJobs = 0;
  let excludedJobs = 0;

  for (const job of jobs) {
    const decision = decisionsById.get(job.id);
    if (
      !decision ||
      decision.status === "unschedulable" ||
      decision.estimatedSpotCostNok === undefined ||
      job.estimatedPowerWatts === undefined ||
      job.durationMinutes % 60 !== 0
    ) {
      excludedJobs++;
      continue;
    }

    const start = Date.parse(job.earliestStart);
    const hours = job.durationMinutes / 60;
    const index = sorted.findIndex(price => Date.parse(price.startsAt) === start);
    if (index < 0 || index + hours > sorted.length) {
      excludedJobs++;
      continue;
    }

    const slice = sorted.slice(index, index + hours);
    const contiguous = slice.every(
      (price, offset) => Date.parse(price.startsAt) === start + offset * HOUR_MS,
    );
    if (!contiguous) {
      excludedJobs++;
      continue;
    }

    const averageOrePerKwh = slice.reduce((sum, price) => sum + price.orePerKwh, 0) / hours;
    const energyKwh = (job.estimatedPowerWatts / 1000) * (job.durationMinutes / 60);
    immediate += energyKwh * (averageOrePerKwh / 100);
    scheduledComparable += decision.estimatedSpotCostNok;
    comparableJobs++;
  }

  if (comparableJobs === 0) {
    return { comparableJobs, excludedJobs };
  }

  const savingsNok = immediate - scheduledComparable;
  return {
    scheduledSpotCostNok: scheduledComparable,
    immediateSpotCostNok: immediate,
    savingsNok,
    savingsPercent: immediate === 0 ? undefined : (savingsNok / immediate) * 100,
    comparableJobs,
    excludedJobs,
  };
}
