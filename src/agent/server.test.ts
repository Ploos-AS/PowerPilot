import { afterEach, describe, expect, it } from "vitest";
import type { AddressInfo } from "node:net";
import { createAgentServer, listenAgent } from "./server";

const servers: ReturnType<typeof createAgentServer>[] = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map(server => new Promise<void>(resolve => {
    server.close(() => resolve());
  })));
});

describe("agent server readiness", () => {
  it("is healthy while not ready, then becomes ready explicitly", async () => {
    let ready = false;
    const config = { host: "127.0.0.1", port: 0, statePath: "unused" };
    const server = createAgentServer(config, { isReady: () => ready });
    servers.push(server);
    await listenAgent(server, config);
    const port = (server.address() as AddressInfo).port;

    const health = await fetch(`http://127.0.0.1:${port}/healthz`);
    expect(health.status).toBe(200);
    await expect(health.json()).resolves.toEqual({ status: "ok" });

    const starting = await fetch(`http://127.0.0.1:${port}/readyz`);
    expect(starting.status).toBe(503);
    await expect(starting.json()).resolves.toEqual({ status: "starting" });

    ready = true;
    const available = await fetch(`http://127.0.0.1:${port}/readyz`);
    expect(available.status).toBe(200);
    await expect(available.json()).resolves.toEqual({ status: "ready" });
  });
});
