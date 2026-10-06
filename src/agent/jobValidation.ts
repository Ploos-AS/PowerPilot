import type { PersistedJob } from "./agentState.js";

const priorities = new Set(["low", "normal", "high"]);

export function parseJob(value: unknown): PersistedJob {
  if (!value || typeof value !== "object") throw new Error("job must be an object");
  const job = value as Record<string, unknown>;
  if (typeof job.id !== "string" || !job.id.trim()) throw new Error("job.id is required");
  if (!Number.isInteger(job.durationMinutes) || (job.durationMinutes as number) < 1 || (job.durationMinutes as number) % 60 !== 0) {
    throw new Error("job.durationMinutes must be a positive whole-hour duration");
  }
  if (typeof job.earliestStart !== "string" || !Number.isFinite(Date.parse(job.earliestStart))) throw new Error("job.earliestStart must be an ISO date");
  if (typeof job.deadline !== "string" || !Number.isFinite(Date.parse(job.deadline))) throw new Error("job.deadline must be an ISO date");
  if (Date.parse(job.earliestStart as string) >= Date.parse(job.deadline as string)) throw new Error("job deadline must be after earliestStart");
  if (typeof job.priority !== "string" || !priorities.has(job.priority)) throw new Error("job.priority must be low, normal or high");
  if (job.pool !== undefined && (typeof job.pool !== "string" || !job.pool.trim())) throw new Error("job.pool must be a non-empty string");
  if (job.estimatedPowerWatts !== undefined && (typeof job.estimatedPowerWatts !== "number" || !Number.isFinite(job.estimatedPowerWatts) || job.estimatedPowerWatts <= 0)) {
    throw new Error("job.estimatedPowerWatts must be positive");
  }
  return job as PersistedJob;
}
