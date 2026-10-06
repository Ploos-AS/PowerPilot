import { loadAgentConfig } from "./config.js";
import { createAgentServer, listenAgent } from "./server.js";
import { JsonFileStateStore } from "./jsonFileStateStore.js";
import { AgentStateRepository } from "./agentStateRepository.js";

const config = loadAgentConfig();
const server = createAgentServer(config);
const stateRepository = new AgentStateRepository(new JsonFileStateStore(config.statePath));
const state = await stateRepository.load();

await listenAgent(server, config);
console.log(`PowerPilot Agent listening on http://${config.host}:${config.port}; ${state.jobs.length} persisted jobs loaded`);

const shutdown = (signal: string) => {
  console.log(`PowerPilot Agent received ${signal}; shutting down`);
  server.close((error?: Error) => {
    if (error) {
      console.error(error);
      process.exitCode = 1;
      return;
    }
    try {
      await stateRepository.save(state);
    } catch (saveError) {
      console.error(saveError);
      process.exitCode = 1;
    }
  });
};

process.once("SIGTERM", () => shutdown("SIGTERM"));
process.once("SIGINT", () => shutdown("SIGINT"));
