import { describe, expect, it } from "vitest";
import { loadAgentConfig } from "./config";

describe("agent config", () => {
  it("uses safe defaults with outbound transports disabled", () => {
    expect(loadAgentConfig({})).toEqual({
      host: "127.0.0.1",
      port: 8787,
      statePath: "./data/agent-state.json",
      mqttUrl: undefined,
      mqttUsername: undefined,
      mqttPassword: undefined,
      webhookUrl: undefined,
      workerIntervalMs: 5000,
      apiToken: undefined,
    });
  });

  it("accepts explicit network, transport and worker settings", () => {
    expect(loadAgentConfig({
      POWERPILOT_AGENT_HOST: "127.0.0.1",
      POWERPILOT_AGENT_PORT: "9000",
      POWERPILOT_AGENT_STATE_PATH: "/var/lib/powerpilot/state.json",
      POWERPILOT_MQTT_URL: "mqtts://broker.example",
      POWERPILOT_MQTT_USERNAME: "powerpilot",
      POWERPILOT_MQTT_PASSWORD: "secret",
      POWERPILOT_WEBHOOK_URL: "https://example.test/hook",
      POWERPILOT_WORKER_INTERVAL_MS: "10000",
    })).toEqual({
      host: "127.0.0.1",
      port: 9000,
      statePath: "/var/lib/powerpilot/state.json",
      mqttUrl: "mqtts://broker.example",
      mqttUsername: "powerpilot",
      mqttPassword: "secret",
      webhookUrl: "https://example.test/hook",
      workerIntervalMs: 10000,
    });
  });

  for (const port of ["0", "65536", "abc", "12.5"]) {
    it(`rejects invalid port ${port}`, () => {
      expect(() => loadAgentConfig({ POWERPILOT_AGENT_PORT: port })).toThrow();
    });
  }

  it("requires MQTT URL when credentials are configured", () => {
    expect(() => loadAgentConfig({ POWERPILOT_MQTT_USERNAME: "powerpilot" })).toThrow(
      "POWERPILOT_MQTT_URL is required",
    );
  });

  it("rejects too-fast worker interval", () => {
    expect(() => loadAgentConfig({ POWERPILOT_WORKER_INTERVAL_MS: "999" })).toThrow(
      "POWERPILOT_WORKER_INTERVAL_MS",
    );
  });
});
