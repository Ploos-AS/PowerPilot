import type { HourlyPrice } from "./domain";
import { scheduleJob, type FlexibleJob, type ScheduleDecision } from "./scheduler";

export type QueuePlan = {
  decisions: ScheduleDecision[];
};

export type ResourcePool = {
  maxConcurrentJobs: number;
  maxPowerWatts?: number;
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
  maxPowerWatts?: number,
  pools: Record<string, ResourcePool> = {},
): QueuePlan {
  if (!Number.isInteger(maxConcurrentJobs) || maxConcurrentJobs < 1) {
    throw new Error("maxConcurrentJobs must be a positive integer");
  }
  if (maxPowerWatts !== undefined && (!Number.isFinite(maxPowerWatts) || maxPowerWatts <= 0)) {
    throw new Error("maxPowerWatts must be positive");
  }

  const ordered = [...jobs].sort((a, b) =>
    priorityRank[a.priority] - priorityRank[b.priority]
    || Date.parse(a.deadline) - Date.parse(b.deadline)
    || a.id.localeCompare(b.id),
  );

  const reservations = new Map<string, number>();
  const powerReservations = new Map<string, number>();
  const poolReservations = new Map<string, number>();
  const poolPowerReservations = new Map<string, number>();
  const decisions: ScheduleDecision[] = [];

  for (const job of ordered) {
    const pool = job.pool ? pools[job.pool] : undefined;
    const available = prices.filter(price => {
      if ((reservations.get(price.startsAt) ?? 0) >= maxConcurrentJobs) return false;
      if (maxPowerWatts !== undefined) {
        if (job.estimatedPowerWatts === undefined) return false;
        if ((powerReservations.get(price.startsAt) ?? 0) + job.estimatedPowerWatts > maxPowerWatts) return false;
      }
      if (job.pool && pool) {
        const key = `${job.pool}:${price.startsAt}`;
        if ((poolReservations.get(key) ?? 0) >= pool.maxConcurrentJobs) return false;
        if (pool.maxPowerWatts !== undefined) {
          if (job.estimatedPowerWatts === undefined) return false;
          if ((poolPowerReservations.get(key) ?? 0) + job.estimatedPowerWatts > pool.maxPowerWatts) return false;
        }
      }
      return true;
    });
    const decision = scheduleJob(job, available, now);
    decisions.push(decision);

    if (decision.status !== "unschedulable") {
      for (const price of decision.prices) {
        reservations.set(
          price.startsAt,
          (reservations.get(price.startsAt) ?? 0) + 1,
        );
        if (job.estimatedPowerWatts !== undefined) {
          powerReservations.set(
            price.startsAt,
            (powerReservations.get(price.startsAt) ?? 0) + job.estimatedPowerWatts,
          );
        }
        if (job.pool && pools[job.pool]) {
          const key = `${job.pool}:${price.startsAt}`;
          poolReservations.set(key, (poolReservations.get(key) ?? 0) + 1);
          if (job.estimatedPowerWatts !== undefined) {
            poolPowerReservations.set(key, (poolPowerReservations.get(key) ?? 0) + job.estimatedPowerWatts);
          }
        }
      }
    }
  }

  return { decisions };
}
