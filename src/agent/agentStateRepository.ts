import type { StateStore } from "./stateStore.js";
import {
  assertAgentState,
  emptyAgentState,
  type AgentState,
} from "./agentState.js";

export class AgentStateRepository {
  constructor(private readonly store: StateStore<unknown>) {}

  async load(): Promise<AgentState> {
    const value = await this.store.load();
    if (value === undefined) return emptyAgentState();
    assertAgentState(value);
    return value;
  }

  async save(state: AgentState): Promise<void> {
    assertAgentState(state);
    await this.store.save(state);
  }
}
