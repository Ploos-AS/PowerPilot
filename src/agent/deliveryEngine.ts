import type { DeliveryState, OutboxEvent } from "./agentState.js";
import type { DeliveryRepository, DeliveryTransport } from "./deliveryRepository.js";
import type { OutboxRepository } from "./outboxRepository.js";

export type DeliveryHandler = (delivery: DeliveryState, event: OutboxEvent) => Promise<void>;

export class DeliveryEngine {
  constructor(
    private readonly repository: DeliveryRepository,
    private readonly outbox: OutboxRepository,
    private readonly handlers: Partial<Record<DeliveryTransport, DeliveryHandler>>,
  ) {}

  async runOnce(now = new Date()): Promise<{ delivered: number; failed: number; skipped: number }> {
    let delivered = 0;
    let failed = 0;
    let skipped = 0;

    await this.outbox.pruneDelivered();

    for (const delivery of this.repository.listPending(now)) {
      const event = this.outbox.get(delivery.eventId);
      const handler = this.handlers[delivery.transport];
      if (!event || !handler) {
        skipped++;
        continue;
      }
      try {
        await handler(delivery, event);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await this.repository.recordFailure(delivery.eventId, delivery.transport, message, now);
        failed++;
        continue;
      }
      await this.repository.recordSuccess(delivery.eventId, delivery.transport, now);
      delivered++;
      await this.outbox.removeIfDelivered(delivery.eventId);
    }

    return { delivered, failed, skipped };
  }
}
