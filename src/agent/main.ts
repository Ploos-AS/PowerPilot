import { loadAgentConfig } from "./config.js";
import { createAgentServer, listenAgent } from "./server.js";

const config = loadAgentConfig();
const server = createAgentServer(config);

await listenAgent(server, config);
console.log(`PowerPilot Agent listening on http://${config.host}:${config.port}`);

const shutdown = (signal: string) => {
  console.log(`PowerPilot Agent received ${signal}; shutting down`);
  server.close((error?: Error) => {
    if (error) {
      console.error(error);
      process.exitCode = 1;
    }
  });
};

process.once("SIGTERM", () => shutdown("SIGTERM"));
process.once("SIGINT", () => shutdown("SIGINT"));
