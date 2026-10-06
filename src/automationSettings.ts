export type AutomationSettings = {
  enabled: boolean;
  webhookEnabled: boolean;
  webhookUrl: string;
  mqttEnabled: boolean;
  mqttWebSocketUrl: string;
  mqttTopicRoot: string;
  homeAssistantDiscovery: boolean;
};

export const DEFAULT_AUTOMATION_SETTINGS: AutomationSettings = {
  enabled: false,
  webhookEnabled: false,
  webhookUrl: "",
  mqttEnabled: false,
  mqttWebSocketUrl: "",
  mqttTopicRoot: "powerpilot",
  homeAssistantDiscovery: false,
};

const KEY = "powerpilot.automation.settings";

export function loadAutomationSettings(storage: Pick<Storage, "getItem"> = localStorage): AutomationSettings {
  try {
    const saved = storage.getItem(KEY);
    return saved ? { ...DEFAULT_AUTOMATION_SETTINGS, ...JSON.parse(saved) } : DEFAULT_AUTOMATION_SETTINGS;
  } catch {
    return DEFAULT_AUTOMATION_SETTINGS;
  }
}

export function saveAutomationSettings(
  settings: AutomationSettings,
  storage: Pick<Storage, "setItem"> = localStorage,
): void {
  storage.setItem(KEY, JSON.stringify(settings));
}
