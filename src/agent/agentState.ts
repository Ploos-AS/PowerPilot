export type PersistedJob = {
  id: string;
  durationMinutes: number;
  earliestStart: string;
  deadline: string;
  priority: "low" | "normal" | "high";
  pool?: string;
  estimatedPowerWatts?: number;
};

export type PersistedSavingsRecord = {
  recordedAt: string;
  scheduledSpotCostNok: number;
  immediateSpotCostNok: number;
  savingsNok: number;
  energyKwh: number;
  comparableJobs: number;
};

export type OutboxEvent = {
  id: string;
  kind: "automation";
  payload: {
    schema: "powerpilot.automation.v1";
    id: string;
    area: string;
    startsAt: string;
    orePerKwh: number;
    signal: "negative" | "favourable" | "normal" | "expensive";
    policy: "ALLOW_LOW_PRIORITY_COMPUTE" | "NORMAL" | "CURTAIL_LOW_PRIORITY_COMPUTE";
  };
  createdAt: string;
};

export const AGENT_STATE_SCHEMA = "powerpilot.agent-state.v1" as const;

export type DeliveryState = {
  eventId: string;
  transport: "mqtt" | "webhook";
  status: "pending" | "delivered";
  attempts: number;
  updatedAt: string;
  lastError?: string;
  nextAttemptAt?: string;
};

export type AgentState = {
  schema: typeof AGENT_STATE_SCHEMA;
  jobs: PersistedJob[];
  savings: PersistedSavingsRecord[];
  deliveries: DeliveryState[];
  outbox: OutboxEvent[];
};

export function emptyAgentState(): AgentState {
  return {
    schema: AGENT_STATE_SCHEMA,
    jobs: [],
    savings: [],
    deliveries: [],
    outbox: [],
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object";
}

function isIsoDate(value: unknown): value is string {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

function finiteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function assertAgentState(value: unknown): asserts value is AgentState {
  if (!isObject(value)) throw new Error("Agent state must be an object");
  const state = value as Partial<AgentState>;
  if (state.schema !== AGENT_STATE_SCHEMA) throw new Error("Unsupported Agent state schema");
  if (!Array.isArray(state.jobs) || !Array.isArray(state.savings) || !Array.isArray(state.deliveries)) {
    throw new Error("Invalid Agent state collections");
  }
  if (state.outbox === undefined) state.outbox = [];
  if (!Array.isArray(state.outbox)) throw new Error("Invalid Agent outbox");

  const jobIds = new Set<string>();
  for (const job of state.jobs) {
    if (!isObject(job) || typeof job.id !== "string" || !job.id || jobIds.has(job.id) ||
        !Number.isInteger(job.durationMinutes) || job.durationMinutes <= 0 ||
        !isIsoDate(job.earliestStart) || !isIsoDate(job.deadline) ||
        !["low", "normal", "high"].includes(String(job.priority)) ||
        (job.pool !== undefined && typeof job.pool !== "string") ||
        (job.estimatedPowerWatts !== undefined && (!finiteNumber(job.estimatedPowerWatts) || job.estimatedPowerWatts <= 0))) {
      throw new Error("Invalid Agent job");
    }
    jobIds.add(job.id);
  }

  for (const record of state.savings) {
    if (!isObject(record) || !isIsoDate(record.recordedAt) ||
        !finiteNumber(record.scheduledSpotCostNok) || !finiteNumber(record.immediateSpotCostNok) ||
        !finiteNumber(record.savingsNok) || !finiteNumber(record.energyKwh) || record.energyKwh < 0 ||
        !Number.isInteger(record.comparableJobs) || record.comparableJobs < 0) {
      throw new Error("Invalid Agent savings record");
    }
  }

  const outboxIds = new Set<string>();
  for (const event of state.outbox) {
    if (!isObject(event) || typeof event.id !== "string" || !event.id || outboxIds.has(event.id) ||
        event.kind !== "automation" || !isIsoDate(event.createdAt) || !isObject(event.payload) ||
        event.payload.schema !== "powerpilot.automation.v1" || event.payload.id !== event.id ||
        typeof event.payload.area !== "string" || !/^NO[1-5]$/.test(event.payload.area) ||
        !isIsoDate(event.payload.startsAt) || !finiteNumber(event.payload.orePerKwh) ||
        !["negative", "favourable", "normal", "expensive"].includes(String(event.payload.signal)) ||
        !["ALLOW_LOW_PRIORITY_COMPUTE", "NORMAL", "CURTAIL_LOW_PRIORITY_COMPUTE"].includes(String(event.payload.policy))) {
      throw new Error("Invalid Agent outbox event");
    }
    outboxIds.add(event.id);
  }

  const deliveryKeys = new Set<string>();
  for (const delivery of state.deliveries) {
    if (!isObject(delivery) || typeof delivery.eventId !== "string" || !delivery.eventId ||
        !["mqtt", "webhook"].includes(String(delivery.transport)) ||
        !["pending", "delivered"].includes(String(delivery.status)) ||
        !Number.isInteger(delivery.attempts) || delivery.attempts < 0 ||
        !isIsoDate(delivery.updatedAt) ||
        (delivery.lastError !== undefined && typeof delivery.lastError !== "string") ||
        (delivery.nextAttemptAt !== undefined && !isIsoDate(delivery.nextAttemptAt))) {
      throw new Error("Invalid Agent delivery");
    }
    const key = `${delivery.eventId}:${delivery.transport}`;
    if (deliveryKeys.has(key)) throw new Error("Duplicate Agent delivery");
    deliveryKeys.add(key);
  }
}
