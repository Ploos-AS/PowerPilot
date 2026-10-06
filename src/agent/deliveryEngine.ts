import type { DeliveryState } from "./agentState.js";
import type { DeliveryRepository, DeliveryTransport } from "./deliveryRepository.js";

export type DeliveryHandler = (delivery: DeliveryState) => Promise<void>;

export class DeliveryEngine {
  constructor(
    private readonly repository: DeliveryRepository,
    private readonly handlers: Partial<Record<DeliveryTransport, DeliveryHandler>>,
  ) {}

  async runOnce(now = new Date()): Promise<{ delivered: number; failed: number; skipped: number }> {
    let delivered = 0;
    let failed = 0;
    let skipped = 0;

    for (const delivery of this.repository.listPending()) {
      const handler = this.handlers[delivery.transport];
      if (!handler) {
        skipped++;
        continue;
      }
      try {
        await handler(delivery);
        await this.repository.recordSuccess(delivery.eventId, delivery.transport, now);
        delivered++;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await this.repository.recordFailure(delivery.eventId, delivery.transport, message, now);
        failed++;
      }
    }

    return { delivered, failed, skipped };
  }
}
