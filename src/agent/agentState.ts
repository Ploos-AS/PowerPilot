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

export function assertAgentState(value: unknown): asserts value is AgentState {
  if (!value || typeof value !== "object") throw new Error("Agent state must be an object");
  const state = value as Partial<AgentState>;
  if (state.schema !== AGENT_STATE_SCHEMA) throw new Error("Unsupported Agent state schema");
  if (!Array.isArray(state.jobs) || !Array.isArray(state.savings) || !Array.isArray(state.deliveries)) {
    throw new Error("Invalid Agent state collections");
  }
  if (state.outbox === undefined) state.outbox = [];
  if (!Array.isArray(state.outbox)) throw new Error("Invalid Agent outbox");
}
