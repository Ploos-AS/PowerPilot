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
    const existing = this.state.outbox.find(item => item.id === event.id);
    if (existing && JSON.stringify(existing) !== JSON.stringify(event)) {
      throw new Error(`Conflicting outbox event ${event.id}`);
    }
    const previousOutboxLength = this.state.outbox.length;
    const previousDeliveriesLength = this.state.deliveries.length;
    if (!existing) this.state.outbox.push(structuredClone(event));
    const existingTransports = new Set(this.state.deliveries.filter(item => item.eventId === event.id).map(item => item.transport));
    for (const transport of [...new Set(transports)]) {
      if (existingTransports.has(transport)) continue;
      this.state.deliveries.push({
        eventId: event.id,
        transport,
        status: "pending",
        attempts: 0,
        updatedAt: event.createdAt,
      });
    }
    if (this.state.outbox.length === previousOutboxLength && this.state.deliveries.length === previousDeliveriesLength) return;
    try {
      await this.repository.save(this.state);
    } catch (error) {
      this.state.outbox.splice(previousOutboxLength);
      this.state.deliveries.splice(previousDeliveriesLength);
      throw error;
    }
  }

  async pruneDelivered(): Promise<number> {
    let removed = 0;
    for (const event of [...this.state.outbox]) {
      if (await this.removeIfDelivered(event.id)) removed++;
    }
    return removed;
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
