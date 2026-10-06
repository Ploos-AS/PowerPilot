import { describe, expect, it, vi } from "vitest";
import type { AutomationEvent } from "./automation";
import { sendWebhook } from "./webhook";

const event: AutomationEvent = {
  schema: "powerpilot.automation.v1",
  id: "NO2:test:favourable",
  area: "NO2",
  startsAt: "2026-10-06T02:00:00+02:00",
  orePerKwh: 10,
  signal: "favourable",
  policy: "ALLOW_LOW_PRIORITY_COMPUTE",
  source: "test",
};

describe("webhook transport", () => {
  it("posts the automation event as JSON", async () => {
    const fetcher = vi.fn(async () => new Response("", { status: 204 }));
    expect(await sendWebhook("https://example.invalid/powerpilot", event, fetcher)).toEqual({ ok: true, status: 204 });
    expect(fetcher).toHaveBeenCalledWith("https://example.invalid/powerpilot", expect.objectContaining({
      method: "POST",
      body: JSON.stringify(event),
    }));
  });

  it("returns HTTP failures without throwing", async () => {
    const fetcher = vi.fn(async () => new Response("", { status: 503 }));
    expect(await sendWebhook("https://example.invalid/powerpilot", event, fetcher)).toEqual({
      ok: false, status: 503, error: "HTTP 503",
    });
  });

  it("returns network failures without throwing", async () => {
    const fetcher = vi.fn(async () => { throw new Error("offline"); });
    expect(await sendWebhook("https://example.invalid/powerpilot", event, fetcher)).toEqual({
      ok: false, error: "offline",
    });
  });
});
