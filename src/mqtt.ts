import type { AutomationEvent } from "./automation";

export const MQTT_ROOT = "powerpilot";

export type MqttPublication = {
  topic: string;
  payload: string;
  retain: boolean;
};

export function mqttPublications(event: AutomationEvent): MqttPublication[] {
  const base = `${MQTT_ROOT}/${event.area.toLowerCase()}`;
  return [
    {
      topic: `${base}/automation`,
      payload: JSON.stringify(event),
      retain: true,
    },
    {
      topic: `${base}/signal`,
      payload: event.signal,
      retain: true,
    },
    {
      topic: `${base}/policy`,
      payload: event.policy,
      retain: true,
    },
    {
      topic: `${base}/price_ore_kwh`,
      payload: String(event.orePerKwh),
      retain: true,
    },
  ];
}
