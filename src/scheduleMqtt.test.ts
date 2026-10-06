import { describe, expect, it } from "vitest";
import { scheduleMqttPublications } from "./scheduleMqtt";
import type { ScheduleEvent } from "./scheduleEvent";

describe("scheduler MQTT contract", () => {
  it("publishes retained schedule state under the area and job", () => {
    const event: ScheduleEvent = {
      schema: "powerpilot.schedule.v1",
      id: "render-42:scheduled:2026-10-07T02:00:00.000Z",
      jobId: "render-42",
      decision: "scheduled",
      priority: "low",
      startsAt: "2026-10-07T02:00:00.000Z",
      endsAt: "2026-10-07T04:00:00.000Z",
      estimatedEnergyKwh: 1,
      estimatedSpotCostNok: 0.15,
    };
    const publications = scheduleMqttPublications("NO2", event);
    expect(publications).toHaveLength(4);
    expect(publications.map(item => item.topic)).toEqual([
      "powerpilot/no2/schedule/render-42",
      "powerpilot/no2/schedule/render-42/decision",
      "powerpilot/no2/schedule/render-42/starts_at",
      "powerpilot/no2/schedule/render-42/estimated_spot_cost_nok",
    ]);
    expect(publications.every(item => item.retain)).toBe(true);
    expect(JSON.parse(publications[0].payload)).toEqual(event);
  });

  it("publishes an unschedulable decision without invented timing or cost", () => {
    const event: ScheduleEvent = {
      schema: "powerpilot.schedule.v1",
      id: "backup:unschedulable:insufficient-price-coverage",
      jobId: "backup",
      decision: "unschedulable",
      priority: "normal",
    };
    const publications = scheduleMqttPublications("NO1", event);
    expect(publications).toHaveLength(2);
    expect(publications[0].topic).toBe("powerpilot/no1/schedule/backup");
    expect(publications[1]).toMatchObject({
      topic: "powerpilot/no1/schedule/backup/decision",
      payload: "unschedulable",
      retain: true,
    });
  });

  it("escapes job ids in topic segments", () => {
    const event: ScheduleEvent = {
      schema: "powerpilot.schedule.v1",
      id: "render farm:scheduled:x",
      jobId: "render farm/node 1",
      decision: "scheduled",
      priority: "low",
      startsAt: "2026-10-07T02:00:00.000Z",
      endsAt: "2026-10-07T03:00:00.000Z",
    };
    expect(scheduleMqttPublications("NO2", event)[0].topic)
      .toBe("powerpilot/no2/schedule/render%20farm%2Fnode%201");
  });
});
