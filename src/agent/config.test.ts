import { describe, expect, it } from "vitest";
import { loadAgentConfig } from "./config";

describe("agent config", () => {
  it("uses safe network defaults", () => {
    expect(loadAgentConfig({})).toEqual({ host: "0.0.0.0", port: 8787 });
  });

  it("accepts explicit host and port", () => {
    expect(loadAgentConfig({
      POWERPILOT_AGENT_HOST: "127.0.0.1",
      POWERPILOT_AGENT_PORT: "9000",
    })).toEqual({ host: "127.0.0.1", port: 9000 });
  });

  it.each(["0", "65536", "abc", "12.5"])("rejects invalid port %s", port => {
    expect(() => loadAgentConfig({ POWERPILOT_AGENT_PORT: port })).toThrow(
      "POWERPILOT_AGENT_PORT",
    );
  });
});
