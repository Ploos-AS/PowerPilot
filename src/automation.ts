import { classifyPrice, type HourlyPrice, type PriceSignal, type Thresholds } from "./domain";

export type AutomationPolicy =
  | "ALLOW_LOW_PRIORITY_COMPUTE"
  | "NORMAL"
  | "CURTAIL_LOW_PRIORITY_COMPUTE";

export type AutomationEvent = {
  schema: "powerpilot.automation.v1";
  id: string;
  area: HourlyPrice["area"];
  startsAt: string;
  orePerKwh: number;
  signal: PriceSignal;
  policy: AutomationPolicy;
  source: string;
};

export function policyForSignal(signal: PriceSignal): AutomationPolicy {
  if (signal === "negative" || signal === "favourable") return "ALLOW_LOW_PRIORITY_COMPUTE";
  if (signal === "expensive") return "CURTAIL_LOW_PRIORITY_COMPUTE";
  return "NORMAL";
}

export function createAutomationEvent(
  price: HourlyPrice,
  thresholds: Thresholds,
  source: string,
): AutomationEvent {
  const signal = classifyPrice(price.orePerKwh, thresholds);
  return {
    schema: "powerpilot.automation.v1",
    id: `${price.area}:${price.startsAt}:${signal}`,
    area: price.area,
    startsAt: price.startsAt,
    orePerKwh: price.orePerKwh,
    signal,
    policy: policyForSignal(signal),
    source,
  };
}
