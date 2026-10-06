import { describe, expect, it } from "vitest";
import { createServer } from "node:http";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AgentStateRepository } from "./agentStateRepository";
import { JsonFileStateStore } from "./jsonFileStateStore";
import { loadStateOrClose } from "./startup";

describe("agent startup", () => {
  it("closes the server and preserves corrupt state when loading fails", async () => {
    const directory = await mkdtemp(join(tmpdir(), "powerpilot-startup-"));
    const path = join(directory, "state.json");
    const original = "{broken";
    await writeFile(path, original);

    const server = createServer();
    await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
    const repository = new AgentStateRepository(new JsonFileStateStore(path));

    await expect(loadStateOrClose(server, repository)).rejects.toThrow();
    expect(server.listening).toBe(false);
    await expect(readFile(path, "utf8")).resolves.toBe(original);

    await rm(directory, { recursive: true, force: true });
  });

  it("keeps the server listening when valid state loads", async () => {
    const directory = await mkdtemp(join(tmpdir(), "powerpilot-startup-"));
    const path = join(directory, "state.json");
    await writeFile(path, JSON.stringify({
      schema: "powerpilot.agent-state.v1",
      jobs: [],
      savings: [],
      deliveries: [],
    }));

    const server = createServer();
    await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
    const repository = new AgentStateRepository(new JsonFileStateStore(path));

    await expect(loadStateOrClose(server, repository)).resolves.toMatchObject({
      schema: "powerpilot.agent-state.v1",
    });
    expect(server.listening).toBe(true);

    await new Promise<void>(resolve => server.close(() => resolve()));
    await rm(directory, { recursive: true, force: true });
  });
});
