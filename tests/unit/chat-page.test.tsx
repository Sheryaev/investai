// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ChatPage } from "../../src/renderer/pages/ChatPage";
import type { ChatEventPayload, ChatMessage, ChatRequest } from "../../src/shared/contracts";
import { fixtureSnapshot } from "./fixtures";

const assistant: ChatMessage = {
  id: "assistant-1", role: "assistant", provider: "kimi", content: "Первый ответ",
  snapshotId: fixtureSnapshot.id, createdAt: "2026-11-14T18:00:00.000Z",
};

afterEach(cleanup);

function setup() {
  let emit: ((payload: ChatEventPayload) => void) | undefined;
  let complete: ((message: ChatMessage) => void) | undefined;
  const user: ChatMessage = { ...assistant, id: "user-1", role: "user", provider: null, content: "Найди риски" };
  const investAi = {
    scanAgents: vi.fn(async () => [
      { provider: "codex", status: "ready", path: "codex", version: "1", message: null },
      { provider: "kimi", status: "installed", path: "kimi", version: "1", message: null },
      { provider: "claude", status: "not_installed", path: null, version: null, message: null },
    ]),
    listChat: vi.fn().mockResolvedValueOnce([]).mockResolvedValue([user, assistant]),
    sendChat: vi.fn((_request: ChatRequest) => new Promise<ChatMessage>((resolve) => { complete = resolve; })),
    cancelChat: vi.fn(async () => true),
    clearChat: vi.fn(async () => undefined),
    onChatEvent: vi.fn((callback: (payload: ChatEventPayload) => void) => { emit = callback; return () => undefined; }),
  };
  window.investAi = investAi as never;
  return { investAi, emit: (payload: ChatEventPayload) => emit?.(payload), complete: (message: ChatMessage) => complete?.(message) };
}

describe("ChatPage", () => {
  it("uses the selected CLI, streams the answer and reloads local history", async () => {
    const { investAi, emit, complete } = setup();
    render(<ChatPage snapshot={fixtureSnapshot} />);
    expect(await screen.findByText("Пока нет сообщений")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("CLI-агент"), { target: { value: "kimi" } });
    fireEvent.click(screen.getByRole("button", { name: "Найди риски" }));
    expect(investAi.sendChat).toHaveBeenCalledWith(expect.objectContaining({ provider: "kimi", prompt: "Найди риски" }));
    expect(screen.getAllByText("Найди риски")).toHaveLength(2);
    const requestId = (investAi.sendChat.mock.calls[0]?.[0] as ChatRequest).requestId;
    await act(async () => emit({ requestId, event: { type: "text", text: "Первый ответ" } }));
    expect(screen.getByText("Первый ответ")).toBeTruthy();
    await act(async () => {
      emit({ requestId, event: { type: "done" } });
      complete(assistant);
      await Promise.resolve();
    });
    await waitFor(() => expect(investAi.listChat).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole("button", { name: "Остановить" })).toBeNull();
  });

  it("cancels only the active request", async () => {
    const { investAi } = setup();
    render(<ChatPage snapshot={fixtureSnapshot} />);
    await waitFor(() => expect(investAi.scanAgents).toHaveBeenCalled());
    fireEvent.change(screen.getByLabelText("Сообщение"), { target: { value: "Проанализируй портфель" } });
    fireEvent.click(screen.getByRole("button", { name: "Отправить" }));
    const requestId = (investAi.sendChat.mock.calls[0]?.[0] as ChatRequest).requestId;
    fireEvent.click(screen.getByRole("button", { name: "Остановить" }));
    expect(investAi.cancelChat).toHaveBeenCalledWith(requestId);
  });
});
