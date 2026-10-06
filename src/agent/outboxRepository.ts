import type { AgentState, OutboxEvent } from "./agentState.js";
import type { AgentStateRepository } from "./agentStateRepository.js";
import type { DeliveryTransport } from "./deliveryRepository.js";

export class OutboxRepository {
  constructor(
    private readonly state: AgentState,
    private readonly repository: AgentStateRepository,
  ) {}

  get(eventId: string): OutboxEvent | undefined {
    const event = this.state.outbox.find(item => item.id === eventId);
    return event ? structuredClone(event) : undefined;
  }

  async enqueue(event: OutboxEvent, transports: DeliveryTransport[]): Promise<void> {
    if (this.state.outbox.some(item => item.id === event.id)) return;
    const previousOutboxLength = this.state.outbox.length;
    const previousDeliveriesLength = this.state.deliveries.length;
    this.state.outbox.push(structuredClone(event));
    for (const transport of [...new Set(transports)]) {
      this.state.deliveries.push({
        eventId: event.id,
        transport,
        status: "pending",
        attempts: 0,
        updatedAt: event.createdAt,
      });
    }
    try {
      await this.repository.save(this.state);
    } catch (error) {
      this.state.outbox.splice(previousOutboxLength);
      this.state.deliveries.splice(previousDeliveriesLength);
      throw error;
    }
  }

  async removeIfDelivered(eventId: string): Promise<boolean> {
    const related = this.state.deliveries.filter(item => item.eventId === eventId);
    if (!related.length || related.some(item => item.status !== "delivered")) return false;
    const previousOutbox = this.state.outbox.map(item => structuredClone(item));
    const previousDeliveries = this.state.deliveries.map(item => ({ ...item }));
    this.state.outbox = this.state.outbox.filter(item => item.id !== eventId);
    this.state.deliveries = this.state.deliveries.filter(item => item.eventId !== eventId);
    try {
      await this.repository.save(this.state);
      return true;
    } catch (error) {
      this.state.outbox = previousOutbox;
      this.state.deliveries = previousDeliveries;
      throw error;
    }
  }
}
