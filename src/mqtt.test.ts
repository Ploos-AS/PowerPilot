import { describe, expect, it } from "vitest";
import type { AutomationEvent } from "./automation";
import { mqttPublications } from "./mqtt";

const event: AutomationEvent = {
  schema: "powerpilot.automation.v1",
  id: "NO2:2026-10-06T02:00:00+02:00:favourable",
  area: "NO2",
  startsAt: "2026-10-06T02:00:00+02:00",
  orePerKwh: 12.5,
  signal: "favourable",
  policy: "ALLOW_LOW_PRIORITY_COMPUTE",
  source: "hvakosterstrommen",
};

describe("MQTT contract", () => {
  it("publishes retained area state", () => {
    const publications = mqttPublications(event);
    expect(publications).toHaveLength(4);
    expect(publications.every(p => p.retain)).toBe(true);
    expect(publications.map(p => p.topic)).toEqual([
      "powerpilot/no2/automation",
      "powerpilot/no2/signal",
      "powerpilot/no2/policy",
      "powerpilot/no2/price_ore_kwh",
    ]);
  });

  it("keeps the full versioned event on the automation topic", () => {
    const publication = mqttPublications(event)[0];
    expect(JSON.parse(publication.payload)).toEqual(event);
  });

  it("exposes simple scalar topics for lightweight consumers", () => {
    const publications = mqttPublications(event);
    expect(publications[1].payload).toBe("favourable");
    expect(publications[2].payload).toBe("ALLOW_LOW_PRIORITY_COMPUTE");
    expect(publications[3].payload).toBe("12.5");
  });
});
