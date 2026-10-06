import type { HourlyPrice } from "./domain";

export type JobPriority = "low" | "normal" | "high";

export type FlexibleJob = {
  id: string;
  durationMinutes: number;
  earliestStart: string;
  deadline: string;
  priority: JobPriority;
  estimatedPowerWatts?: number;
};

export type ScheduleDecision =
  | {
      status: "scheduled" | "run-now";
      jobId: string;
      startsAt: string;
      endsAt: string;
      averageOrePerKwh: number;
      prices: HourlyPrice[];
      estimatedEnergyKwh?: number;
      estimatedSpotCostNok?: number;
    }
  | {
      status: "unschedulable";
      jobId: string;
      reason: "invalid-job" | "insufficient-price-coverage" | "no-contiguous-window";
    };

const HOUR_MS = 60 * 60 * 1000;

export function priorityBufferMs(priority: JobPriority): number {
  if (priority === "high") return 2 * HOUR_MS;
  if (priority === "normal") return HOUR_MS;
  return 0;
}

export function scheduleJob(job: FlexibleJob, prices: HourlyPrice[], now = new Date()): ScheduleDecision {
  const earliest = Date.parse(job.earliestStart);
  const deadline = Date.parse(job.deadline);

  if (
    !job.id ||
    !Number.isInteger(job.durationMinutes) ||
    job.durationMinutes < 1 ||
    job.durationMinutes % 60 !== 0 ||
    !Number.isFinite(earliest) ||
    !Number.isFinite(deadline) ||
    (job.estimatedPowerWatts !== undefined && (!Number.isFinite(job.estimatedPowerWatts) || job.estimatedPowerWatts <= 0)) ||
    earliest >= deadline
  ) {
    return { status: "unschedulable", jobId: job.id, reason: "invalid-job" };
  }

  const hours = job.durationMinutes / 60;
  const preferredDeadline = deadline - priorityBufferMs(job.priority);
  const sorted = [...prices].sort(
    (a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt),
  );

  let best: Extract<ScheduleDecision, { status: "scheduled" | "run-now" }> | null = null;
  let bestFallback: Extract<ScheduleDecision, { status: "scheduled" | "run-now" }> | null = null;
  let eligibleStarts = 0;

  for (let i = 0; i <= sorted.length - hours; i++) {
    const slice = sorted.slice(i, i + hours);
    const start = Date.parse(slice[0].startsAt);
    const end = start + job.durationMinutes * 60_000;

    if (start < earliest || end > deadline) continue;
    eligibleStarts++;

    const contiguous = slice.every(
      (price, offset) => Date.parse(price.startsAt) === start + offset * HOUR_MS,
    );
    if (!contiguous) continue;

    const average = slice.reduce((sum, price) => sum + price.orePerKwh, 0) / hours;
    const estimatedEnergyKwh = job.estimatedPowerWatts === undefined
        ? undefined
        : (job.estimatedPowerWatts / 1000) * (job.durationMinutes / 60);
      const estimatedSpotCostNok = estimatedEnergyKwh === undefined
        ? undefined
        : estimatedEnergyKwh * (average / 100);
    const candidate: Extract<ScheduleDecision, { status: "scheduled" | "run-now" }> = {
        status: "scheduled",
        jobId: job.id,
        startsAt: slice[0].startsAt,
        endsAt: new Date(end).toISOString(),
        averageOrePerKwh: average,
        prices: slice,
        ...(estimatedEnergyKwh === undefined ? {} : { estimatedEnergyKwh, estimatedSpotCostNok }),
      };
    if (bestFallback === null || average < bestFallback.averageOrePerKwh) bestFallback = candidate;
    if (end <= preferredDeadline && (best === null || average < best.averageOrePerKwh)) best = candidate;
  }

  best ??= bestFallback;
  if (best) {
    const latestStart = deadline - job.durationMinutes * 60_000;
    const nowMs = now.getTime();
    if (nowMs >= latestStart) {
      const runNow = sorted.findIndex(price => Date.parse(price.startsAt) === nowMs);
      if (runNow >= 0 && runNow + hours <= sorted.length) {
        const slice = sorted.slice(runNow, runNow + hours);
        const contiguous = slice.every(
          (price, offset) => Date.parse(price.startsAt) === nowMs + offset * HOUR_MS,
        );
        const end = nowMs + job.durationMinutes * 60_000;
        if (contiguous && end <= deadline) {
          const average = slice.reduce((sum, price) => sum + price.orePerKwh, 0) / hours;
          const estimatedEnergyKwh = job.estimatedPowerWatts === undefined
            ? undefined
            : (job.estimatedPowerWatts / 1000) * (job.durationMinutes / 60);
          return {
            status: "run-now",
            jobId: job.id,
            startsAt: slice[0].startsAt,
            endsAt: new Date(end).toISOString(),
            averageOrePerKwh: average,
            prices: slice,
            ...(estimatedEnergyKwh === undefined ? {} : {
              estimatedEnergyKwh,
              estimatedSpotCostNok: estimatedEnergyKwh * (average / 100),
            }),
          };
        }
      }
    }
    return best;
  }
  return {
    status: "unschedulable",
    jobId: job.id,
    reason: eligibleStarts ? "no-contiguous-window" : "insufficient-price-coverage",
  };
}
