import { describe, expect, it } from "vitest";
import { homeAssistantDiscovery } from "./homeAssistant";

describe("Home Assistant MQTT discovery", () => {
  it("creates retained price, signal and policy sensors", () => {
    const publications = homeAssistantDiscovery("NO2");
    expect(publications).toHaveLength(3);
    expect(publications.every(p => p.retain)).toBe(true);
    expect(publications.map(p => p.topic)).toEqual([
      "homeassistant/sensor/powerpilot_no2/price/config",
      "homeassistant/sensor/powerpilot_no2/signal/config",
      "homeassistant/sensor/powerpilot_no2/policy/config",
    ]);
  });

  it("binds sensors to the PowerPilot MQTT state topics", () => {
    const publications = homeAssistantDiscovery("NO2");
    const price = JSON.parse(publications[0].payload);
    const signal = JSON.parse(publications[1].payload);
    const policy = JSON.parse(publications[2].payload);

    expect(price.state_topic).toBe("powerpilot/no2/price_ore_kwh");
    expect(price.unit_of_measurement).toBe("øre/kWh");
    expect(signal.state_topic).toBe("powerpilot/no2/signal");
    expect(policy.state_topic).toBe("powerpilot/no2/policy");
  });

  it("groups sensors as one Home Assistant device", () => {
    const publications = homeAssistantDiscovery("NO5");
    for (const publication of publications) {
      const config = JSON.parse(publication.payload);
      expect(config.device.identifiers).toEqual(["powerpilot_no5"]);
      expect(config.device.name).toBe("PowerPilot NO5");
      expect(config.device.manufacturer).toBe("Ploos AS");
    }
  });
});
