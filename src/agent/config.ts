export type AgentConfig = {
  host: string;
  port: number;
  statePath: string;
};

export function loadAgentConfig(
  env: Record<string, string | undefined> = process.env,
): AgentConfig {
  const host = env.POWERPILOT_AGENT_HOST?.trim() || "0.0.0.0";
  const rawPort = env.POWERPILOT_AGENT_PORT?.trim() || "8787";
  const port = Number(rawPort);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("POWERPILOT_AGENT_PORT must be an integer from 1 to 65535");
  }

  const statePath = env.POWERPILOT_AGENT_STATE_PATH?.trim() || "./data/agent-state.json";

  return { host, port, statePath };
}
