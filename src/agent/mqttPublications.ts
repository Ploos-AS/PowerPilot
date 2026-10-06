import type { AgentAutomationEvent } from "./webhookTransport.js";
import type { AgentMqttPublication } from "./mqttTransport.js";

export function agentMqttPublications(event: AgentAutomationEvent): AgentMqttPublication[] {
  const base = `powerpilot/${event.area.toLowerCase()}`;
  return [
    { topic: `${base}/automation`, payload: JSON.stringify(event), retain: true },
    { topic: `${base}/signal`, payload: event.signal, retain: true },
    { topic: `${base}/policy`, payload: event.policy, retain: true },
    { topic: `${base}/price_ore_kwh`, payload: String(event.orePerKwh), retain: true },
  ];
}
