import { loadAgentConfig } from "./config.js";
import { createAgentServer, listenAgent } from "./server.js";
import { JsonFileStateStore } from "./jsonFileStateStore.js";
import { AgentStateRepository } from "./agentStateRepository.js";
import { loadStateOrClose } from "./startup.js";
import { AgentJobRepository } from "./jobRepository.js";
import { createDeliveryEngine } from "./deliveryRuntime.js";
import { AgentWorker } from "./worker.js";
import { OutboxRepository } from "./outboxRepository.js";
import type { DeliveryTransport } from "./deliveryRepository.js";
import { PricePoller } from "./pricePoller.js";
import { hvaKosterStrommenProvider } from "../priceProvider.js";

const config = loadAgentConfig();
let ready = false;
let jobs: AgentJobRepository | undefined;
let outbox: OutboxRepository | undefined;
const automationTransports: DeliveryTransport[] = [
  ...(config.mqttUrl ? ["mqtt" as const] : []),
  ...(config.webhookUrl ? ["webhook" as const] : []),
];
const server = createAgentServer(config, { isReady: () => ready }, {
  get jobs() { return jobs; },
  get outbox() { return outbox; },
  automationTransports,
});
const stateRepository = new AgentStateRepository(new JsonFileStateStore(config.statePath));
await listenAgent(server, config);
const state = await loadStateOrClose(server, stateRepository);
jobs = new AgentJobRepository(state, stateRepository);
outbox = new OutboxRepository(state, stateRepository);

const deliveryEngine = createDeliveryEngine(config, state, stateRepository);
const deliveryWorker = new AgentWorker(async () => {
  const result = await deliveryEngine.runOnce();
  if (result.delivered || result.failed) {
    console.log(`PowerPilot Agent delivery: ${result.delivered} delivered, ${result.failed} failed`);
  }
}, config.workerIntervalMs);
const pricePoller = new PricePoller(hvaKosterStrommenProvider, outbox, config.priceArea, automationTransports);
const priceWorker = new AgentWorker(async () => {
  const enqueued = await pricePoller.poll();
  if (enqueued) console.log(`PowerPilot Agent price: ${config.priceArea} automation event queued`);
}, config.pricePollIntervalMs);

await deliveryWorker.start();
await priceWorker.start();
ready = true;
console.log(`PowerPilot Agent listening on http://${config.host}:${config.port}; ${state.jobs.length} persisted jobs loaded`);

let shuttingDown = false;
const shutdown = async (signal: string) => {
  if (shuttingDown) return;
  shuttingDown = true;
  ready = false;
  await Promise.all([priceWorker.stop(), deliveryWorker.stop()]);
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
