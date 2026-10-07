import { describe, expect, it } from "vitest";
import { AGENT_STATE_SCHEMA, assertAgentState, emptyAgentState } from "./agentState";
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
  it("normalizes legacy v1 state without an outbox", () => {
    const state: any = { schema: AGENT_STATE_SCHEMA, jobs: [], savings: [], deliveries: [] };
    expect(() => assertAgentState(state)).not.toThrow();
    expect(state.outbox).toEqual([]);
  });

  it("rejects duplicate delivery transport keys", () => {
    const state = emptyAgentState();
    state.deliveries.push(
      { eventId: "event-1", transport: "webhook", status: "pending", attempts: 0, updatedAt: "2026-10-06T12:00:00.000Z" },
      { eventId: "event-1", transport: "webhook", status: "pending", attempts: 1, updatedAt: "2026-10-06T12:01:00.000Z" },
    );
    expect(() => assertAgentState(state)).toThrow("Duplicate Agent delivery");
  });

  it("rejects an outbox payload whose id differs from its envelope", () => {
    const state = emptyAgentState();
    state.outbox.push({
      id: "event-1", kind: "automation", createdAt: "2026-10-06T12:00:00.000Z",
      payload: {
        schema: "powerpilot.automation.v1", id: "event-2", area: "NO2",
        startsAt: "2026-10-06T13:00:00.000Z", orePerKwh: 10,
        signal: "favourable", policy: "ALLOW_LOW_PRIORITY_COMPUTE",
      },
    });
    expect(() => assertAgentState(state)).toThrow("Invalid Agent outbox event");
  });

  it("rejects malformed retry timestamps", () => {
    const state = emptyAgentState();
    state.deliveries.push({
      eventId: "event-1", transport: "mqtt", status: "pending", attempts: 1,
      updatedAt: "2026-10-06T12:00:00.000Z", nextAttemptAt: "not-a-date",
    });
    expect(() => assertAgentState(state)).toThrow("Invalid Agent delivery");
  });
});
