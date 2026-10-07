import { describe, expect, it, vi } from "vitest";
import { emptyAgentState } from "./agentState";
import { AgentStateRepository } from "./agentStateRepository";
import { DeliveryEngine } from "./deliveryEngine";
import { DeliveryRepository } from "./deliveryRepository";
import { OutboxRepository } from "./outboxRepository";
import type { StateStore } from "./stateStore";

class FailingStore implements StateStore<unknown> {
  value?: unknown;
  saves = 0;
  failOn = 3;
  async load() { return structuredClone(this.value); }
  async save(value: unknown) {
    this.saves++;
    if (this.saves === this.failOn) throw new Error("save failed");
    this.value = structuredClone(value);
  }
}

describe("delivery cleanup recovery", () => {
  it("prunes after restart without sending a delivered event again", async () => {
    const state = emptyAgentState();
    const store = new FailingStore();
    const repository = new AgentStateRepository(store);
    const outbox = new OutboxRepository(state, repository);
    await outbox.enqueue({
      id: "e1", kind: "automation", createdAt: "2026-10-07T00:00:00Z",
      payload: {
        schema: "powerpilot.automation.v1", id: "e1", area: "NO2",
        startsAt: "2026-10-07T01:00:00Z", orePerKwh: 10,
        signal: "favourable", policy: "ALLOW_LOW_PRIORITY_COMPUTE",
      },
    }, ["webhook"]);

    const send = vi.fn(async () => undefined);
    const engine = new DeliveryEngine(new DeliveryRepository(state, repository), outbox, { webhook: send });
    await expect(engine.runOnce(new Date("2026-10-07T00:01:00Z"))).rejects.toThrow("save failed");
    expect(send).toHaveBeenCalledTimes(1);

    store.failOn = -1;
    const repository2 = new AgentStateRepository(store);
    const state2 = await repository2.load();
    expect(state2.deliveries[0].status).toBe("delivered");
    const engine2 = new DeliveryEngine(
      new DeliveryRepository(state2, repository2),
      new OutboxRepository(state2, repository2),
      { webhook: send },
    );
    await engine2.runOnce(new Date("2026-10-07T00:02:00Z"));
    expect(send).toHaveBeenCalledTimes(1);
    expect((await repository2.load()).outbox).toEqual([]);
  });
});
