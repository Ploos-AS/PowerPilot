import type { AutomationEvent } from "./automation";
import type { AutomationSettings } from "./automationSettings";
import { sendWebhook } from "./webhook";
import { publishMqttPublications } from "./mqttPublisher";
import { mqttPublications } from "./mqtt";
import { homeAssistantDiscovery } from "./homeAssistant";

const KEY = "powerpilot.automation.dispatched";

export type DispatchResult = {
  dispatched: boolean;
  webhook?: Awaited<ReturnType<typeof sendWebhook>>;
  mqtt?: Awaited<ReturnType<typeof publishMqttPublications>>;
};

function seen(storage: Pick<Storage, "getItem">): Set<string> {
  try {
    return new Set(JSON.parse(storage.getItem(KEY) ?? "[]") as string[]);
  } catch {
    return new Set();
  }
}

export async function dispatchAutomation(
  event: AutomationEvent,
  settings: AutomationSettings,
  storage: Pick<Storage, "getItem" | "setItem"> = localStorage,
): Promise<DispatchResult> {
  if (!settings.enabled) return { dispatched: false };

  const dispatched = seen(storage);
  if (dispatched.has(event.id)) return { dispatched: false };

  let webhook: DispatchResult["webhook"];
  if (settings.webhookEnabled && settings.webhookUrl) {
    webhook = await sendWebhook(settings.webhookUrl, event);
  }

  let mqtt: DispatchResult["mqtt"];
  if (settings.mqttEnabled && settings.mqttWebSocketUrl) {
    const publications = [
      ...(settings.homeAssistantDiscovery ? homeAssistantDiscovery(event.area) : []),
      ...mqttPublications(event),
    ];
    mqtt = await publishMqttPublications(settings.mqttWebSocketUrl, publications);
  }

  const delivered = webhook?.ok === true || mqtt?.ok === true;
  if (delivered) {
    dispatched.add(event.id);
    storage.setItem(KEY, JSON.stringify([...dispatched].slice(-500)));
  }

  return { dispatched: delivered, webhook, mqtt };
}
