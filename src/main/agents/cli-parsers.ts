import type { AgentEvent, AgentProviderName } from "./cli-types";

export class CliJsonlParser {
  private buffer = "";
  private emittedText = false;
  private sawPartialText = false;

  constructor(private readonly provider: AgentProviderName) {}

  push(chunk: string): AgentEvent[] {
    this.buffer += chunk;
    const lines = this.buffer.split(/\r?\n/);
    this.buffer = lines.pop() ?? "";
    return lines.flatMap((line) => this.parseLine(line));
  }

  finish(): AgentEvent[] {
    const events = this.buffer.trim() ? this.parseLine(this.buffer) : [];
    this.buffer = "";
    return events;
  }

  private parseLine(line: string): AgentEvent[] {
    if (!line.trim()) return [];
    let value: any;
    try {
      value = JSON.parse(line);
    } catch {
      return [{ type: "error", category: "provider", message: "CLI вернул некорректный JSONL-ответ." }];
    }
    if (this.provider === "codex") return this.parseCodex(value);
    if (this.provider === "kimi") return this.parseKimi(value);
    return this.parseClaude(value);
  }

  private parseCodex(value: any): AgentEvent[] {
    if (value.type === "thread.started" && typeof value.thread_id === "string") {
      return [{ type: "session", sessionId: value.thread_id }];
    }
    if (value.type === "item.completed" && value.item?.type === "agent_message" && typeof value.item.text === "string") {
      this.emittedText = true;
      return [{ type: "text", text: value.item.text }];
    }
    if (value.type === "error" || value.type === "turn.failed") {
      return [{ type: "error", category: "provider", message: "Codex не завершил анализ. Повторите запрос." }];
    }
    return [];
  }

  private parseKimi(value: any): AgentEvent[] {
    if (value.type !== "assistant") return [];
    const content = value.message?.content;
    const text = typeof content === "string"
      ? content
      : Array.isArray(content)
        ? content.filter((part: any) => part?.type === "text" && typeof part.text === "string").map((part: any) => part.text).join("")
        : "";
    if (!text) return [];
    this.emittedText = true;
    return [{ type: "text", text }];
  }

  private parseClaude(value: any): AgentEvent[] {
    if (value.type === "system" && typeof value.session_id === "string") {
      return [{ type: "session", sessionId: value.session_id }];
    }
    if (value.type === "stream_event" && value.event?.type === "content_block_delta" && typeof value.event.delta?.text === "string") {
      this.sawPartialText = true;
      this.emittedText = true;
      return [{ type: "text", text: value.event.delta.text }];
    }
    if (value.type === "assistant" && !this.sawPartialText) {
      const content = value.message?.content;
      const text = Array.isArray(content)
        ? content.filter((part: any) => part?.type === "text" && typeof part.text === "string").map((part: any) => part.text).join("")
        : "";
      if (text) {
        this.emittedText = true;
        return [{ type: "text", text }];
      }
    }
    if (value.type === "result") {
      if (value.is_error || (value.subtype && value.subtype !== "success")) {
        return [{ type: "error", category: "provider", message: "Claude не завершил анализ. Повторите запрос." }];
      }
      if (!this.emittedText && typeof value.result === "string" && value.result) {
        this.emittedText = true;
        return [{ type: "text", text: value.result }];
      }
    }
    return [];
  }
}
