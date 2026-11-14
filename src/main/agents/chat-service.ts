import type { ChatMessage } from "../../shared/contracts";
import type { ChatRepository } from "../database/chat-repository";
import type { PortfolioSnapshot } from "../portfolio/types";
import type { AgentHub } from "./agent-hub";
import type { AgentEvent, AgentProviderName } from "./cli-types";
import { buildPortfolioPrompt } from "./portfolio-context";

interface ChatRuntime {
  workingDirectory: string;
  agentProfilePath: string;
  emptyMcpConfigPath: string;
}

export class ChatService {
  constructor(
    private readonly hub: AgentHub,
    private readonly repository: ChatRepository,
    private readonly runtime: ChatRuntime,
    private readonly getSnapshot: () => PortfolioSnapshot | null,
  ) {}

  list(): ChatMessage[] {
    return this.repository.list();
  }

  clear(): void {
    this.repository.clear();
  }

  async send(
    provider: AgentProviderName,
    question: string,
    onEvent: (event: AgentEvent) => void,
    signal: AbortSignal,
  ): Promise<ChatMessage | null> {
    const snapshot = this.getSnapshot();
    if (!snapshot) throw new Error("Сначала загрузите портфель, чтобы начать анализ.");
    const prompt = buildPortfolioPrompt(snapshot, question);
    this.repository.add({ role: "user", provider: null, content: question, snapshotId: snapshot.id });
    let answer = "";
    try {
      for await (const event of this.hub.stream(provider, {
        prompt, ...this.runtime, persistSession: false,
      }, signal)) {
        if (event.type === "text") answer += event.text;
        onEvent(event);
        if (event.type === "error") return null;
        if (event.type === "done") {
          return this.repository.add({ role: "assistant", provider, content: answer, snapshotId: snapshot.id });
        }
      }
    } catch {
      onEvent({ type: "error", category: "provider", message: "Выбранный CLI завершил запрос с ошибкой. Другой агент автоматически не вызывался." });
    }
    return null;
  }
}
