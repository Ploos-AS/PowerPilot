import { describe, expect, it } from "vitest";
import { AGENT_STATE_SCHEMA, emptyAgentState } from "./agentState";
import { AgentStateRepository } from "./agentStateRepository";
import type { StateStore } from "./stateStore";

class MemoryStore implements StateStore<unknown> {
  constructor(public value?: unknown) {}
  async load() { return this.value; }
  async save(value: unknown) { this.value = value; }
}

describe("AgentStateRepository", () => {
  it("creates deterministic empty state when none exists", async () => {
    const repository = new AgentStateRepository(new MemoryStore());
    await expect(repository.load()).resolves.toEqual(emptyAgentState());
  });

  it("round-trips persisted state", async () => {
    const store = new MemoryStore();
    const repository = new AgentStateRepository(store);
    const state = emptyAgentState();
    state.jobs.push({
      id: "render-1",
      durationMinutes: 60,
      earliestStart: "2026-10-06T12:00:00.000Z",
      deadline: "2026-10-06T18:00:00.000Z",
      priority: "normal",
    });
    await repository.save(state);
    await expect(repository.load()).resolves.toEqual(state);
  });

  it("rejects unsupported schemas", async () => {
    const repository = new AgentStateRepository(new MemoryStore({
      schema: "powerpilot.agent-state.v0",
      jobs: [],
      savings: [],
      deliveries: [],
    }));
    await expect(repository.load()).rejects.toThrow("Unsupported Agent state schema");
  });

  it("keeps delivery state independent per transport", () => {
    const state = emptyAgentState();
    state.deliveries.push(
      { eventId: "event-1", transport: "mqtt", status: "delivered", attempts: 1, updatedAt: "2026-10-06T12:00:00.000Z" },
      { eventId: "event-1", transport: "webhook", status: "pending", attempts: 2, updatedAt: "2026-10-06T12:01:00.000Z", lastError: "timeout" },
    );
    expect(state.schema).toBe(AGENT_STATE_SCHEMA);
    expect(state.deliveries.map(item => item.status)).toEqual(["delivered", "pending"]);
  });
});
