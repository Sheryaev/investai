import { useEffect, useRef, useState } from "react";
import type { AgentProviderName, CliAvailability } from "../../main/agents/cli-types";
import type { PortfolioSnapshot } from "../../main/portfolio/types";
import type { ChatMessage } from "../../shared/contracts";

const providers: Array<{ id: AgentProviderName; label: string }> = [
  { id: "codex", label: "Codex" }, { id: "kimi", label: "Kimi" }, { id: "claude", label: "Claude" },
];

function requestId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `chat-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function ChatPage({ snapshot }: { snapshot: PortfolioSnapshot | null }) {
  const [provider, setProvider] = useState<AgentProviderName>("codex");
  const [agents, setAgents] = useState<CliAvailability[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [activeRequest, setActiveRequest] = useState<string | null>(null);
  const [streaming, setStreaming] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastQuestion, setLastQuestion] = useState("");
  const activeRef = useRef<string | null>(null);
  const largest = snapshot?.positions.filter((position) => position.value).sort((a, b) => (b.value?.value.cmp(a.value?.value ?? 0) ?? 0))[0];

  useEffect(() => {
    let active = true;
    void window.investAi.listChat().then((value) => { if (active) setMessages(value); })
      .catch(() => { if (active) setError("Не удалось прочитать локальную историю чата."); });
    void window.investAi.scanAgents().then((value) => { if (active) setAgents(value); })
      .catch(() => { if (active) setError("Не удалось проверить CLI. Повторите сканирование в настройках."); });
    const unsubscribe = window.investAi.onChatEvent((payload) => {
      if (payload.requestId !== activeRef.current) return;
      const event = payload.event;
      if (event.type === "text") {
        const text = event.text;
        setStreaming((current) => (current ?? "") + text);
      }
      if (event.type === "error") setError(event.message);
    });
    return () => { active = false; unsubscribe(); };
  }, []);

  async function send(question: string) {
    const prompt = question.trim();
    if (!snapshot || !prompt || activeRef.current) return;
    const id = requestId();
    activeRef.current = id;
    setActiveRequest(id);
    setStreaming("");
    setError(null);
    setLastQuestion(prompt);
    setInput("");
    setMessages((current) => [...current, {
      id: `local-${id}`, role: "user", provider: null, content: prompt,
      snapshotId: snapshot.id, createdAt: new Date().toISOString(),
    }]);
    try {
      await window.investAi.sendChat({ requestId: id, provider, prompt });
      setMessages(await window.investAi.listChat());
    } catch {
      setError("Не удалось выполнить запрос выбранным CLI. Проверьте установку и вход; другой агент не вызывался.");
    } finally {
      if (activeRef.current === id) {
        activeRef.current = null;
        setActiveRequest(null);
        setStreaming(null);
      }
    }
  }

  async function cancel() {
    if (activeRequest) await window.investAi.cancelChat(activeRequest);
  }

  if (!snapshot) return <section className="empty-state"><span className="eyebrow">ИИ-АНАЛИТИКА</span><h1>Сначала загрузите портфель</h1><p>Чат автоматически использует актуальный локальный снимок, без ручного копирования данных.</p></section>;

  return (
    <div className="page-stack chat-page">
      <header className="page-header"><div><span className="eyebrow">ЛОКАЛЬНЫЙ CLI · БЕЗ API-КЛЮЧЕЙ</span><h1>ИИ-чат</h1><p className="muted">Снимок от {new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "long", hour: "2-digit", minute: "2-digit" }).format(new Date(snapshot.asOf))}</p></div><label className="agent-picker"><span>CLI-агент</span><select className="field" aria-label="CLI-агент" value={provider} disabled={activeRequest !== null} onChange={(event) => setProvider(event.target.value as AgentProviderName)}>{providers.map((item) => {
        const availability = agents.find((agent) => agent.provider === item.id);
        const disabled = availability ? ["not_installed", "auth_required", "error"].includes(availability.status) : false;
        return <option key={item.id} value={item.id} disabled={disabled}>{item.label}{availability ? ` · ${availability.status === "ready" ? "готов" : availability.status === "installed" ? "установлен" : "недоступен"}` : ""}</option>;
      })}</select></label></header>
      <div className="quick-actions" aria-label="Быстрые действия">
        <button type="button" onClick={() => void send("Проанализируй портфель")}>Проанализируй портфель</button>
        <button type="button" onClick={() => void send("Найди риски")}>Найди риски</button>
        <button type="button" onClick={() => void send("Что изменилось?")}>Что изменилось?</button>
        <button type="button" disabled={!largest} onClick={() => void send(`Разбери позицию ${largest?.ticker ?? ""}`)}>Разбери {largest?.ticker ?? "позицию"}</button>
      </div>
      <section className="panel chat-conversation" aria-label="История диалога">
        {messages.length === 0 && streaming === null && <div className="chat-empty"><span>✦</span><h2>Пока нет сообщений</h2><p>Выберите CLI и действие. Снимок портфеля будет передан автоматически, а номера счетов — удалены.</p></div>}
        {messages.map((message) => <article className={`chat-message ${message.role}`} key={message.id}>
          <div className="message-meta"><strong>{message.role === "user" ? "Вы" : providers.find((item) => item.id === message.provider)?.label ?? "Агент"}</strong><span>{new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit" }).format(new Date(message.createdAt))}</span></div>
          <div className="chat-content">{message.content}</div>
          {message.role === "assistant" && <small>Аналитика, а не индивидуальная инвестиционная рекомендация</small>}
        </article>)}
        {streaming !== null && <article className="chat-message assistant streaming"><div className="message-meta"><strong>{providers.find((item) => item.id === provider)?.label}</strong><span>печатает…</span></div><div className="chat-content">{streaming || "Анализирую снимок…"}</div></article>}
      </section>
      {error && <div className="error-banner chat-error" role="alert"><span>{error}</span>{lastQuestion && !activeRequest && <button className="button secondary compact" type="button" onClick={() => void send(lastQuestion)}>Повторить</button>}</div>}
      <form className="chat-composer" onSubmit={(event) => { event.preventDefault(); void send(input); }}>
        <textarea aria-label="Сообщение" value={input} onChange={(event) => setInput(event.target.value)} placeholder="Спросите о рисках, структуре или позициях…" rows={3} onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void send(input); }
        }} />
        <div className="composer-footer"><span>{activeRequest ? `${providers.find((item) => item.id === provider)?.label} получил только обезличенный снимок` : "Enter — отправить · Shift+Enter — новая строка"}</span>{activeRequest ? <button className="button secondary" type="button" onClick={() => void cancel()}>Остановить</button> : <button className="button primary" type="submit" disabled={!input.trim()}>Отправить</button>}</div>
      </form>
    </div>
  );
}
