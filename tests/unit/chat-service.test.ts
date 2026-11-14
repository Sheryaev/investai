import { describe, expect, it } from "vitest";
import { AgentHub } from "../../src/main/agents/agent-hub";
import { ChatService } from "../../src/main/agents/chat-service";
import type { AgentEvent, AgentProvider, AgentRequest } from "../../src/main/agents/cli-types";
import { ChatRepository } from "../../src/main/database/chat-repository";
import { Database } from "../../src/main/database/database";
import { fixtureSnapshot } from "./fixtures";

const runtime = { workingDirectory: "C:\\empty", agentProfilePath: "C:\\agent.md", emptyMcpConfigPath: "C:\\mcp.json" };

function provider(name: "codex" | "kimi" | "claude", requests: AgentRequest[]): AgentProvider {
  return {
    name,
    async *stream(request): AsyncIterable<AgentEvent> {
      requests.push(request);
      yield { type: "text", text: "Первый" };
      yield { type: "text", text: " ответ" };
      yield { type: "done" };
    },
  };
}

describe("ChatService", () => {
  it("automatically sends anonymized context and persists the streamed answer", async () => {
    const requests: AgentRequest[] = [];
    const hub = new AgentHub({ codex: provider("codex", requests), kimi: provider("kimi", requests), claude: provider("claude", requests) });
    const database = new Database(":memory:");
    const repository = new ChatRepository(database);
    const service = new ChatService(hub, repository, runtime, () => fixtureSnapshot);
    const events: AgentEvent[] = [];
    const result = await service.send("kimi", "Найди риски", (event) => events.push(event), new AbortController().signal);
    expect(result).toMatchObject({ role: "assistant", provider: "kimi", content: "Первый ответ", snapshotId: fixtureSnapshot.id });
    expect(events.map((event) => event.type)).toEqual(["text", "text", "done"]);
    expect(requests).toHaveLength(1);
    expect(requests[0].prompt).toContain("Найди риски");
    expect(requests[0].prompt).not.toContain("raw-account-1");
    expect(requests[0].persistSession).toBe(false);
    expect(repository.list()).toHaveLength(2);
    database.close();
  });

  it("fails locally when there is no portfolio snapshot", async () => {
    const requests: AgentRequest[] = [];
    const hub = new AgentHub({ codex: provider("codex", requests), kimi: provider("kimi", requests), claude: provider("claude", requests) });
    const database = new Database(":memory:");
    const service = new ChatService(hub, new ChatRepository(database), runtime, () => null);
    await expect(service.send("codex", "Анализ", () => undefined, new AbortController().signal)).rejects.toThrow(/портфель/i);
    expect(requests).toHaveLength(0);
    database.close();
  });
});
