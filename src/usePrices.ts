import { useEffect, useState } from "react";
import type { HourlyPrice, PriceArea } from "./domain";
import { getMockPrices } from "./mockPrices";
import { hvaKosterStrommenProvider } from "./priceProvider";

export type PriceLoad = {
  prices: HourlyPrice[];
  source: "live" | "mock";
  status: "loading" | "ready" | "fallback";
  message: string;
};

function day(offset: number) {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + offset);
  return d;
}

export function usePrices(area: PriceArea): PriceLoad {
  const [state, setState] = useState<PriceLoad>({
    prices: getMockPrices(area),
    source: "mock",
    status: "loading",
    message: "Loading live spot prices…",
  });

  useEffect(() => {
    let active = true;
    setState({
      prices: getMockPrices(area),
      source: "mock",
      status: "loading",
      message: "Loading live spot prices…",
    });

    (async () => {
      try {
        const today = await hvaKosterStrommenProvider.getPrices(area, day(0));
        let tomorrow: HourlyPrice[] = [];
        try {
          tomorrow = await hvaKosterStrommenProvider.getPrices(area, day(1));
        } catch {
          // Tomorrow is normally unavailable until the day-ahead market has published it.
        }
        if (!active) return;
        setState({
          prices: [...today, ...tomorrow],
          source: "live",
          status: "ready",
          message: tomorrow.length
            ? "Live spot/base prices · today + tomorrow"
            : "Live spot/base prices · tomorrow not published yet",
        });
      } catch {
        if (!active) return;
        setState({
          prices: getMockPrices(area),
          source: "mock",
          status: "fallback",
          message: "Live prices unavailable · showing deterministic mock data",
        });
      }
    })();

    return () => {
      active = false;
    };
  }, [area]);

  return state;
}
