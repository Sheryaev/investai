// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SettingsPage } from "../../src/renderer/pages/SettingsPage";
import type { SettingsSnapshot } from "../../src/shared/contracts";

const demo: SettingsSnapshot = {
  mode: "demo", hasToken: false,
  preferences: { selectedAccountIds: [], baseCurrency: "RUB", refreshIntervalMinutes: 5 },
};
const broker: SettingsSnapshot = { ...demo, mode: "broker", hasToken: true };

function api(overrides: Record<string, unknown> = {}) {
  return {
    getSettings: vi.fn(async () => demo),
    listAccounts: vi.fn(async () => [
      { id: "account-1", name: "Основной", type: "Брокерский", status: "Открыт" },
      { id: "account-2", name: "ИИС", type: "ИИС", status: "Открыт" },
    ]),
    scanAgents: vi.fn(async () => [
      { provider: "codex", status: "ready", path: "C:\\tools\\codex.exe", version: "1.2.3", message: null },
      { provider: "kimi", status: "installed", path: "C:\\tools\\kimi.exe", version: "2.0.0", message: null },
      { provider: "claude", status: "not_installed", path: null, version: null, message: null },
    ]),
    saveBrokerToken: vi.fn(async () => broker),
    updateSettings: vi.fn(async () => demo),
    removeBrokerToken: vi.fn(async () => demo),
    ...overrides,
  };
}

afterEach(cleanup);

describe("SettingsPage", () => {
  it("saves a masked broker token and never asks for AI API keys", async () => {
    const onChanged = vi.fn();
    const investAi = api();
    window.investAi = investAi as never;
    render(<SettingsPage onChanged={onChanged} />);
    expect(await screen.findByText("Основной")).toBeTruthy();
    expect(screen.getByText("Codex")).toBeTruthy();
    expect(screen.getByText("Готов")).toBeTruthy();
    expect(screen.getByText("kimi login")).toBeTruthy();
    expect(screen.queryByLabelText(/API.?ключ/i)).toBeNull();
    const token = screen.getByLabelText("Read-only токен");
    expect(token).toHaveProperty("type", "password");
    fireEvent.change(token, { target: { value: "t.readonly" } });
    fireEvent.click(screen.getByRole("button", { name: "Сохранить токен" }));
    await waitFor(() => expect(investAi.saveBrokerToken).toHaveBeenCalledWith("t.readonly"));
    expect(onChanged).toHaveBeenCalledWith(broker);
    expect(token).toHaveProperty("value", "");
  });

  it("stores selected accounts, currency and refresh interval", async () => {
    const investAi = api();
    window.investAi = investAi as never;
    render(<SettingsPage />);
    fireEvent.click(await screen.findByLabelText("ИИС"));
    fireEvent.change(screen.getByLabelText("Базовая валюта"), { target: { value: "USD" } });
    fireEvent.change(screen.getByLabelText("Интервал обновления"), { target: { value: "15" } });
    fireEvent.click(screen.getByRole("button", { name: "Сохранить настройки" }));
    await waitFor(() => expect(investAi.updateSettings).toHaveBeenCalledWith({
      selectedAccountIds: ["account-2"], baseCurrency: "USD", refreshIntervalMinutes: 15,
    }));
  });
});
