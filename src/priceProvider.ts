import type { HourlyPrice, PriceArea } from "./domain.js";

export const PRICE_PROVIDER_TIMEOUT_MS = 10_000;

export interface PriceProvider {
  readonly id: string;
  getPrices(area: PriceArea, date: Date): Promise<HourlyPrice[]>;
}

type HksPrice = {
  NOK_per_kWh: number;
  EUR_per_kWh: number;
  EXR: number;
  time_start: string;
  time_end: string;
};

const pad = (n: number) => String(n).padStart(2, "0");

export function priceUrl(area: PriceArea, date: Date): string {
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  return `https://www.hvakosterstrommen.no/api/v1/prices/${year}/${month}-${day}_${area}.json`;
}

export const hvaKosterStrommenProvider: PriceProvider = {
  id: "hvakosterstrommen",
  async getPrices(area, date) {
    const response = await fetch(priceUrl(area, date), { signal: AbortSignal.timeout(PRICE_PROVIDER_TIMEOUT_MS) });
    if (!response.ok) {
      throw new Error(`Price provider returned HTTP ${response.status}`);
    }
    const rows = (await response.json()) as HksPrice[];
    return rows.map((row) => ({
      startsAt: row.time_start,\n      endsAt: row.time_end,
      area,
      orePerKwh: Math.round(row.NOK_per_kWh * 1_000_000) / 10_000,
    }));
  },
};
