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
    const prices = await this.provider.getPrices(this.area, now);
    const nowMs = now.getTime();
    const current = [...prices]
      .filter(price => Date.parse(price.startsAt) <= nowMs)
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
