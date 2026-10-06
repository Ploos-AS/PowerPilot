import { describe, expect, it, vi } from "vitest";
import type { AutomationEvent } from "./automation";
import { publishMqtt, type MqttLikeClient } from "./mqttPublisher";

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

describe("MQTT publisher", () => {
  it("publishes all retained state messages", async () => {
    const publish = vi.fn((_topic, _payload, _options, callback) => callback());
    const end = vi.fn();
    const client = { publish, end } as MqttLikeClient;
    const result = await publishMqtt("wss://broker.example.invalid/mqtt", event, () => client);
    expect(result).toEqual({ ok: true, published: 4 });
    expect(publish).toHaveBeenCalledTimes(4);
    expect(publish.mock.calls.every(call => call[2].retain === true)).toBe(true);
    expect(end).toHaveBeenCalled();
  });

  it("reports publish failures without throwing", async () => {
    const client = {
      publish: (_topic, _payload, _options, callback) => callback(new Error("broker unavailable")),
      end: vi.fn(),
    } as MqttLikeClient;
    expect(await publishMqtt("wss://broker.example.invalid/mqtt", event, () => client))
      .toEqual({ ok: false, error: "broker unavailable" });
  });

  it("rejects an empty broker URL before connecting", async () => {
    const connect = vi.fn();
    expect(await publishMqtt("", event, connect)).toEqual({
      ok: false,
      error: "MQTT WebSocket URL is empty",
    });
    expect(connect).not.toHaveBeenCalled();
  });
});
