import { buildCliCommand } from "./cli-commands";
import { CliJsonlParser } from "./cli-parsers";
import { ProcessRunError } from "./process-runner";
import type { AgentEvent, AgentProvider, AgentProviderName, AgentRequest, ProcessRunner } from "./cli-types";

const loginInstructions: Record<AgentProviderName, string> = {
  codex: "Требуется вход в Codex. Выполните в терминале: codex login",
  kimi: "Требуется вход в Kimi. Выполните в терминале: kimi login",
  claude: "Требуется вход в Claude. Запустите claude в терминале и выполните вход.",
};

const labels: Record<AgentProviderName, string> = { codex: "Codex", kimi: "Kimi", claude: "Claude" };

export class CliProvider implements AgentProvider {
  constructor(readonly name: AgentProviderName, private readonly runner: ProcessRunner) {}

  async *stream(request: AgentRequest, signal: AbortSignal): AsyncIterable<AgentEvent> {
    const parser = new CliJsonlParser(this.name);
    const command = buildCliCommand(this.name, request);
    let stderr = "";
    let exitCode: number | null = null;
    try {
      for await (const event of this.runner.stream({ ...command, timeoutMs: 120_000 }, signal)) {
        if (event.type === "stderr") {
          stderr += event.text;
          continue;
        }
        if (event.type === "exit") {
          exitCode = event.code;
          continue;
        }
        for (const parsed of parser.push(event.text)) yield parsed;
      }
    } catch (error) {
      if (signal.aborted || (error instanceof ProcessRunError && error.category === "cancelled")) {
        yield { type: "error", category: "cancelled", message: "Генерация остановлена." };
        return;
      }
      if (error instanceof ProcessRunError && error.category === "timeout") {
        yield { type: "error", category: "timeout", message: `${labels[this.name]} не ответил вовремя. Повторите запрос.` };
        return;
      }
      yield { type: "error", category: "provider", message: `Не удалось запустить ${labels[this.name]}. Проверьте установку и вход.` };
      return;
    }
    if (exitCode !== 0) {
      const auth = /not logged|unauthori[sz]ed|authentication|login required|войдите|авториз/i.test(stderr);
      yield {
        type: "error",
        category: auth ? "auth" : "provider",
        message: auth ? loginInstructions[this.name] : `${this.name} завершился с ошибкой. Проверьте вход и повторите запрос.`,
      };
      return;
    }
    for (const parsed of parser.finish()) yield parsed;
    yield { type: "done" };
  }
}
