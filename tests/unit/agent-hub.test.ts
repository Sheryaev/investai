import { describe, expect, it } from "vitest";
import { AgentHub } from "../../src/main/agents/agent-hub";
import { CliProvider } from "../../src/main/agents/cli-provider";
import { ProcessRunError } from "../../src/main/agents/process-runner";
import type { AgentEvent, AgentProvider, AgentProviderName, AgentRequest, ProcessRunner } from "../../src/main/agents/cli-types";

const request: AgentRequest = {
  prompt: "portfolio", workingDirectory: "C:\\runtime", agentProfilePath: "agent.md",
  emptyMcpConfigPath: "mcp.json", persistSession: false,
};

function provider(name: AgentProviderName, calls: string[]): AgentProvider {
  return {
    name,
    async *stream(): AsyncIterable<AgentEvent> {
      calls.push(name);
      yield { type: "text", text: name };
    },
  };
}

describe("AgentHub", () => {
  it("calls only the explicitly selected agent", async () => {
    const calls: string[] = [];
    const hub = new AgentHub({
      codex: provider("codex", calls), kimi: provider("kimi", calls), claude: provider("claude", calls),
    });
    const events = [];
    for await (const event of hub.stream("kimi", request, new AbortController().signal)) events.push(event);
    expect(calls).toEqual(["kimi"]);
    expect(events).toEqual([{ type: "text", text: "kimi" }]);
  });
});

describe("CLI process failures", () => {
  it("preserves timeout category and never emits done", async () => {
    const runner: ProcessRunner = {
      async *stream() { throw new ProcessRunError("timeout", "timeout"); },
    };
    const events = [];
    for await (const event of new CliProvider("codex", runner).stream(request, new AbortController().signal)) events.push(event);
    expect(events).toEqual([{ type: "error", category: "timeout", message: "Codex не ответил вовремя. Повторите запрос." }]);
  });
});
