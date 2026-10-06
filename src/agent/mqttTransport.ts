import mqtt from "mqtt";
import type { MqttPublication } from "../mqtt.js";

export type AgentMqttConfig = {
  url: string;
  username?: string;
  password?: string;
};

export async function publishAgentMqtt(
  config: AgentMqttConfig,
  publications: MqttPublication[],
): Promise<void> {
  const client = mqtt.connect(config.url, {
    ...(config.username ? { username: config.username } : {}),
    ...(config.password ? { password: config.password } : {}),
  });

  try {
    for (const publication of publications) {
      await new Promise<void>((resolve, reject) => {
        client.publish(
          publication.topic,
          publication.payload,
          { retain: publication.retain },
          error => error ? reject(error) : resolve(),
        );
      });
    }
  } finally {
    await new Promise<void>(resolve => client.end(false, {}, () => resolve()));
  }
}
