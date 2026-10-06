import { createServer } from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { emptyAgentState } from "./agentState";
import { AgentStateRepository } from "./agentStateRepository";
import { JsonFileStateStore } from "./jsonFileStateStore";
import { OutboxRepository } from "./outboxRepository";
import { createAgentServer, listenAgent } from "./server";
import { createDeliveryEngine } from "./deliveryRuntime";
import type { AgentConfig } from "./config";

describe("automation API delivery integration", () => {
  it("queues through HTTP, persists, and delivers through the worker engine", async () => {
    const dir = await mkdtemp(join(tmpdir(), "powerpilot-api-delivery-"));
    const statePath = join(dir, "state.json");
    let body = "";
    const webhook = createServer(async (request, response) => {
      for await (const chunk of request) body += chunk;
      response.statusCode = 200;
      response.end();
    });
    await new Promise<void>(resolve => webhook.listen(0, "127.0.0.1", resolve));
    const webhookAddress = webhook.address();
    if (!webhookAddress || typeof webhookAddress === "string") throw new Error("Missing webhook address");

    const config: AgentConfig = {
      host: "127.0.0.1", port: 0, statePath,
      webhookUrl: `http://127.0.0.1:${webhookAddress.port}`,
      workerIntervalMs: 5000,
    };
    const stateRepository = new AgentStateRepository(new JsonFileStateStore(statePath));
    const state = emptyAgentState();
    await stateRepository.save(state);
    const outbox = new OutboxRepository(state, stateRepository);
    const server = createAgentServer(config, { isReady: () => true }, {
      outbox,
      automationTransports: ["webhook"],
    });

    try {
      await listenAgent(server, config);
      const address = server.address();
      if (!address || typeof address === "string") throw new Error("Missing Agent address");
      const event = {
        schema: "powerpilot.automation.v1",
        id: "api-event",
        area: "NO2",
        startsAt: "2026-10-06T21:00:00.000Z",
        orePerKwh: 8,
        signal: "favourable",
        policy: "ALLOW_LOW_PRIORITY_COMPUTE",
      };

      const response = await fetch(`http://127.0.0.1:${address.port}/api/v1/automation-events`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(event),
      });
      expect(response.status).toBe(202);

      const persisted = await new AgentStateRepository(new JsonFileStateStore(statePath)).load();
      expect(persisted.outbox).toHaveLength(1);
      expect(persisted.deliveries).toHaveLength(1);

      await createDeliveryEngine(config, state, stateRepository).runOnce(new Date());
      expect(JSON.parse(body)).toEqual(event);

      const finalState = await new AgentStateRepository(new JsonFileStateStore(statePath)).load();
      expect(finalState.outbox).toEqual([]);
      expect(finalState.deliveries).toEqual([]);
    } finally {
      await new Promise<void>(resolve => server.close(() => resolve()));
      await new Promise<void>(resolve => webhook.close(() => resolve()));
      await rm(dir, { recursive: true, force: true });
    }
  });
});
