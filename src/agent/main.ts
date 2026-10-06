import { loadAgentConfig } from "./config.js";
import { createAgentServer, listenAgent } from "./server.js";
import { JsonFileStateStore } from "./jsonFileStateStore.js";
import { AgentStateRepository } from "./agentStateRepository.js";
import { loadStateOrClose } from "./startup.js";
import { AgentJobRepository } from "./jobRepository.js";
import { createDeliveryEngine } from "./deliveryRuntime.js";
import { AgentWorker } from "./worker.js";

const config = loadAgentConfig();
let ready = false;
let jobs: AgentJobRepository | undefined;
const server = createAgentServer(config, { isReady: () => ready }, { get jobs() { return jobs; } });
const stateRepository = new AgentStateRepository(new JsonFileStateStore(config.statePath));
await listenAgent(server, config);
const state = await loadStateOrClose(server, stateRepository);
jobs = new AgentJobRepository(state, stateRepository);

const deliveryEngine = createDeliveryEngine(config, state, stateRepository);
const worker = new AgentWorker(async () => {
  const result = await deliveryEngine.runOnce();
  if (result.delivered || result.failed) {
    console.log(`PowerPilot Agent delivery: ${result.delivered} delivered, ${result.failed} failed`);
  }
}, config.workerIntervalMs);

await worker.start();
ready = true;
console.log(`PowerPilot Agent listening on http://${config.host}:${config.port}; ${state.jobs.length} persisted jobs loaded`);

let shuttingDown = false;
const shutdown = async (signal: string) => {
  if (shuttingDown) return;
  shuttingDown = true;
  ready = false;
  worker.stop();
  console.log(`PowerPilot Agent received ${signal}; shutting down`);
  await new Promise<void>((resolve, reject) => {
    server.close(error => error ? reject(error) : resolve());
  });
  await stateRepository.save(state);
};

for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.once(signal, () => {
    void shutdown(signal).catch(error => {
      console.error(error);
      process.exitCode = 1;
    });
  });
}
