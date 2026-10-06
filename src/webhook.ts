import type { AutomationEvent } from "./automation";

export type WebhookResult =
  | { ok: true; status: number }
  | { ok: false; status?: number; error: string };

export async function sendWebhook(
  url: string,
  event: AutomationEvent,
  fetcher: typeof fetch = fetch,
): Promise<WebhookResult> {
  try {
    const response = await fetcher(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(event),
    });
    if (!response.ok) {
      return { ok: false, status: response.status, error: `HTTP ${response.status}` };
    }
    return { ok: true, status: response.status };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Webhook failed" };
  }
}
