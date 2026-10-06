import type { FlexibleJob } from "../scheduler.js";
import type { SavingsRecord } from "../savingsHistory.js";

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
  jobs: FlexibleJob[];
  savings: SavingsRecord[];
  deliveries: DeliveryState[];
};

export function emptyAgentState(): AgentState {
  return {
    schema: AGENT_STATE_SCHEMA,
    jobs: [],
    savings: [],
    deliveries: [],
  };
}

export function assertAgentState(value: unknown): asserts value is AgentState {
  if (!value || typeof value !== "object") throw new Error("Agent state must be an object");
  const state = value as Partial<AgentState>;
  if (state.schema !== AGENT_STATE_SCHEMA) throw new Error("Unsupported Agent state schema");
  if (!Array.isArray(state.jobs) || !Array.isArray(state.savings) || !Array.isArray(state.deliveries)) {
    throw new Error("Invalid Agent state collections");
  }
}
