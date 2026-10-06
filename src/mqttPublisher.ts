import mqtt from "mqtt";
import type { AutomationEvent } from "./automation";
import { mqttPublications, type MqttPublication } from "./mqtt";

export type MqttPublishResult =
  | { ok: true; published: number }
  | { ok: false; error: string };

export type MqttLikeClient = {
  publish(topic: string, payload: string, options: { retain: boolean }, callback: (error?: Error) => void): void;
  end(force?: boolean): void;
};

export async function publishMqttPublications(
  url: string,
  publications: MqttPublication[],
  connect: (url: string) => MqttLikeClient = mqtt.connect as unknown as (url: string) => MqttLikeClient,
): Promise<MqttPublishResult> {
  if (!url) return { ok: false, error: "MQTT WebSocket URL is empty" };

  const client = connect(url);
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
    return { ok: true, published: publications.length };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "MQTT publish failed" };
  } finally {
    client.end();
  }
}

export async function publishMqtt(
  url: string,
  event: AutomationEvent,
  connect: (url: string) => MqttLikeClient = mqtt.connect as unknown as (url: string) => MqttLikeClient,
): Promise<MqttPublishResult> {
  return publishMqttPublications(url, mqttPublications(event), connect);
}
