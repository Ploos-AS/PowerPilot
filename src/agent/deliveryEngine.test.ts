import { describe, expect, it, vi } from "vitest";
import { emptyAgentState } from "./agentState";
import { AgentStateRepository } from "./agentStateRepository";
import { DeliveryEngine } from "./deliveryEngine";
import { DeliveryRepository } from "./deliveryRepository";
import { OutboxRepository } from "./outboxRepository";
import type { StateStore } from "./stateStore";

class MemoryStore implements StateStore<unknown> {
  value?: unknown;
  async load() { return this.value; }
  async save(value: unknown) { this.value = structuredClone(value); }
}

const event = {
  id: "event-1",
  kind: "automation" as const,
  createdAt: "2026-10-06T18:00:00.000Z",
  payload: {
    schema: "powerpilot.automation.v1" as const,
    id: "event-1",
    area: "NO2",
    startsAt: "2026-10-06T19:00:00.000Z",
    orePerKwh: 12,
    signal: "favourable" as const,
    policy: "ALLOW_LOW_PRIORITY_COMPUTE" as const,
  },
};

describe("DeliveryEngine", () => {
  it("retries failed transport independently and cleans outbox after all succeed", async () => {
    const state = emptyAgentState();
    const store = new MemoryStore();
    const stateRepository = new AgentStateRepository(store);
    const deliveries = new DeliveryRepository(state, stateRepository);
    const outbox = new OutboxRepository(state, stateRepository);
    await outbox.enqueue(event, ["mqtt", "webhook"]);

    const mqtt = vi.fn(async (_delivery, queued) => {
      expect(queued.payload).toEqual(event.payload);
    });
    const webhook = vi.fn()
      .mockRejectedValueOnce(new Error("timeout"))
      .mockResolvedValue(undefined);
    const engine = new DeliveryEngine(deliveries, outbox, { mqtt, webhook });

    await expect(engine.runOnce(new Date("2026-10-06T18:01:00Z"))).resolves.toEqual({
      delivered: 1, failed: 1, skipped: 0,
    });
    expect(outbox.get(event.id)).toEqual(event);
    expect(deliveries.get(event.id, "mqtt")).toMatchObject({ status: "delivered", attempts: 1 });
    expect(deliveries.get(event.id, "webhook")).toMatchObject({ status: "pending", attempts: 1, nextAttemptAt: "2026-10-06T18:01:05.000Z" });

    await expect(engine.runOnce(new Date("2026-10-06T18:01:05Z"))).resolves.toEqual({
      delivered: 1, failed: 0, skipped: 0,
    });
    expect(mqtt).toHaveBeenCalledTimes(1);
    expect(webhook).toHaveBeenCalledTimes(2);
    expect(outbox.get(event.id)).toBeUndefined();
    expect(deliveries.get(event.id, "mqtt")).toBeUndefined();
    expect(deliveries.get(event.id, "webhook")).toBeUndefined();
  });

  it("skips a pending record whose payload is missing", async () => {
    const state = emptyAgentState();
    const repository = new AgentStateRepository(new MemoryStore());
    const deliveries = new DeliveryRepository(state, repository);
    const outbox = new OutboxRepository(state, repository);
    await deliveries.ensurePending("orphan", "mqtt");
    const mqtt = vi.fn(async () => undefined);

    await expect(new DeliveryEngine(deliveries, outbox, { mqtt }).runOnce()).resolves.toEqual({
      delivered: 0, failed: 0, skipped: 1,
    });
    expect(mqtt).not.toHaveBeenCalled();
  });
});
