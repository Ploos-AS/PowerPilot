import { describe, expect, it } from "vitest";
import type { HourlyPrice } from "./domain";
import { cheapestWindow, cheapestWindows } from "./priceWindows";

const prices = (values: number[]): HourlyPrice[] =>
  values.map((orePerKwh, hour) => ({
    startsAt: new Date(Date.UTC(2026, 0, 1, hour)).toISOString(),
    area: "NO2",
    orePerKwh,
  }));

describe("cheapest contiguous windows", () => {
  it("finds the cheapest single hour", () => {
    expect(cheapestWindow(prices([40, 10, 30]), 1)?.startsAt)
      .toBe("2026-01-01T01:00:00.000Z");
  });

  it("finds the cheapest two-hour average", () => {
    const result = cheapestWindow(prices([50, 10, 20, 80]), 2);
    expect(result?.startsAt).toBe("2026-01-01T01:00:00.000Z");
    expect(result?.averageOrePerKwh).toBe(15);
  });

  it("does not bridge a missing hour", () => {
    const input = prices([5, 6]);
    input[1] = { ...input[1], startsAt: "2026-01-01T03:00:00.000Z" };
    expect(cheapestWindow(input, 2)).toBeNull();
  });

  it("returns standard 1h, 2h and 3h recommendations", () => {
    expect(cheapestWindows(prices([30, 20, 10, 40])).map(w => w.hours))
      .toEqual([1, 2, 3]);
  });
});
