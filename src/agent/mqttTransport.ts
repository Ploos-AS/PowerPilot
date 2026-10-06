import mqtt from "mqtt";

export type AgentMqttConfig = {
  url: string;
  username?: string;
  password?: string;
};

export type AgentMqttPublication = {
  topic: string;
  payload: string;
  retain: boolean;
};

export async function publishAgentMqtt(
  config: AgentMqttConfig,
  publications: AgentMqttPublication[],
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
