import { describe, expect, it } from "vitest";
import { createAutomationEvent, policyForSignal } from "./automation";
import { DEFAULT_THRESHOLDS, type HourlyPrice } from "./domain";

const price = (orePerKwh: number): HourlyPrice => ({
  startsAt: "2026-10-06T02:00:00+02:00",
  area: "NO2",
  orePerKwh,
});

describe("automation contract", () => {
  it("maps cheap and negative power to low-priority compute", () => {
    expect(policyForSignal("negative")).toBe("ALLOW_LOW_PRIORITY_COMPUTE");
    expect(policyForSignal("favourable")).toBe("ALLOW_LOW_PRIORITY_COMPUTE");
  });

  it("maps expensive power to curtailment", () => {
    expect(policyForSignal("expensive")).toBe("CURTAIL_LOW_PRIORITY_COMPUTE");
  });

  it("creates a stable versioned event", () => {
    expect(createAutomationEvent(price(12.5), DEFAULT_THRESHOLDS, "hvakosterstrommen")).toEqual({
      schema: "powerpilot.automation.v1",
      id: "NO2:2026-10-06T02:00:00+02:00:favourable",
      area: "NO2",
      startsAt: "2026-10-06T02:00:00+02:00",
      orePerKwh: 12.5,
      signal: "favourable",
      policy: "ALLOW_LOW_PRIORITY_COMPUTE",
      source: "hvakosterstrommen",
    });
  });
});
