import type { HourlyPrice } from "./domain";
import { scheduleJob, type FlexibleJob, type ScheduleDecision } from "./scheduler";

export type QueuePlan = {
  decisions: ScheduleDecision[];
};

const priorityRank: Record<FlexibleJob["priority"], number> = {
  high: 0,
  normal: 1,
  low: 2,
};

export function planJobQueue(
  jobs: FlexibleJob[],
  prices: HourlyPrice[],
  maxConcurrentJobs = 1,
  now = new Date(),
): QueuePlan {
  if (!Number.isInteger(maxConcurrentJobs) || maxConcurrentJobs < 1) {
    throw new Error("maxConcurrentJobs must be a positive integer");
  }

  const ordered = [...jobs].sort((a, b) =>
    priorityRank[a.priority] - priorityRank[b.priority]
    || Date.parse(a.deadline) - Date.parse(b.deadline)
    || a.id.localeCompare(b.id),
  );

  const reservations = new Map<string, number>();
  const decisions: ScheduleDecision[] = [];

  for (const job of ordered) {
    const available = prices.filter(price =>
      (reservations.get(price.startsAt) ?? 0) < maxConcurrentJobs,
    );
    const decision = scheduleJob(job, available, now);
    decisions.push(decision);

    if (decision.status !== "unschedulable") {
      for (const price of decision.prices) {
        reservations.set(
          price.startsAt,
          (reservations.get(price.startsAt) ?? 0) + 1,
        );
      }
    }
  }

  return { decisions };
}
