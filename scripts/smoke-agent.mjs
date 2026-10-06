import { spawn } from "node:child_process";

const port = "18787";
const child = spawn(process.execPath, ["dist-agent/agent/main.js"], {
  env: {
    ...process.env,
    POWERPILOT_AGENT_HOST: "127.0.0.1",
    POWERPILOT_AGENT_PORT: port,
  },
  stdio: ["ignore", "pipe", "pipe"],
});

let output = "";
child.stdout.on("data", chunk => { output += chunk.toString(); });
child.stderr.on("data", chunk => { output += chunk.toString(); });

async function waitFor(path) {
  for (let attempt = 0; attempt < 50; attempt++) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}${path}`);
      if (response.status === 200) return response;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error(`${path} did not become ready\n${output}`);
}

try {
  const health = await waitFor("/healthz");
  const ready = await waitFor("/readyz");
  if ((await health.json()).status !== "ok") throw new Error("invalid health response");
  if ((await ready.json()).status !== "ready") throw new Error("invalid readiness response");

  child.kill("SIGTERM");
  const exitCode = await new Promise(resolve => child.once("exit", resolve));
  if (exitCode !== 0) throw new Error(`agent exited with ${exitCode}\n${output}`);
  console.log("PowerPilot Agent smoke test passed");
} catch (error) {
  child.kill("SIGKILL");
  console.error(error);
  process.exitCode = 1;
}
