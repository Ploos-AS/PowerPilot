import { describe, expect, it, vi } from "vitest";
import { deliverAgentWebhook, type AgentAutomationEvent } from "./webhookTransport";

const event: AgentAutomationEvent = {
  schema: "powerpilot.automation.v1",
  id: "NO2:2026-10-07T00:00:00Z:favourable",
  area: "NO2",
  startsAt: "2026-10-07T00:00:00Z",
  orePerKwh: 12,
  signal: "favourable",
  policy: "ALLOW_LOW_PRIORITY_COMPUTE",
};

describe("Agent webhook transport", () => {
  it("sends stable idempotency headers and the unchanged wire event", async () => {
    const fetcher = vi.fn(async () => new Response(null, { status: 204 }));

    await deliverAgentWebhook("https://receiver.example/hook", event, fetcher as typeof fetch);

    expect(fetcher).toHaveBeenCalledTimes(1);
    const [url, init] = fetcher.mock.calls[0];
    expect(url).toBe("https://receiver.example/hook");
    expect(init).toMatchObject({
      method: "POST",
      headers: {
        "content-type": "application/json",
        "idempotency-key": event.id,
        "x-powerpilot-event-id": event.id,
      },
      body: JSON.stringify(event),
    });
  });

  it("surfaces non-success status for the retry engine", async () => {
    const fetcher = vi.fn(async () => new Response(null, { status: 503 }));
    await expect(deliverAgentWebhook("https://receiver.example/hook", event, fetcher as typeof fetch))
      .rejects.toThrow("HTTP 503");
  });
});
