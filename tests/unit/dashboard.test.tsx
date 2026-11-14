// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DashboardPage } from "../../src/renderer/pages/DashboardPage";
import { fixtureSnapshot } from "./fixtures";

vi.mock("../../src/renderer/components/Chart", () => ({
  Chart: ({ ariaLabel, option }: { ariaLabel: string; option: any }) => (
    <div role="img" aria-label={ariaLabel} data-length={option.series[0].data.length} />
  ),
}));

afterEach(cleanup);

describe("DashboardPage", () => {
  it("marks stale and partial portfolio data and preserves missing values", () => {
    const snapshot = {
      ...fixtureSnapshot,
      completeness: "partial" as const,
      dayYield: null,
      positions: fixtureSnapshot.positions.map((position) => ({ ...position, value: null })),
    };
    render(<DashboardPage snapshot={snapshot} stale />);
    expect(screen.getByText(/Данные на/i)).toBeTruthy();
    expect(screen.getByText(/устарели/i)).toBeTruthy();
    expect(screen.getByText(/Неполные данные/i)).toBeTruthy();
    expect(screen.getAllByText("Н/Д").length).toBeGreaterThan(0);
  });

  it("shows portfolio totals, allocations and largest positions", () => {
    render(<DashboardPage snapshot={fixtureSnapshot} />);
    expect(screen.getByText("Общая стоимость")).toBeTruthy();
    expect(screen.getByText("Свободные средства")).toBeTruthy();
    expect(screen.getAllByText("SBER").length).toBeGreaterThan(0);
    expect(screen.getByRole("img", { name: "Распределение по типам активов" })).toBeTruthy();
    expect(screen.getByRole("img", { name: "Динамика стоимости портфеля" })).toBeTruthy();
  });

  it("filters history by the selected period", () => {
    const snapshot = {
      ...fixtureSnapshot,
      history: [
        { asOf: "2026-11-12T12:00:00.000Z", value: fixtureSnapshot.totalValue!, estimated: true },
        ...fixtureSnapshot.history,
      ],
    };
    render(<DashboardPage snapshot={snapshot} />);
    const chart = screen.getByRole("img", { name: "Динамика стоимости портфеля" });
    expect(chart.getAttribute("data-length")).toBe("3");
    fireEvent.click(screen.getByRole("button", { name: "1Д" }));
    expect(chart.getAttribute("data-length")).toBe("2");
    fireEvent.click(screen.getByRole("button", { name: "Всё" }));
    expect(chart.getAttribute("data-length")).toBe("3");
  });

  it("shows an empty state instead of a zero portfolio", () => {
    render(<DashboardPage snapshot={null} />);
    expect(screen.getByText(/Пока нет данных портфеля/i)).toBeTruthy();
  });
});
