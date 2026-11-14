import { describe, expect, it, vi } from "vitest";
import { buildCliCommand } from "../../src/main/agents/cli-commands";
import { CliJsonlParser } from "../../src/main/agents/cli-parsers";
import { CliDetector } from "../../src/main/agents/cli-detector";
import { CliProvider } from "../../src/main/agents/cli-provider";
import type { ProcessEvent, ProcessRunner, ProcessSpec } from "../../src/main/agents/cli-types";

class FakeRunner implements ProcessRunner {
  readonly specs: ProcessSpec[] = [];
  constructor(private readonly batches: ProcessEvent[][]) {}

  async *stream(spec: ProcessSpec): AsyncIterable<ProcessEvent> {
    this.specs.push(spec);
    for (const event of this.batches.shift() ?? []) yield event;
  }
}

describe("CLI commands", () => {
  it("uses read-only isolated Codex with stdin and no persistent session", () => {
    const command = buildCliCommand("codex", {
      prompt: "private portfolio", workingDirectory: "C:\\runtime", agentProfilePath: "C:\\runtime\\agent.md",
      emptyMcpConfigPath: "C:\\runtime\\mcp.json", persistSession: false,
    });
    expect(command.args).toEqual([
      "exec", "--json", "--sandbox", "read-only", "--skip-git-repo-check", "--ephemeral",
      "--ignore-rules", "--ignore-user-config", "-",
    ]);
    expect(command.input).toBe("private portfolio");
    expect(command.args).not.toContain("private portfolio");
  });

  it("disables all Kimi tools through an explicit agent profile", () => {
    const command = buildCliCommand("kimi", {
      prompt: "portfolio", workingDirectory: "C:\\runtime", agentProfilePath: "C:\\runtime\\agent.md",
      emptyMcpConfigPath: "C:\\runtime\\mcp.json", persistSession: false,
    });
    expect(command.args).toEqual(["-p", "portfolio", "--output-format", "stream-json", "--agent-file", "C:\\runtime\\agent.md"]);
  });

  it("disables Claude tools, MCP and session persistence", () => {
    const command = buildCliCommand("claude", {
      prompt: "private portfolio", workingDirectory: "C:\\runtime", agentProfilePath: "C:\\runtime\\agent.md",
      emptyMcpConfigPath: "C:\\runtime\\mcp.json", persistSession: false,
    });
    expect(command.args).toEqual(expect.arrayContaining(["--tools", "", "--disallowedTools", "mcp__*", "--no-session-persistence"]));
    expect(command.args).not.toContain("private portfolio");
    expect(command.input).toBe("private portfolio");
  });
});

describe("CLI JSONL parsers", () => {
  it("parses Codex messages across arbitrary chunks", () => {
    const parser = new CliJsonlParser("codex");
    expect(parser.push('{"type":"thread.started","thread_id":"thread-1"}\n{"type":"item.completed","item":{"type":"agent_message","text":"Ана')).toEqual([
      { type: "session", sessionId: "thread-1" },
    ]);
    expect(parser.push('лиз"}}\n')).toEqual([{ type: "text", text: "Анализ" }]);
  });

  it("parses Kimi assistant content and ignores tool messages", () => {
    const parser = new CliJsonlParser("kimi");
    expect(parser.push('{"type":"assistant","message":{"content":[{"type":"text","text":"Риски"}]}}\n{"type":"tool","content":"hidden"}\n')).toEqual([
      { type: "text", text: "Риски" },
    ]);
  });

  it("does not duplicate Claude partial and final assistant text", () => {
    const parser = new CliJsonlParser("claude");
    expect(parser.push('{"type":"system","subtype":"init","session_id":"session-1"}\n')).toEqual([
      { type: "session", sessionId: "session-1" },
    ]);
    expect(parser.push('{"type":"stream_event","event":{"type":"content_block_delta","delta":{"type":"text_delta","text":"Часть"}}}\n')).toEqual([
      { type: "text", text: "Часть" },
    ]);
    expect(parser.push('{"type":"assistant","message":{"content":[{"type":"text","text":"Часть"}]}}\n{"type":"result","subtype":"success","result":"Часть"}\n')).toEqual([]);
    expect(parser.finish()).toEqual([]);
  });

  it("uses Claude final result when partial events are unavailable", () => {
    const parser = new CliJsonlParser("claude");
    expect(parser.push('{"type":"result","subtype":"success","result":"Готово"}\n')).toEqual([
      { type: "text", text: "Готово" },
    ]);
    expect(parser.finish()).toEqual([]);
  });
});

describe("CliDetector and CliProvider", () => {
  it("marks version-only detection as installed rather than ready", async () => {
    const runner = new FakeRunner([
      [{ type: "stdout", text: "C:\\Users\\User\\kimi.exe\r\n" }, { type: "exit", code: 0 }],
      [{ type: "stdout", text: "kimi 2.0.0\n" }, { type: "exit", code: 0 }],
    ]);
    const detector = new CliDetector(runner, "C:\\runtime");
    expect(await detector.detectOne("kimi")).toMatchObject({ status: "installed", version: "2.0.0", path: "C:\\Users\\User\\kimi.exe" });
  });

  it("detects Codex login without sending a paid request", async () => {
    const runner = new FakeRunner([
      [{ type: "stdout", text: "C:\\codex.exe\r\n" }, { type: "exit", code: 0 }],
      [{ type: "stdout", text: "codex-cli 1.0.0\n" }, { type: "exit", code: 0 }],
      [{ type: "stdout", text: "Logged in using ChatGPT\n" }, { type: "exit", code: 0 }],
    ]);
    const detector = new CliDetector(runner, "C:\\runtime");
    expect(await detector.detectOne("codex")).toMatchObject({ status: "ready" });
    expect(runner.specs.map((spec) => spec.args)).toEqual([["codex"], ["--version"], ["login", "status"]]);
  });

  it("returns not installed for a missing executable", async () => {
    const runner = new FakeRunner([[{ type: "exit", code: 1 }]]);
    expect(await new CliDetector(runner, "C:\\runtime").detectOne("claude")).toMatchObject({ status: "not_installed" });
  });

  it("streams exactly the selected provider without fallback", async () => {
    const runner = new FakeRunner([[
      { type: "stdout", text: '{"type":"item.completed","item":{"type":"agent_message","text":"Анализ"}}\n' },
      { type: "exit", code: 0 },
    ]]);
    const provider = new CliProvider("codex", runner);
    const events = [];
    for await (const event of provider.stream({
      prompt: "portfolio", workingDirectory: "C:\\runtime", agentProfilePath: "agent.md",
      emptyMcpConfigPath: "mcp.json", persistSession: false,
    }, new AbortController().signal)) events.push(event);
    expect(events).toEqual([{ type: "text", text: "Анализ" }, { type: "done" }]);
    expect(runner.specs).toHaveLength(1);
  });

  it("turns authentication failures into actionable errors without exposing prompt", async () => {
    const runner = new FakeRunner([[{ type: "stderr", text: "Not logged in. Run codex login" }, { type: "exit", code: 1 }]]);
    const provider = new CliProvider("codex", runner);
    const events = [];
    for await (const event of provider.stream({
      prompt: "secret portfolio", workingDirectory: "C:\\runtime", agentProfilePath: "agent.md",
      emptyMcpConfigPath: "mcp.json", persistSession: false,
    }, new AbortController().signal)) events.push(event);
    expect(events).toEqual([{ type: "error", category: "auth", message: "Требуется вход в Codex. Выполните в терминале: codex login" }]);
    expect(JSON.stringify(events)).not.toContain("secret portfolio");
  });
});
