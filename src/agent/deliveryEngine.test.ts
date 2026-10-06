import { describe, expect, it, vi } from "vitest";
import { emptyAgentState } from "./agentState";
import { AgentStateRepository } from "./agentStateRepository";
import { DeliveryEngine } from "./deliveryEngine";
import { DeliveryRepository } from "./deliveryRepository";
import type { StateStore } from "./stateStore";

class MemoryStore implements StateStore<unknown> {
  value?: unknown;
  async load() { return this.value; }
  async save(value: unknown) { this.value = structuredClone(value); }
}

describe("DeliveryEngine", () => {
  it("retries failed transport independently and never redelivers success", async () => {
    const state = emptyAgentState();
    const store = new MemoryStore();
    const stateRepository = new AgentStateRepository(store);
    const deliveries = new DeliveryRepository(state, stateRepository);
    await deliveries.ensurePending("event-1", "mqtt");
    await deliveries.ensurePending("event-1", "webhook");

    const mqtt = vi.fn(async () => undefined);
    const webhook = vi.fn()
      .mockRejectedValueOnce(new Error("timeout"))
      .mockResolvedValue(undefined);
    const engine = new DeliveryEngine(deliveries, { mqtt, webhook });

    await expect(engine.runOnce(new Date("2026-10-06T18:00:00Z"))).resolves.toEqual({
      delivered: 1,
      failed: 1,
      skipped: 0,
    });
    expect(deliveries.get("event-1", "mqtt")).toMatchObject({ status: "delivered", attempts: 1 });
    expect(deliveries.get("event-1", "webhook")).toMatchObject({ status: "pending", attempts: 1, lastError: "timeout" });

    await expect(engine.runOnce(new Date("2026-10-06T18:01:00Z"))).resolves.toEqual({
      delivered: 1,
      failed: 0,
      skipped: 0,
    });
    expect(mqtt).toHaveBeenCalledTimes(1);
    expect(webhook).toHaveBeenCalledTimes(2);
    expect(deliveries.get("event-1", "webhook")).toMatchObject({ status: "delivered", attempts: 2 });
  });

  it("leaves pending delivery untouched when no handler is configured", async () => {
    const state = emptyAgentState();
    const repository = new DeliveryRepository(state, new AgentStateRepository(new MemoryStore()));
    await repository.ensurePending("event-2", "mqtt");
    const engine = new DeliveryEngine(repository, {});

    await expect(engine.runOnce()).resolves.toEqual({ delivered: 0, failed: 0, skipped: 1 });
    expect(repository.get("event-2", "mqtt")).toMatchObject({ status: "pending", attempts: 0 });
  });
});
