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
  it("uses the Oslo calendar day around UTC midnight", async () => {
    const requested: string[] = [];
    const checkingProvider: PriceProvider = {
      id: "date-check",
      async getPrices(_area, date) {
        requested.push([date.getFullYear(), date.getMonth() + 1, date.getDate()].join("-"));
        return [];
      },
    };
    const state = emptyAgentState();
    const poller = new PricePoller(checkingProvider, new OutboxRepository(state, new AgentStateRepository(new MemoryStore())), "NO2", ["webhook"]);
    await poller.poll(new Date("2026-10-07T22:30:00Z"));
    expect(requested).toEqual(["2026-10-8"]);
  });

  it("does not publish a stale hourly period", async () => {
    const state = emptyAgentState();
    const poller = new PricePoller(provider, new OutboxRepository(state, new AgentStateRepository(new MemoryStore())), "NO2", ["webhook"]);
    expect(await poller.poll(new Date("2026-10-07T13:00:00Z"))).toBe(0);
    expect(state.outbox).toEqual([]);
  });

  it("propagates provider errors without enqueuing events", async () => {
    const failingProvider: PriceProvider = {
      id: "failure",
      async getPrices() { throw new Error("provider unavailable"); },
    };
    const state = emptyAgentState();
    const poller = new PricePoller(failingProvider, new OutboxRepository(state, new AgentStateRepository(new MemoryStore())), "NO2", ["webhook"]);
    await expect(poller.poll(new Date("2026-10-07T11:30:00Z"))).rejects.toThrow("provider unavailable");
    expect(state.outbox).toEqual([]);
  });

  it("resolves Oslo calendar dates across daylight-saving transitions", async () => {
    const requested: string[] = [];
    const checkingProvider: PriceProvider = {
      id: "dst-check",
      async getPrices(_area, date) {
        requested.push([date.getFullYear(), date.getMonth() + 1, date.getDate()].join("-"));
        return [];
      },
    };
    const state = emptyAgentState();
    const poller = new PricePoller(checkingProvider, new OutboxRepository(state, new AgentStateRepository(new MemoryStore())), "NO2", ["webhook"]);
    // Spring: 01:30 UTC is 03:30 CEST, after the skipped local hour.
    await poller.poll(new Date("2026-03-29T01:30:00Z"));
    // Autumn: both occurrences of 02:30 local must map to the same calendar day.
    await poller.poll(new Date("2026-10-25T00:30:00Z"));
    await poller.poll(new Date("2026-10-25T01:30:00Z"));
    expect(requested).toEqual(["2026-3-29", "2026-10-25", "2026-10-25"]);
  });

  it("distinguishes repeated autumn-hour price instants", async () => {
    const state = emptyAgentState();
    const autumnProvider: PriceProvider = {
      id: "dst-autumn",
      async getPrices(area) {
        return [
          { area, startsAt: "2026-10-25T02:00:00+02:00", orePerKwh: 20 },
          { area, startsAt: "2026-10-25T02:00:00+01:00", orePerKwh: 90 },
        ];
      },
    };
    const poller = new PricePoller(autumnProvider, new OutboxRepository(state, new AgentStateRepository(new MemoryStore())), "NO2", ["webhook"]);
    await poller.poll(new Date("2026-10-25T00:30:00Z"));
    await poller.poll(new Date("2026-10-25T01:30:00Z"));
    expect(state.outbox.map(event => event.payload.orePerKwh)).toEqual([20, 90]);
    expect(new Set(state.outbox.map(event => event.id)).size).toBe(2);
  });

  it("accepts spring-forward prices without inventing a missing hour", async () => {
    const state = emptyAgentState();
    const springProvider: PriceProvider = {
      id: "dst-spring",
      async getPrices(area) {
        return [
          { area, startsAt: "2026-03-29T01:00:00+01:00", orePerKwh: 20 },
          { area, startsAt: "2026-03-29T03:00:00+02:00", orePerKwh: 90 },
        ];
      },
    };
    const poller = new PricePoller(springProvider, new OutboxRepository(state, new AgentStateRepository(new MemoryStore())), "NO2", ["webhook"]);
    await poller.poll(new Date("2026-03-29T00:30:00Z"));
    await poller.poll(new Date("2026-03-29T01:30:00Z"));
    expect(state.outbox.map(event => event.payload.orePerKwh)).toEqual([20, 90]);
  });

  it("selects exact quarter-hour intervals and rejects gaps", async () => {
    const state = emptyAgentState();
    const quarterHourProvider: PriceProvider = {
      id: "quarter-hour",
      async getPrices(area) {
        return [
          { area, startsAt: "2026-10-07T10:00:00Z", endsAt: "2026-10-07T10:15:00Z", orePerKwh: 10 },
          { area, startsAt: "2026-10-07T10:15:00Z", endsAt: "2026-10-07T10:30:00Z", orePerKwh: 90 },
          { area, startsAt: "2026-10-07T10:45:00Z", endsAt: "2026-10-07T11:00:00Z", orePerKwh: 20 },
        ];
      },
    };
    const poller = new PricePoller(quarterHourProvider, new OutboxRepository(state, new AgentStateRepository(new MemoryStore())), "NO2", ["webhook"]);
    expect(await poller.poll(new Date("2026-10-07T10:14:59Z"))).toBe(1);
    expect(await poller.poll(new Date("2026-10-07T10:15:00Z"))).toBe(1);
    expect(await poller.poll(new Date("2026-10-07T10:30:00Z"))).toBe(0);
    expect(await poller.poll(new Date("2026-10-07T10:45:00Z"))).toBe(1);
    expect(state.outbox.map(event => event.payload.orePerKwh)).toEqual([10, 90, 20]);
  });

});
