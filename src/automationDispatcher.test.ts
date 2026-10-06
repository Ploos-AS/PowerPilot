import { describe, expect, it, vi } from "vitest";
import type { AutomationEvent } from "./automation";
import { DEFAULT_AUTOMATION_SETTINGS } from "./automationSettings";
import { dispatchAutomation } from "./automationDispatcher";

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

  it("does not mark an event dispatched when no transport is configured", async () => {
    const settings = { ...DEFAULT_AUTOMATION_SETTINGS, enabled: true };
    expect(await dispatchAutomation(event, settings, storage())).toEqual({ dispatched: false });
  });
});
