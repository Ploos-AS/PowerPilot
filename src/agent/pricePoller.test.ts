import { describe, expect, it } from "vitest";
import { emptyAgentState } from "./agentState";
import { AgentStateRepository } from "./agentStateRepository";
import { OutboxRepository } from "./outboxRepository";
import { PricePoller } from "./pricePoller";
import type { StateStore } from "./stateStore";
import type { PriceProvider } from "../priceProvider";

class MemoryStore implements StateStore<unknown> {
  value?: unknown;
  async load() { return structuredClone(this.value); }
  async save(value: unknown) { this.value = structuredClone(value); }
}

const provider: PriceProvider = {
  id: "test-provider",
  async getPrices(area) {
    return [
      { area, startsAt: "2026-10-07T10:00:00Z", orePerKwh: 20 },
      { area, startsAt: "2026-10-07T11:00:00Z", orePerKwh: 90 },
      { area, startsAt: "2026-10-07T12:00:00Z", orePerKwh: 10 },
    ];
  },
};

describe("PricePoller", () => {
  it("enqueues the latest started price period using the shared automation contract", async () => {
    const state = emptyAgentState();
    const outbox = new OutboxRepository(state, new AgentStateRepository(new MemoryStore()));
    const poller = new PricePoller(provider, outbox, "NO2", ["webhook"]);

    expect(await poller.poll(new Date("2026-10-07T11:30:00Z"))).toBe(1);
    expect(state.outbox).toHaveLength(1);
    expect(state.outbox[0].payload).toMatchObject({
      schema: "powerpilot.automation.v1",
      id: "NO2:2026-10-07T11:00:00Z:expensive",
      area: "NO2",
      orePerKwh: 90,
      signal: "expensive",
      policy: "CURTAIL_LOW_PRIORITY_COMPUTE",
    });
  });

  it("does not select a future price period", async () => {
    const state = emptyAgentState();
    const poller = new PricePoller(provider, new OutboxRepository(state, new AgentStateRepository(new MemoryStore())), "NO2", ["webhook"]);
    expect(await poller.poll(new Date("2026-10-07T09:59:59Z"))).toBe(0);
    expect(state.outbox).toEqual([]);
  });

  it("is idempotent across repeated polls of the same period", async () => {
    const state = emptyAgentState();
    const outbox = new OutboxRepository(state, new AgentStateRepository(new MemoryStore()));
    const poller = new PricePoller(provider, outbox, "NO2", ["mqtt", "webhook"]);
    await poller.poll(new Date("2026-10-07T11:10:00Z"));
    await poller.poll(new Date("2026-10-07T11:20:00Z"));
    expect(state.outbox).toHaveLength(1);
    expect(state.deliveries).toHaveLength(2);
  });
});
