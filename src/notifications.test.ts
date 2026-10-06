import { describe, expect, it } from "vitest";
import type { HourlyPrice } from "./domain";
import { DEFAULT_THRESHOLDS } from "./domain";
import { notificationCandidate } from "./notifications";

const price = (orePerKwh: number): HourlyPrice => ({
  startsAt: "2026-01-01T12:00:00.000Z",
  area: "NO2",
  orePerKwh,
});

describe("notification rules", () => {
  it("does not notify normal prices", () => {
    expect(notificationCandidate(price(50), DEFAULT_THRESHOLDS)).toBeNull();
  });

  it("creates a negative-price notification", () => {
    const n = notificationCandidate(price(-2), DEFAULT_THRESHOLDS);
    expect(n?.title).toContain("Negative");
    expect(n?.id).toContain("negative");
  });

  it("creates a favourable-price notification", () => {
    expect(notificationCandidate(price(20), DEFAULT_THRESHOLDS)?.title).toContain("Favourable");
  });

  it("creates an expensive-price notification", () => {
    expect(notificationCandidate(price(100), DEFAULT_THRESHOLDS)?.title).toContain("Expensive");
  });
});
