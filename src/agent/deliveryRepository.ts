import type { AgentState, DeliveryState } from "./agentState.js";
import type { AgentStateRepository } from "./agentStateRepository.js";

export type DeliveryTransport = DeliveryState["transport"];

export class DeliveryRepository {
  constructor(
    private readonly state: AgentState,
    private readonly repository: AgentStateRepository,
  ) {}

  listPending(): DeliveryState[] {
    return this.state.deliveries
      .filter(item => item.status === "pending")
      .map(item => ({ ...item }));
  }

  get(eventId: string, transport: DeliveryTransport): DeliveryState | undefined {
    const item = this.state.deliveries.find(
      delivery => delivery.eventId === eventId && delivery.transport === transport,
    );
    return item ? { ...item } : undefined;
  }

  async ensurePending(eventId: string, transport: DeliveryTransport, now = new Date()): Promise<DeliveryState> {
    const existing = this.get(eventId, transport);
    if (existing) return existing;
    const delivery: DeliveryState = {
      eventId,
      transport,
      status: "pending",
      attempts: 0,
      updatedAt: now.toISOString(),
    };
    this.state.deliveries.push(delivery);
    await this.persistOrRollback(() => {
      this.state.deliveries.pop();
    });
    return { ...delivery };
  }

  async recordSuccess(eventId: string, transport: DeliveryTransport, now = new Date()): Promise<void> {
    await this.update(eventId, transport, item => ({
      ...item,
      status: "delivered",
      attempts: item.attempts + 1,
      updatedAt: now.toISOString(),
      lastError: undefined,
    }));
  }

  async recordFailure(eventId: string, transport: DeliveryTransport, error: string, now = new Date()): Promise<void> {
    await this.update(eventId, transport, item => ({
      ...item,
      status: "pending",
      attempts: item.attempts + 1,
      updatedAt: now.toISOString(),
      lastError: error,
    }));
  }

  private async update(
    eventId: string,
    transport: DeliveryTransport,
    transform: (item: DeliveryState) => DeliveryState,
  ): Promise<void> {
    const index = this.state.deliveries.findIndex(
      item => item.eventId === eventId && item.transport === transport,
    );
    if (index < 0) throw new Error(`Unknown delivery ${eventId}:${transport}`);
    const previous = { ...this.state.deliveries[index] };
    this.state.deliveries[index] = transform(previous);
    await this.persistOrRollback(() => {
      this.state.deliveries[index] = previous;
    });
  }

  private async persistOrRollback(rollback: () => void): Promise<void> {
    try {
      await this.repository.save(this.state);
    } catch (error) {
      rollback();
      throw error;
    }
  }
}
