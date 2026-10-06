import type { ScheduleEvent } from "./scheduleEvent";
import type { MqttPublication } from "./mqtt";

export function scheduleMqttPublications(
  area: string,
  event: ScheduleEvent,
): MqttPublication[] {
  const root = `powerpilot/${area.toLowerCase()}/schedule/${encodeURIComponent(event.jobId)}`;
  return [
    {
      topic: root,
      payload: JSON.stringify(event),
      retain: true,
    },
    {
      topic: `${root}/decision`,
      payload: event.decision,
      retain: true,
    },
    ...(event.startsAt ? [{
      topic: `${root}/starts_at`,
      payload: event.startsAt,
      retain: true,
    }] : []),
    ...(event.estimatedSpotCostNok === undefined ? [] : [{
      topic: `${root}/estimated_spot_cost_nok`,
      payload: String(event.estimatedSpotCostNok),
      retain: true,
    }]),
  ];
}
