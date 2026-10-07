import { createAutomationEvent } from "../automation.js";
import { DEFAULT_THRESHOLDS, type PriceArea } from "../domain.js";
import type { PriceProvider } from "../priceProvider.js";
import type { DeliveryTransport } from "./deliveryRepository.js";
import type { OutboxRepository } from "./outboxRepository.js";

export class PricePoller {
  constructor(
    private readonly provider: PriceProvider,
    private readonly outbox: OutboxRepository,
    private readonly area: PriceArea,
    private readonly transports: DeliveryTransport[],
  ) {}

  async poll(now = new Date()): Promise<number> {
    if (!this.transports.length) return 0;
    // Provider URLs use local calendar dates. Explicit Oslo dates avoid UTC
    // midnight drift when the Agent runs in an Alpine/UTC container.
    const osloDay = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Oslo", year: "numeric", month: "2-digit", day: "2-digit",
    }).format(now);
    const [year, month, day] = osloDay.split("-").map(Number);
    const providerDate = new Date(year, month - 1, day, 12);
    const prices = await this.provider.getPrices(this.area, providerDate);
    const nowMs = now.getTime();
    const current = [...prices]
      .filter(price => {\n        const start = Date.parse(price.startsAt);\n        const end = price.endsAt ? Date.parse(price.endsAt) : start + 60 * 60 * 1000;\n        return Number.isFinite(start) && Number.isFinite(end) && start <= nowMs && nowMs < end && end > start;\n      })
      .sort((a, b) => Date.parse(b.startsAt) - Date.parse(a.startsAt))[0];
    if (!current) return 0;

    const event = createAutomationEvent(current, DEFAULT_THRESHOLDS, this.provider.id);
    await this.outbox.enqueue({
      id: event.id,
      kind: "automation",
      payload: event,
      createdAt: now.toISOString(),
    }, this.transports);
    return 1;
  }
}
