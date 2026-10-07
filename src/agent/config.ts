import type { PriceArea } from "../domain.js";
export type AgentConfig = {
  host: string;
  port: number;
  statePath: string;
  mqttUrl?: string;
  mqttUsername?: string;
  mqttPassword?: string;
  webhookUrl?: string;
  workerIntervalMs: number;
  apiToken?: string;
  priceArea: PriceArea;
  pricePollIntervalMs: number;
};

export function loadAgentConfig(
  env: Record<string, string | undefined> = process.env,
): AgentConfig {
  const host = env.POWERPILOT_AGENT_HOST?.trim() || "127.0.0.1";
  const rawPort = env.POWERPILOT_AGENT_PORT?.trim() || "8787";
  const port = Number(rawPort);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("POWERPILOT_AGENT_PORT must be an integer from 1 to 65535");
  }

  const statePath = env.POWERPILOT_AGENT_STATE_PATH?.trim() || "./data/agent-state.json";
  const mqttUrl = env.POWERPILOT_MQTT_URL?.trim() || undefined;
  const mqttUsername = env.POWERPILOT_MQTT_USERNAME?.trim() || undefined;
  const mqttPassword = env.POWERPILOT_MQTT_PASSWORD || undefined;
  const webhookUrl = env.POWERPILOT_WEBHOOK_URL?.trim() || undefined;
  const apiToken = env.POWERPILOT_AGENT_TOKEN || undefined;
  const priceArea = (env.POWERPILOT_PRICE_AREA?.trim() || "NO2") as PriceArea;
  if (!["NO1", "NO2", "NO3", "NO4", "NO5"].includes(priceArea)) throw new Error("POWERPILOT_PRICE_AREA must be NO1, NO2, NO3, NO4, or NO5");
  const pricePollIntervalMs = Number(env.POWERPILOT_PRICE_POLL_INTERVAL_MS?.trim() || "300000");
  if (!Number.isInteger(pricePollIntervalMs) || pricePollIntervalMs < 60000) throw new Error("POWERPILOT_PRICE_POLL_INTERVAL_MS must be an integer of at least 60000");
  const workerIntervalMs = Number(env.POWERPILOT_WORKER_INTERVAL_MS?.trim() || "5000");
  if (!Number.isInteger(workerIntervalMs) || workerIntervalMs < 1000) {
    throw new Error("POWERPILOT_WORKER_INTERVAL_MS must be an integer of at least 1000");
  }

  if ((mqttUsername || mqttPassword) && !mqttUrl) {
    throw new Error("POWERPILOT_MQTT_URL is required when MQTT credentials are configured");
  }

  return { host, port, statePath, mqttUrl, mqttUsername, mqttPassword, webhookUrl, workerIntervalMs, apiToken, priceArea, pricePollIntervalMs };
}
