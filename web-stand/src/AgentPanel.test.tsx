import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { AgentPanel } from "./components/AgentPanel";

const originalInnerWidth = window.innerWidth;

afterEach(() => {
  Object.defineProperty(window, "innerWidth", { configurable: true, value: originalInnerWidth });
  vi.useRealTimers();
});

it("answers a quick question with the selected demo agent", async () => {
  vi.useFakeTimers();
  render(<AgentPanel pinned={false} onPin={vi.fn()} onClose={vi.fn()} />);

  fireEvent.change(screen.getByLabelText("Модель"), { target: { value: "Kimi" } });
  fireEvent.click(screen.getByRole("button", { name: "Найти риски" }));

  expect(screen.getByText("Найди риски портфеля")).toBeInTheDocument();
  expect(screen.getByRole("status")).toHaveTextContent("Анализирую");
  expect(screen.getByRole("log")).toHaveAttribute("aria-live", "polite");
  await act(() => vi.advanceTimersByTimeAsync(450));
  expect(screen.getByText(/концентрация в акциях/)).toBeInTheDocument();
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
});

it("sends with Enter and keeps Shift+Enter as a newline", async () => {
  const user = userEvent.setup();
  render(<AgentPanel pinned={false} onPin={vi.fn()} onClose={vi.fn()} />);
  const composer = screen.getByLabelText("Сообщение агенту");

  await user.type(composer, "Первая строка{shift>}{enter}{/shift}Вторая строка");

  expect(composer).toHaveValue("Первая строка\nВторая строка");
  expect(screen.queryByText("Первая строка\nВторая строка")).not.toBeInTheDocument();

  await user.keyboard("{enter}");

  expect(screen.getByText((_, element) => (
    element?.tagName === "P" && element.textContent === "Первая строка\nВторая строка"
  ))).toBeInTheDocument();
  expect(composer).toHaveValue("");
  expect(screen.getByRole("button", { name: "Отправить" })).toBeDisabled();
  expect(await screen.findByText(/Kimi: портфель выглядит/)).toBeInTheDocument();
});

it("prevents duplicate sends while a response is pending", async () => {
  vi.useFakeTimers();
  render(<AgentPanel pinned={false} onPin={vi.fn()} onClose={vi.fn()} />);
  const composer = screen.getByLabelText("Сообщение агенту");
  fireEvent.change(composer, { target: { value: "Только один вопрос" } });

  fireEvent.keyDown(composer, { key: "Enter", code: "Enter" });
  fireEvent.keyDown(composer, { key: "Enter", code: "Enter" });

  expect(screen.getAllByText("Только один вопрос")).toHaveLength(1);
  await act(() => vi.advanceTimersByTimeAsync(450));
  expect(screen.getAllByText(/Kimi: портфель выглядит/)).toHaveLength(1);
});

it("keeps the agent selected at send time on the response", async () => {
  vi.useFakeTimers();
  render(<AgentPanel pinned={false} onPin={vi.fn()} onClose={vi.fn()} />);
  fireEvent.change(screen.getByLabelText("Модель"), { target: { value: "Codex" } });
  fireEvent.change(screen.getByLabelText("Сообщение агенту"), { target: { value: "Дай обзор" } });

  fireEvent.keyDown(screen.getByLabelText("Сообщение агенту"), { key: "Enter" });
  fireEvent.change(screen.getByLabelText("Модель"), { target: { value: "Claude" } });
  await act(() => vi.advanceTimersByTimeAsync(450));

  const response = screen.getByText(/Codex: портфель выглядит/).closest(".message");
  expect(response).not.toBeNull();
  expect(within(response as HTMLElement).getByText("Codex")).toBeInTheDocument();
});

it("clears a pending demo response timer on unmount", () => {
  vi.useFakeTimers();
  const { unmount } = render(<AgentPanel pinned={false} onPin={vi.fn()} onClose={vi.fn()} />);
  const unrelatedTimers = vi.getTimerCount();
  fireEvent.click(screen.getByRole("button", { name: "Найти риски" }));
  expect(vi.getTimerCount()).toBe(unrelatedTimers + 1);

  unmount();

  expect(vi.getTimerCount()).toBe(unrelatedTimers);
});

it("moves initial focus into the panel and closes on Escape", async () => {
  const user = userEvent.setup();
  const onClose = vi.fn();
  render(<AgentPanel pinned={false} onPin={vi.fn()} onClose={onClose} />);

  expect(screen.getByRole("complementary", { name: "ИИ-агент" })).toHaveFocus();
  await user.keyboard("{Escape}");
  expect(onClose).toHaveBeenCalledTimes(1);
});

it("traps Tab and Shift+Tab in an unpinned desktop overlay", async () => {
  Object.defineProperty(window, "innerWidth", { configurable: true, value: 1440 });
  const user = userEvent.setup();
  render(<AgentPanel pinned={false} onPin={vi.fn()} onClose={vi.fn()} />);
  const model = screen.getByLabelText("Модель");
  const composer = screen.getByLabelText("Сообщение агенту");

  await user.tab();
  expect(model).toHaveFocus();
  await user.tab({ shift: true });
  expect(composer).toHaveFocus();
  await user.tab();
  expect(model).toHaveFocus();
});

it("keeps a previously pinned panel modal below 1280px", async () => {
  Object.defineProperty(window, "innerWidth", { configurable: true, value: 1279 });
  const user = userEvent.setup();
  render(<AgentPanel pinned onPin={vi.fn()} onClose={vi.fn()} />);
  const model = screen.getByLabelText("Модель");
  const composer = screen.getByLabelText("Сообщение агенту");

  await user.tab();
  expect(model).toHaveFocus();
  await user.tab({ shift: true });
  expect(composer).toHaveFocus();
});

it("does not trap focus in a genuinely pinned wide panel", async () => {
  Object.defineProperty(window, "innerWidth", { configurable: true, value: 1280 });
  const user = userEvent.setup();
  render(
    <>
      <AgentPanel pinned onPin={vi.fn()} onClose={vi.fn()} />
      <button type="button">После панели</button>
    </>,
  );

  screen.getByLabelText("Сообщение агенту").focus();
  await user.tab();

  expect(screen.getByRole("button", { name: "После панели" })).toHaveFocus();
});

it("invokes pin and close controls and restores focus to the opener", async () => {
  const user = userEvent.setup();
  const onPin = vi.fn();
  const onClose = vi.fn();
  const opener = document.createElement("button");
  opener.textContent = "Открыть агента";
  document.body.appendChild(opener);
  opener.focus();
  const { unmount } = render(<AgentPanel pinned={false} onPin={onPin} onClose={onClose} />);

  await user.click(screen.getByRole("button", { name: "Закрепить" }));
  expect(onPin).toHaveBeenCalledTimes(1);
  await user.click(screen.getByRole("button", { name: "Закрыть" }));
  expect(onClose).toHaveBeenCalledTimes(1);

  unmount();
  expect(opener).toHaveFocus();
  opener.remove();
});


it("keeps the panel responsive and hides the backdrop only for wide pinning", async () => {
  const { readFileSync } = await import("node:fs");
  const css = readFileSync("src/styles.css", "utf8");

  expect(css).toContain("width: min(380px, calc(100vw - 24px));");
  expect(css).toMatch(/\.agent-panel\s*\{[^}]*display:\s*flex;[^}]*flex-direction:\s*column;/s);
  expect(css).toMatch(/@media \(min-width: 1280px\)\s*\{[\s\S]*?\.agent-is-pinned \.agent-backdrop\s*\{\s*display:\s*none;\s*\}/);
  expect(css).toMatch(/\.agent-icon-button\s*\{[^}]*min-width:\s*44px;[^}]*min-height:\s*44px;/s);
});
