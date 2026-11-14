// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "../../src/renderer/app/App";
import { serializeSnapshot } from "../../src/main/database/snapshot-codec";
import { fixtureSnapshot } from "./fixtures";

vi.mock("../../src/renderer/pages/DashboardPage", () => ({
  DashboardPage: ({ snapshot }: { snapshot: { id: string } | null }) => <div data-testid="snapshot">{snapshot?.id ?? "empty"}</div>,
  formatMoney: () => "",
  formatPercent: () => "",
}));
vi.mock("../../src/renderer/components/Chart", () => ({
  Chart: ({ ariaLabel }: { ariaLabel: string }) => <div aria-label={ariaLabel} />,
}));
vi.mock("../../src/renderer/components/OperationsTable", () => ({
  OperationsTable: () => <div />,
}));

afterEach(cleanup);

describe("App portfolio integration", () => {
  it("shows cache first, refreshes in background and unsubscribes on unmount", async () => {
    const refreshed = { ...fixtureSnapshot, id: "snapshot:refreshed" };
    const unsubscribe = vi.fn();
    const onPortfolioUpdated = vi.fn(() => unsubscribe);
    let releaseRefresh: ((payload: string) => void) | undefined;
    const refreshPromise = new Promise<string>((resolve) => { releaseRefresh = resolve; });
    window.investAi = {
      getAppInfo: async () => ({ name: "Invest AI", version: "0.1.0", mode: "demo" }),
      getLatestSnapshot: async () => serializeSnapshot(fixtureSnapshot),
      refreshPortfolio: () => refreshPromise,
      onPortfolioUpdated,
    } as never;

    const { unmount } = render(<App />);
    expect(await screen.findByText(fixtureSnapshot.id)).toBeTruthy();
    releaseRefresh?.(serializeSnapshot(refreshed));
    expect(await screen.findByText(refreshed.id)).toBeTruthy();
    expect(onPortfolioUpdated).toHaveBeenCalledTimes(1);
    unmount();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it("opens portfolio and analytics pages with the current snapshot", async () => {
    window.investAi = {
      getAppInfo: async () => ({ name: "Invest AI", version: "0.1.0", mode: "demo" }),
      getLatestSnapshot: async () => serializeSnapshot(fixtureSnapshot),
      refreshPortfolio: async () => serializeSnapshot(fixtureSnapshot),
      onPortfolioUpdated: () => () => undefined,
    } as never;
    render(<App />);
    expect(await screen.findByText(fixtureSnapshot.id)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Портфель/ }));
    expect(screen.getByRole("heading", { name: "Портфель" })).toBeTruthy();
    expect(screen.getByPlaceholderText("Тикер или название")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Аналитика/ }));
    expect(screen.getByRole("heading", { name: "Аналитика" })).toBeTruthy();
    expect(screen.getByText("Концентрация топ-5")).toBeTruthy();
  });

  it("shows a safe error while keeping cached data", async () => {
    window.investAi = {
      getAppInfo: async () => ({ name: "Invest AI", version: "0.1.0", mode: "demo" }),
      getLatestSnapshot: async () => serializeSnapshot(fixtureSnapshot),
      refreshPortfolio: async () => { throw new Error("offline"); },
      onPortfolioUpdated: () => () => undefined,
    } as never;
    render(<App />);
    await waitFor(() => expect(screen.getByText(/не удалось обновить/i)).toBeTruthy());
    expect(screen.getByText(fixtureSnapshot.id)).toBeTruthy();
  });
});
