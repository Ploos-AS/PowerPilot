import { afterEach, describe, expect, it, vi } from "vitest";
import { hvaKosterStrommenProvider, PRICE_PROVIDER_TIMEOUT_MS, priceUrl } from "./priceProvider";

afterEach(() => vi.unstubAllGlobals());

describe("Hva koster strømmen provider", () => {
  it("builds an area/date URL", () => {
    const date = new Date(2026, 9, 6, 12);
    expect(priceUrl("NO5", date)).toContain("/2026/10-06_NO5.json");
  });

  it("converts NOK/kWh to øre/kWh deterministically", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify([{
      NOK_per_kWh: 0.4231,
      EUR_per_kWh: 0.036,
      EXR: 11.75,
      time_start: "2026-10-06T00:00:00+02:00",
      time_end: "2026-10-06T01:00:00+02:00"
    }]), { status: 200 })));

    const result = await hvaKosterStrommenProvider.getPrices("NO2", new Date(2026, 9, 6, 12));
    expect(result).toEqual([{
      startsAt: "2026-10-06T00:00:00+02:00",
      area: "NO2",
      orePerKwh: 42.31
    }]);
  });

  it("passes a bounded abort signal to fetch", async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) =>
      new Response("[]", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await hvaKosterStrommenProvider.getPrices("NO2", new Date(2026, 9, 6, 12));
    expect(PRICE_PROVIDER_TIMEOUT_MS).toBe(10_000);
    expect(fetchMock.mock.calls[0][1]?.signal).toBeInstanceOf(AbortSignal);
  });

  it("surfaces upstream HTTP failures", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 404 })));
    await expect(hvaKosterStrommenProvider.getPrices("NO1", new Date(2026, 9, 6, 12)))
      .rejects.toThrow("HTTP 404");
  });
});
