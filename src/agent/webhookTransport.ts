import type { AutomationEvent } from "../automation.js";
import { sendWebhook } from "../webhook.js";

export async function deliverAgentWebhook(url: string, event: AutomationEvent): Promise<void> {
  const result = await sendWebhook(url, event);
  if (!result.ok) throw new Error(result.error);
}
