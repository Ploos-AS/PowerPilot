import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { JsonFileStateStore } from "./jsonFileStateStore";

const directories: string[] = [];

afterEach(async () => {
  await Promise.all(directories.splice(0).map(path => rm(path, { recursive: true, force: true })));
});

describe("JsonFileStateStore", () => {
  it("returns undefined when state does not exist", async () => {
    const directory = await mkdtemp(join(tmpdir(), "powerpilot-state-"));
    directories.push(directory);
    const store = new JsonFileStateStore<{ value: number }>(join(directory, "state.json"));
    await expect(store.load()).resolves.toBeUndefined();
  });

  it("persists and reloads state", async () => {
    const directory = await mkdtemp(join(tmpdir(), "powerpilot-state-"));
    directories.push(directory);
    const path = join(directory, "nested", "state.json");
    const store = new JsonFileStateStore<{ jobs: string[] }>(path);

    await store.save({ jobs: ["render-1", "backup-1"] });

    await expect(store.load()).resolves.toEqual({ jobs: ["render-1", "backup-1"] });
    expect(JSON.parse(await readFile(path, "utf8"))).toEqual({
      jobs: ["render-1", "backup-1"],
    });
  });

  it("propagates invalid JSON instead of silently discarding state", async () => {
    const directory = await mkdtemp(join(tmpdir(), "powerpilot-state-"));
    directories.push(directory);
    const path = join(directory, "state.json");
    const store = new JsonFileStateStore(path);

    await import("node:fs/promises").then(({ writeFile }) => writeFile(path, "{broken"));
    await expect(store.load()).rejects.toThrow();
  });
});
