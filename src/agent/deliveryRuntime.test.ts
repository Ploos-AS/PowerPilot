import { createServer } from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { emptyAgentState } from "./agentState";
import { AgentStateRepository } from "./agentStateRepository";
import { JsonFileStateStore } from "./jsonFileStateStore";
import { OutboxRepository } from "./outboxRepository";
import { createDeliveryEngine } from "./deliveryRuntime";
import type { AgentConfig } from "./config";

describe("delivery runtime restart", () => {
  it("persists a failed webhook and delivers it after restart", async () => {
    const dir = await mkdtemp(join(tmpdir(), "powerpilot-delivery-"));
    const statePath = join(dir, "state.json");
    let requests = 0;
    const webhook = createServer((_request, response) => {
      requests++;
      response.statusCode = requests === 1 ? 500 : 200;
      response.end();
    });
    await new Promise<void>(resolve => webhook.listen(0, "127.0.0.1", resolve));
    const address = webhook.address();
    if (!address || typeof address === "string") throw new Error("Missing webhook address");
    const config: AgentConfig = {
      host: "127.0.0.1", port: 8787, statePath,
      webhookUrl: `http://127.0.0.1:${address.port}`,
      workerIntervalMs: 5000,
    };

    try {
      const repository1 = new AgentStateRepository(new JsonFileStateStore(statePath));
      const state1 = emptyAgentState();
      await repository1.save(state1);
      await new OutboxRepository(state1, repository1).enqueue({
        id: "restart-event",
        kind: "automation",
        createdAt: "2026-10-06T20:00:00.000Z",
        payload: {
          schema: "powerpilot.automation.v1",
          id: "restart-event",
          area: "NO2",
          startsAt: "2026-10-06T21:00:00.000Z",
          orePerKwh: -2,
          signal: "negative",
          policy: "ALLOW_LOW_PRIORITY_COMPUTE",
        },
      }, ["webhook"]);

      const firstAttemptAt = new Date("2026-10-06T20:00:00.000Z");
      await expect(createDeliveryEngine(config, state1, repository1).runOnce(firstAttemptAt)).resolves.toMatchObject({
        delivered: 0, failed: 1,
      });

      const repository2 = new AgentStateRepository(new JsonFileStateStore(statePath));
      const state2 = await repository2.load();
      expect(state2.outbox).toHaveLength(1);
      expect(state2.deliveries[0]).toMatchObject({
        status: "pending",
        attempts: 1,
        nextAttemptAt: "2026-10-06T20:00:05.000Z",
      });

      const restartedEngine = createDeliveryEngine(config, state2, repository2);
      await expect(restartedEngine.runOnce(new Date("2026-10-06T20:00:04.999Z"))).resolves.toMatchObject({
        delivered: 0, failed: 0,
      });
      expect(requests).toBe(1);

      await expect(restartedEngine.runOnce(new Date("2026-10-06T20:00:05.000Z"))).resolves.toMatchObject({
        delivered: 1, failed: 0,
      });

      const repository3 = new AgentStateRepository(new JsonFileStateStore(statePath));
      const finalState = await repository3.load();
      expect(requests).toBe(2);
      expect(finalState.outbox).toEqual([]);
      expect(finalState.deliveries).toEqual([]);
    } finally {
      await new Promise<void>(resolve => webhook.close(() => resolve()));
      await rm(dir, { recursive: true, force: true });
    }
  });
});
