import type { PriceArea } from "./domain";
import type { MqttPublication } from "./mqtt";

const DISCOVERY_ROOT = "homeassistant";

export function homeAssistantDiscovery(area: PriceArea): MqttPublication[] {
  const key = area.toLowerCase();
  const stateRoot = `powerpilot/${key}`;
  const device = {
    identifiers: [`powerpilot_${key}`],
    name: `PowerPilot ${area}`,
    manufacturer: "Ploos AS",
    model: "PowerPilot",
  };

  const sensor = (
    id: string,
    name: string,
    stateTopic: string,
    extra: Record<string, unknown> = {},
  ): MqttPublication => ({
    topic: `${DISCOVERY_ROOT}/sensor/powerpilot_${key}/${id}/config`,
    retain: true,
    payload: JSON.stringify({
      unique_id: `powerpilot_${key}_${id}`,
      name,
      state_topic: stateTopic,
      device,
      ...extra,
    }),
  });

  return [
    sensor("price", "Spot price", `${stateRoot}/price_ore_kwh`, {
      unit_of_measurement: "øre/kWh",
      state_class: "measurement",
      icon: "mdi:currency-usd",
    }),
    sensor("signal", "Price signal", `${stateRoot}/signal`, {
      icon: "mdi:traffic-light",
    }),
    sensor("policy", "Compute policy", `${stateRoot}/policy`, {
      icon: "mdi:server",
    }),
  ];
}
