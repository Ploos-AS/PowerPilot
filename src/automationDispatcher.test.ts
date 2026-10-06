import { describe, expect, it, vi } from "vitest";
import type { AutomationEvent } from "./automation";
import { DEFAULT_AUTOMATION_SETTINGS } from "./automationSettings";
import { dispatchAutomation } from "./automationDispatcher";
import * as mqttPublisher from "./mqttPublisher";

const event: AutomationEvent = {
  schema: "powerpilot.automation.v1",
  id: "NO2:test:favourable",
  area: "NO2",
  startsAt: "2026-10-06T04:00:00+02:00",
  orePerKwh: 10,
  signal: "favourable",
  policy: "ALLOW_LOW_PRIORITY_COMPUTE",
  source: "test",
};

function storage() {
  let value: string | null = null;
  return {
    getItem: () => value,
    setItem: (_key: string, next: string) => { value = next; },
  };
}

describe("automation dispatcher", () => {
  it("does nothing while outbound automation is disabled", async () => {
    expect(await dispatchAutomation(event, DEFAULT_AUTOMATION_SETTINGS, storage()))
      .toEqual({ dispatched: false });
  });

  it("sends an enabled webhook once", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 204 })));
    const state = storage();
    const settings = {
      ...DEFAULT_AUTOMATION_SETTINGS,
      enabled: true,
      webhookEnabled: true,
      webhookUrl: "https://example.invalid/powerpilot",
    };
    expect((await dispatchAutomation(event, settings, state)).dispatched).toBe(true);
    expect((await dispatchAutomation(event, settings, state)).dispatched).toBe(false);
    vi.unstubAllGlobals();
  });

  it("publishes state plus Home Assistant discovery when enabled", async () => {
    const publish = vi.spyOn(mqttPublisher, "publishMqttPublications").mockResolvedValue({ ok: true, published: 7 });
    const settings = {
      ...DEFAULT_AUTOMATION_SETTINGS,
      enabled: true,
      mqttEnabled: true,
      mqttWebSocketUrl: "wss://broker.example.invalid/mqtt",
      homeAssistantDiscovery: true,
    };
    const result = await dispatchAutomation(event, settings, storage());
    expect(result.dispatched).toBe(true);
    expect(publish).toHaveBeenCalledOnce();
    const publications = publish.mock.calls[0][1];
    expect(publications).toHaveLength(7);
    expect(publications.filter(p => p.topic.startsWith("homeassistant/"))).toHaveLength(3);
    expect(publications.filter(p => p.topic.startsWith("powerpilot/"))).toHaveLength(4);
    publish.mockRestore();
  });

  it("publishes only PowerPilot state when discovery is disabled", async () => {
    const publish = vi.spyOn(mqttPublisher, "publishMqttPublications").mockResolvedValue({ ok: true, published: 4 });
    const settings = {
      ...DEFAULT_AUTOMATION_SETTINGS,
      enabled: true,
      mqttEnabled: true,
      mqttWebSocketUrl: "wss://broker.example.invalid/mqtt",
      homeAssistantDiscovery: false,
    };
    await dispatchAutomation(event, settings, storage());
    expect(publish.mock.calls[0][1]).toHaveLength(4);
    publish.mockRestore();
  });

  it("does not mark an event dispatched when no transport is configured", async () => {
    const settings = { ...DEFAULT_AUTOMATION_SETTINGS, enabled: true };
    expect(await dispatchAutomation(event, settings, storage())).toEqual({ dispatched: false });
  });
});
