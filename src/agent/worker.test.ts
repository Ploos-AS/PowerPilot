import { describe, expect, it } from "vitest";
import { AgentWorker } from "./worker";

describe("AgentWorker", () => {
  it("waits for an in-flight iteration when stopped", async () => {
    let release!: () => void;
    let started!: () => void;
    const startedPromise = new Promise<void>(resolve => { started = resolve; });
    const task = new Promise<void>(resolve => { release = resolve; });
    const worker = new AgentWorker(async () => {
      started();
      await task;
    }, 60_000);

    const starting = worker.start();
    await startedPromise;
    let stopped = false;
    const stopping = worker.stop().then(() => { stopped = true; });
    await Promise.resolve();
    expect(stopped).toBe(false);

    release();
    await Promise.all([starting, stopping]);
    expect(stopped).toBe(true);
  });
});
