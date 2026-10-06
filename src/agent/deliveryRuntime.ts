import type { AgentConfig } from "./config.js";
import { DeliveryEngine, type DeliveryHandler } from "./deliveryEngine.js";
import { DeliveryRepository } from "./deliveryRepository.js";
import { OutboxRepository } from "./outboxRepository.js";
import type { AgentState } from "./agentState.js";
import type { AgentStateRepository } from "./agentStateRepository.js";
import { publishAgentMqtt } from "./mqttTransport.js";
import { agentMqttPublications } from "./mqttPublications.js";
import { deliverAgentWebhook } from "./webhookTransport.js";

export function createDeliveryEngine(
  config: AgentConfig,
  state: AgentState,
  stateRepository: AgentStateRepository,
): DeliveryEngine {
  const handlers: { mqtt?: DeliveryHandler; webhook?: DeliveryHandler } = {};

  if (config.mqttUrl) {
    handlers.mqtt = async (_delivery, event) => {
      await publishAgentMqtt(
        { url: config.mqttUrl!, username: config.mqttUsername, password: config.mqttPassword },
        agentMqttPublications(event.payload),
      );
    };
  }

  if (config.webhookUrl) {
    handlers.webhook = async (_delivery, event) => {
      await deliverAgentWebhook(config.webhookUrl!, event.payload);
    };
  }

  return new DeliveryEngine(
    new DeliveryRepository(state, stateRepository),
    new OutboxRepository(state, stateRepository),
    handlers,
  );
}
