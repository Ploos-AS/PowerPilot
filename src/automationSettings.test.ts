import { describe, expect, it } from "vitest";
import {
  DEFAULT_AUTOMATION_SETTINGS,
  loadAutomationSettings,
  saveAutomationSettings,
} from "./automationSettings";

function memoryStorage() {
  let value: string | null = null;
  return {
    getItem: () => value,
    setItem: (_key: string, next: string) => { value = next; },
  };
}

describe("automation settings", () => {
  it("defaults all outbound automation to off", () => {
    const storage = memoryStorage();
    expect(loadAutomationSettings(storage)).toEqual(DEFAULT_AUTOMATION_SETTINGS);
    expect(loadAutomationSettings(storage).enabled).toBe(false);
  });

  it("persists non-secret transport configuration", () => {
    const storage = memoryStorage();
    const settings = {
      ...DEFAULT_AUTOMATION_SETTINGS,
      enabled: true,
      webhookEnabled: true,
      webhookUrl: "https://example.invalid/powerpilot",
      mqttWebSocketUrl: "wss://broker.example.invalid/mqtt",
    };
    saveAutomationSettings(settings, storage);
    expect(loadAutomationSettings(storage)).toEqual(settings);
  });

  it("falls back safely when stored JSON is invalid", () => {
    const storage = { getItem: () => "{" };
    expect(loadAutomationSettings(storage)).toEqual(DEFAULT_AUTOMATION_SETTINGS);
  });
});
