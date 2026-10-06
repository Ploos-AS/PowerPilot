import type { Server } from "node:http";
import type { AgentState } from "./agentState.js";
import type { AgentStateRepository } from "./agentStateRepository.js";

export async function loadStateOrClose(
  server: Server,
  repository: AgentStateRepository,
): Promise<AgentState> {
  try {
    return await repository.load();
  } catch (error) {
    await new Promise<void>(resolve => server.close(() => resolve()));
    throw error;
  }
}
