import type { HourlyPrice } from "./domain";

export type PriceWindow = {
  hours: number;
  startsAt: string;
  endsAt: string;
  averageOrePerKwh: number;
  prices: HourlyPrice[];
};

const HOUR_MS = 60 * 60 * 1000;

export function cheapestWindow(prices: HourlyPrice[], hours: number): PriceWindow | null {
  if (!Number.isInteger(hours) || hours < 1 || prices.length < hours) return null;

  const sorted = [...prices].sort(
    (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
  );

  let best: PriceWindow | null = null;

  for (let i = 0; i <= sorted.length - hours; i++) {
    const slice = sorted.slice(i, i + hours);
    const start = new Date(slice[0].startsAt).getTime();

    const contiguous = slice.every(
      (price, offset) => new Date(price.startsAt).getTime() === start + offset * HOUR_MS,
    );
    if (!contiguous) continue;

    const average = slice.reduce((sum, price) => sum + price.orePerKwh, 0) / hours;
    if (best === null || average < best.averageOrePerKwh) {
      best = {
        hours,
        startsAt: slice[0].startsAt,
        endsAt: new Date(start + hours * HOUR_MS).toISOString(),
        averageOrePerKwh: average,
        prices: slice,
      };
    }
  }

  return best;
}

export function cheapestWindows(prices: HourlyPrice[], durations = [1, 2, 3]): PriceWindow[] {
  return durations
    .map(hours => cheapestWindow(prices, hours))
    .filter((window): window is PriceWindow => window !== null);
}
