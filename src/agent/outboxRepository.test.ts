import { describe, expect, it } from "vitest";
import { AGENT_STATE_SCHEMA, emptyAgentState, type AgentState } from "./agentState";
import { AgentStateRepository } from "./agentStateRepository";
import { OutboxRepository } from "./outboxRepository";
import type { StateStore } from "./stateStore";

class MemoryStore implements StateStore<unknown> {
  constructor(public value?: unknown) {}
  async load() { return structuredClone(this.value); }
  async save(value: unknown) { this.value = structuredClone(value); }
}

const event = {
  id: "NO2:2026-10-06T20:00:00Z:favourable",
  kind: "automation" as const,
  createdAt: "2026-10-06T19:55:00.000Z",
  payload: {
    schema: "powerpilot.automation.v1" as const,
    id: "NO2:2026-10-06T20:00:00Z:favourable",
    area: "NO2",
    startsAt: "2026-10-06T20:00:00Z",
    orePerKwh: 12,
    signal: "favourable" as const,
    policy: "ALLOW_LOW_PRIORITY_COMPUTE" as const,
  },
};

describe("OutboxRepository", () => {
  it("loads old v1 state without an outbox", async () => {
    const store = new MemoryStore({
      schema: AGENT_STATE_SCHEMA,
      jobs: [],
      savings: [],
      deliveries: [],
    });
    const state = await new AgentStateRepository(store).load();
    expect(state.outbox).toEqual([]);
  });

  it("persists one payload with independent transport deliveries", async () => {
    const state = emptyAgentState();
    const store = new MemoryStore();
    const repository = new AgentStateRepository(store);
    const outbox = new OutboxRepository(state, repository);

    await outbox.enqueue(event, ["mqtt", "webhook", "mqtt"]);

    expect(state.outbox).toEqual([event]);
    expect(state.deliveries).toHaveLength(2);
    expect((store.value as AgentState).outbox).toEqual([event]);
  });

  it("garbage collects only after every transport is delivered", async () => {
    const state = emptyAgentState();
    const repository = new AgentStateRepository(new MemoryStore());
    const outbox = new OutboxRepository(state, repository);
    await outbox.enqueue(event, ["mqtt", "webhook"]);

    state.deliveries[0].status = "delivered";
    await expect(outbox.removeIfDelivered(event.id)).resolves.toBe(false);
    state.deliveries[1].status = "delivered";
    await expect(outbox.removeIfDelivered(event.id)).resolves.toBe(true);
    expect(state.outbox).toEqual([]);
    expect(state.deliveries).toEqual([]);
  });
});
