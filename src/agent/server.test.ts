import { afterEach, describe, expect, it } from "vitest";
import type { AddressInfo } from "node:net";
import { createAgentServer, listenAgent } from "./server";

const servers: ReturnType<typeof createAgentServer>[] = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map(server => new Promise<void>(resolve => {
    server.close(() => resolve());
  })));
  it("keeps probes open while requiring the configured bearer token for mutations", async () => {
    const config = { host: "127.0.0.1", port: 0, statePath: "unused", apiToken: "test-token" };
    const jobs = {
      list: () => [],
      put: async () => undefined,
      delete: async () => false,
    } as any;
    const server = createAgentServer(config, { isReady: () => true }, { jobs });
    servers.push(server);
    await listenAgent(server, config);
    const port = (server.address() as AddressInfo).port;
    const base = `http://127.0.0.1:${port}`;

    expect((await fetch(`${base}/healthz`)).status).toBe(200);
    expect((await fetch(`${base}/readyz`)).status).toBe(200);
    expect((await fetch(`${base}/api/v1/jobs`)).status).toBe(200);

    const denied = await fetch(`${base}/api/v1/jobs/test`, { method: "DELETE" });
    expect(denied.status).toBe(401);
    expect(denied.headers.get("www-authenticate")).toBe("Bearer");

    const allowed = await fetch(`${base}/api/v1/jobs/test`, {
      method: "DELETE",
      headers: { authorization: "Bearer test-token" },
    });
    expect(allowed.status).toBe(404);
  });

  it("rejects oversized JSON bodies with 413", async () => {
    const config = { host: "127.0.0.1", port: 0, statePath: "unused" };
    const jobs = { list: () => [], put: async () => undefined, delete: async () => false } as any;
    const server = createAgentServer(config, { isReady: () => true }, { jobs });
    servers.push(server);
    await listenAgent(server, config);
    const port = (server.address() as AddressInfo).port;

    const response = await fetch(`http://127.0.0.1:${port}/api/v1/jobs`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: "x", padding: "x".repeat(70 * 1024) }),
    });
    expect(response.status).toBe(413);
  });

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
