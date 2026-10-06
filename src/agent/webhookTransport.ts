export type AgentAutomationEvent = {
  schema: "powerpilot.automation.v1";
  id: string;
  area: string;
  startsAt: string;
  orePerKwh: number;
  signal: "negative" | "favourable" | "normal" | "expensive";
  policy: "ALLOW_LOW_PRIORITY_COMPUTE" | "NORMAL" | "CURTAIL_LOW_PRIORITY_COMPUTE";
};

export async function deliverAgentWebhook(
  url: string,
  event: AgentAutomationEvent,
  fetcher: typeof fetch = fetch,
): Promise<void> {
  const response = await fetcher(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(event),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
}
