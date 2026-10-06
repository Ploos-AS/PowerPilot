import type { OutboxEvent } from "./agentState.js";

export function parseAutomationEvent(value: unknown): OutboxEvent["payload"] {
  if (!value || typeof value !== "object") throw new Error("automation event must be an object");
  const event = value as Record<string, unknown>;
  if (event.schema !== "powerpilot.automation.v1") throw new Error("automation event schema is invalid");
  if (typeof event.id !== "string" || !event.id.trim()) throw new Error("automation event id is required");
  if (typeof event.area !== "string" || !/^NO[1-5]$/.test(event.area)) throw new Error("automation event area is invalid");
  if (typeof event.startsAt !== "string" || Number.isNaN(Date.parse(event.startsAt))) throw new Error("automation event startsAt is invalid");
  if (typeof event.orePerKwh !== "number" || !Number.isFinite(event.orePerKwh)) throw new Error("automation event price is invalid");
  if (!["negative", "favourable", "normal", "expensive"].includes(String(event.signal))) throw new Error("automation event signal is invalid");
  if (!["ALLOW_LOW_PRIORITY_COMPUTE", "NORMAL", "CURTAIL_LOW_PRIORITY_COMPUTE"].includes(String(event.policy))) throw new Error("automation event policy is invalid");
  return {
    schema: "powerpilot.automation.v1",
    id: event.id,
    area: event.area,
    startsAt: event.startsAt,
    orePerKwh: event.orePerKwh,
    signal: event.signal as OutboxEvent["payload"]["signal"],
    policy: event.policy as OutboxEvent["payload"]["policy"],
  };
}
