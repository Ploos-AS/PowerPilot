import { loadAgentConfig } from "./config.js";
import { createAgentServer, listenAgent } from "./server.js";
import { JsonFileStateStore } from "./jsonFileStateStore.js";
import { AgentStateRepository } from "./agentStateRepository.js";
import { loadStateOrClose } from "./startup.js";

const config = loadAgentConfig();
let ready = false;
const server = createAgentServer(config, { isReady: () => ready });
const stateRepository = new AgentStateRepository(new JsonFileStateStore(config.statePath));
await listenAgent(server, config);
const state = await loadStateOrClose(server, stateRepository);
ready = true;
console.log(`PowerPilot Agent listening on http://${config.host}:${config.port}; ${state.jobs.length} persisted jobs loaded`);

const shutdown = (signal: string) => {
  ready = false;
  console.log(`PowerPilot Agent received ${signal}; shutting down`);
  server.close((error?: Error) => {
    if (error) {
      console.error(error);
      process.exitCode = 1;
      return;
    }
    void stateRepository.save(state).catch(saveError => {
      console.error(saveError);
      process.exitCode = 1;
    });
  });
};

process.once("SIGTERM", () => shutdown("SIGTERM"));
process.once("SIGINT", () => shutdown("SIGINT"));
