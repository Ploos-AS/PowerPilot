import type { HourlyPrice } from "./domain";

export type JobPriority = "low" | "normal" | "high";

export type FlexibleJob = {
  id: string;
  durationMinutes: number;
  earliestStart: string;
  deadline: string;
  priority: JobPriority;
};

export type ScheduleDecision =
  | {
      status: "scheduled";
      jobId: string;
      startsAt: string;
      endsAt: string;
      averageOrePerKwh: number;
      prices: HourlyPrice[];
    }
  | {
      status: "unschedulable";
      jobId: string;
      reason: "invalid-job" | "insufficient-price-coverage" | "no-contiguous-window";
    };

const HOUR_MS = 60 * 60 * 1000;

export function scheduleJob(job: FlexibleJob, prices: HourlyPrice[]): ScheduleDecision {
  const earliest = Date.parse(job.earliestStart);
  const deadline = Date.parse(job.deadline);

  if (
    !job.id ||
    !Number.isInteger(job.durationMinutes) ||
    job.durationMinutes < 1 ||
    job.durationMinutes % 60 !== 0 ||
    !Number.isFinite(earliest) ||
    !Number.isFinite(deadline) ||
    earliest >= deadline
  ) {
    return { status: "unschedulable", jobId: job.id, reason: "invalid-job" };
  }

  const hours = job.durationMinutes / 60;
  const sorted = [...prices].sort(
    (a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt),
  );

  let best: Extract<ScheduleDecision, { status: "scheduled" }> | null = null;
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
    if (best === null || average < best.averageOrePerKwh) {
      best = {
        status: "scheduled",
        jobId: job.id,
        startsAt: slice[0].startsAt,
        endsAt: new Date(end).toISOString(),
        averageOrePerKwh: average,
        prices: slice,
      };
    }
  }

  if (best) return best;
  return {
    status: "unschedulable",
    jobId: job.id,
    reason: eligibleStarts ? "no-contiguous-window" : "insufficient-price-coverage",
  };
}
