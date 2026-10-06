import { createServer, type Server } from "node:http";
import type { AgentConfig } from "./config.js";
import type { AgentJobRepository } from "./jobRepository.js";
import { parseJob } from "./jobValidation.js";

export type AgentReadiness = {
  isReady(): boolean;
};

export type AgentServerDependencies = {
  jobs?: AgentJobRepository;
};

async function readJson(request: import("node:http").IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

export function createAgentServer(
  config: AgentConfig,
  readiness: AgentReadiness = { isReady: () => false },
  dependencies: AgentServerDependencies = {},
): Server {
  return createServer(async (request, response) => {
    if (request.method === "GET" && request.url === "/healthz") {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ status: "ok" }));
      return;
    }

    if (request.method === "GET" && request.url === "/readyz") {
      const ready = readiness.isReady();
      response.writeHead(ready ? 200 : 503, { "content-type": "application/json" });
      response.end(JSON.stringify({ status: ready ? "ready" : "starting" }));
      return;
    }

    if (request.url === "/api/v1/jobs" && request.method === "GET" && dependencies.jobs) {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ jobs: dependencies.jobs.list() }));
      return;
    }

    if (request.url === "/api/v1/jobs" && request.method === "PUT" && dependencies.jobs) {
      try {
        const job = parseJob(await readJson(request));
        await dependencies.jobs.put(job);
        response.writeHead(200, { "content-type": "application/json" });
        response.end(JSON.stringify({ job }));
      } catch (error) {
        response.writeHead(error instanceof SyntaxError || (error instanceof Error && error.message.startsWith("job")) ? 400 : 500, { "content-type": "application/json" });
        response.end(JSON.stringify({ error: error instanceof Error ? error.message : "job update failed" }));
      }
      return;
    }

    if (request.method === "DELETE" && request.url?.startsWith("/api/v1/jobs/") && dependencies.jobs) {
      const id = decodeURIComponent(request.url.slice("/api/v1/jobs/".length));
      if (!id) {
        response.writeHead(400, { "content-type": "application/json" });
        response.end(JSON.stringify({ error: "job id is required" }));
        return;
      }
      try {
        const deleted = await dependencies.jobs.delete(id);
        response.writeHead(deleted ? 204 : 404);
        response.end();
      } catch {
        response.writeHead(500, { "content-type": "application/json" });
        response.end(JSON.stringify({ error: "job delete failed" }));
      }
      return;
    }

    response.writeHead(404, { "content-type": "application/json" });
    response.end(JSON.stringify({ error: "not_found" }));
  });
}

export function listenAgent(server: Server, config: AgentConfig): Promise<void> {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(config.port, config.host, () => {
      server.off("error", reject);
      resolve();
    });
  });
}
