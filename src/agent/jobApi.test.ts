import { afterEach, describe, expect, it } from "vitest";
import type { AddressInfo } from "node:net";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createAgentServer, listenAgent } from "./server";
import { JsonFileStateStore } from "./jsonFileStateStore";
import { AgentStateRepository } from "./agentStateRepository";
import { AgentJobRepository } from "./jobRepository";
import { emptyAgentState } from "./agentState";

const directories: string[] = [];
const servers: ReturnType<typeof createAgentServer>[] = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map(server => new Promise<void>(resolve => {
    if (!server.listening) return resolve();
    server.close(() => resolve());
  })));
  await Promise.all(directories.splice(0).map(path => rm(path, { recursive: true, force: true })));
});

async function start(statePath: string) {
  const stateRepository = new AgentStateRepository(new JsonFileStateStore(statePath));
  const state = await stateRepository.load();
  const jobs = new AgentJobRepository(state, stateRepository);
  const config = { host: "127.0.0.1", port: 0, statePath };
  const server = createAgentServer(config, { isReady: () => true }, { jobs });
  servers.push(server);
  await listenAgent(server, config);
  const port = (server.address() as AddressInfo).port;
  return { server, baseUrl: `http://127.0.0.1:${port}`, stateRepository };
}

describe("persistent job API", () => {
  it("persists PUT across restart and DELETE removes it durably", async () => {
    const directory = await mkdtemp(join(tmpdir(), "powerpilot-job-api-"));
    directories.push(directory);
    const statePath = join(directory, "state.json");
    const initialRepository = new AgentStateRepository(new JsonFileStateStore(statePath));
    await initialRepository.save(emptyAgentState());

    const first = await start(statePath);
    const job = {
      id: "render-nightly",
      durationMinutes: 120,
      earliestStart: "2026-10-06T20:00:00.000Z",
      deadline: "2026-10-07T06:00:00.000Z",
      priority: "normal",
      pool: "render",
      estimatedPowerWatts: 180,
    };

    const put = await fetch(`${first.baseUrl}/api/v1/jobs`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(job),
    });
    expect(put.status).toBe(200);

    const beforeRestart = await fetch(`${first.baseUrl}/api/v1/jobs`);
    await expect(beforeRestart.json()).resolves.toEqual({ jobs: [job] });

    await new Promise<void>(resolve => first.server.close(() => resolve()));

    const second = await start(statePath);
    const afterRestart = await fetch(`${second.baseUrl}/api/v1/jobs`);
    await expect(afterRestart.json()).resolves.toEqual({ jobs: [job] });

    const deleted = await fetch(`${second.baseUrl}/api/v1/jobs/${encodeURIComponent(job.id)}`, {
      method: "DELETE",
    });
    expect(deleted.status).toBe(204);

    await new Promise<void>(resolve => second.server.close(() => resolve()));

    const finalRepository = new AgentStateRepository(new JsonFileStateStore(statePath));
    await expect(finalRepository.load()).resolves.toMatchObject({ jobs: [] });
  });

  it("rejects invalid jobs without persisting them", async () => {
    const directory = await mkdtemp(join(tmpdir(), "powerpilot-job-api-"));
    directories.push(directory);
    const statePath = join(directory, "state.json");
    const repository = new AgentStateRepository(new JsonFileStateStore(statePath));
    await repository.save(emptyAgentState());
    const running = await start(statePath);

    const response = await fetch(`${running.baseUrl}/api/v1/jobs`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        id: "bad",
        durationMinutes: 30,
        earliestStart: "2026-10-06T20:00:00.000Z",
        deadline: "2026-10-07T06:00:00.000Z",
        priority: "normal",
      }),
    });
    expect(response.status).toBe(400);

    const persisted = await new AgentStateRepository(new JsonFileStateStore(statePath)).load();
    expect(persisted.jobs).toEqual([]);
  });
});
