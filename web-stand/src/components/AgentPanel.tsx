import { useEffect, useRef, useState } from "react";
import { LoaderCircle, Pin, PinOff, SendHorizontal, Sparkles, X } from "lucide-react";
import type { AgentName } from "../demo-data";
import { demoAnswer } from "../demo-data";

interface AgentPanelProps {
  pinned: boolean;
  onPin: () => void;
  onClose: () => void;
}

interface Message {
  id: number;
  role: "user" | "agent";
  text: string;
  agent?: AgentName;
}

function focusableElements(panel: HTMLElement): HTMLElement[] {
  return Array.from(panel.querySelectorAll<HTMLElement>(
    'a[href], button, select, textarea, input, [tabindex]',
  )).filter((element) => (
    element.tabIndex >= 0
    && !element.hasAttribute("disabled")
    && element.getAttribute("aria-hidden") !== "true"
  ));
}

export function AgentPanel(props: AgentPanelProps) {
  const [agent, setAgent] = useState<AgentName>("Kimi");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [thinking, setThinking] = useState(false);
  const nextMessageId = useRef(1);
  const thinkingRef = useRef(false);
  const responseTimer = useRef<number | null>(null);
  const panelRef = useRef<HTMLElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const propsRef = useRef(props);
  propsRef.current = props;

  useEffect(() => () => {
    if (responseTimer.current !== null) window.clearTimeout(responseTimer.current);
  }, []);

  useEffect(() => {
    const panel = panelRef.current;
    openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    panel?.focus({ preventScroll: true });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        propsRef.current.onClose();
        return;
      }
      if (event.key !== "Tab" || !panel) return;
      if (propsRef.current.pinned && window.innerWidth >= 1280) return;

      const elements = focusableElements(panel);
      if (elements.length === 0) {
        event.preventDefault();
        panel.focus();
        return;
      }

      const first = elements[0];
      const last = elements[elements.length - 1];
      const active = document.activeElement;
      const outside = !panel.contains(active);
      const shouldWrap = event.shiftKey
        ? active === first || active === panel || outside
        : active === last || active === panel || outside;
      if (!shouldWrap) return;

      event.preventDefault();
      (event.shiftKey ? last : first).focus();
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      const opener = openerRef.current;
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, []);

  const send = (question: string) => {
    const text = question.trim();
    if (!text || thinkingRef.current) return;

    const respondingAgent = agent;
    thinkingRef.current = true;
    setMessages((items) => [...items, { id: nextMessageId.current++, role: "user", text }]);
    setInput("");
    setThinking(true);
    responseTimer.current = window.setTimeout(() => {
      setMessages((items) => [...items, {
        id: nextMessageId.current++,
        role: "agent",
        agent: respondingAgent,
        text: demoAnswer(respondingAgent, text),
      }]);
      thinkingRef.current = false;
      responseTimer.current = null;
      setThinking(false);
    }, 400);
  };

  return (
    <>
      <button
        className="agent-backdrop"
        type="button"
        tabIndex={-1}
        aria-label="Закрыть агента"
        onClick={props.onClose}
      />
      <aside
        className="agent-panel"
        role="complementary"
        aria-label="ИИ-агент"
        tabIndex={-1}
        ref={panelRef}
      >
        <header className="agent-head">
          <div className="agent-title"><Sparkles size={19} aria-hidden="true" /><strong>Агент</strong></div>
          <div className="agent-controls">
            <select aria-label="Модель" value={agent} onChange={(event) => setAgent(event.target.value as AgentName)}>
              <option>Kimi</option>
              <option>Codex</option>
              <option>Claude</option>
            </select>
            <button
              className="agent-icon-button"
              type="button"
              aria-label={props.pinned ? "Открепить" : "Закрепить"}
              title={props.pinned ? "Открепить" : "Закрепить"}
              onClick={props.onPin}
            >
              {props.pinned ? <PinOff size={18} aria-hidden="true" /> : <Pin size={18} aria-hidden="true" />}
            </button>
            <button className="agent-icon-button" type="button" aria-label="Закрыть" title="Закрыть" onClick={props.onClose}>
              <X size={19} aria-hidden="true" />
            </button>
          </div>
        </header>
        <div className="agent-body" role="log" aria-live="polite" aria-relevant="additions">
          {messages.length === 0 && (
            <div className="agent-welcome">
              <Sparkles size={28} aria-hidden="true" />
              <h2>Что разберём?</h2>
              <p>Спросите о портфеле или выберите вопрос.</p>
              <div className="quick-questions">
                <button type="button" disabled={thinking} onClick={() => send("Найди риски портфеля")}>Найти риски</button>
                <button type="button" disabled={thinking} onClick={() => send("Что изменилось?")}>Что изменилось?</button>
                <button type="button" disabled={thinking} onClick={() => send("Проанализируй портфель")}>Обзор портфеля</button>
              </div>
            </div>
          )}
          {messages.map((message) => (
            <div className={`message ${message.role}`} key={message.id}>
              {message.agent && <small>{message.agent}</small>}
              <p>{message.text}</p>
            </div>
          ))}
          {thinking && (
            <span className="thinking" role="status" aria-live="polite">
              <LoaderCircle size={16} aria-hidden="true" />
              Анализирую…
            </span>
          )}
        </div>
        <form className="composer" onSubmit={(event) => { event.preventDefault(); send(input); }}>
          <textarea
            aria-label="Сообщение агенту"
            placeholder="Спросить о портфеле…"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault();
                send(input);
              }
            }}
            rows={2}
          />
          <button className="composer-send" type="submit" aria-label="Отправить" disabled={!input.trim() || thinking}>
            <SendHorizontal size={19} aria-hidden="true" />
          </button>
        </form>
      </aside>
    </>
  );
}
