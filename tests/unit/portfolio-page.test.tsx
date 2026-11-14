// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { PortfolioPage } from "../../src/renderer/pages/PortfolioPage";
import { calculateSnapshot } from "../../src/main/portfolio/analytics";
import { money } from "../../src/main/portfolio/money";
import { basePosition } from "./fixtures";

const snapshot = calculateSnapshot([
  basePosition(),
  basePosition({
    instrumentId: "yndx", accountId: "account-2", accountName: "ИИС", ticker: "YNDX", name: "Яндекс",
    quantity: basePosition().quantity, value: money("17140", "RUB"),
  }),
], [], "2026-11-14T12:00:00.000Z");

afterEach(cleanup);

describe("PortfolioPage", () => {
  it("filters positions by ticker without losing missing values", () => {
    const partial = { ...snapshot, positions: snapshot.positions.map((position, index) => index === 0 ? { ...position, value: null } : position) };
    render(<PortfolioPage snapshot={partial} />);
    fireEvent.change(screen.getByPlaceholderText("Тикер или название"), { target: { value: "SBER" } });
    expect(screen.getAllByText("SBER").length).toBeGreaterThan(0);
    expect(screen.queryByText("YNDX")).toBeNull();
    expect(screen.getAllByText("Н/Д").length).toBeGreaterThan(0);
  });

  it("filters by account and sorts value with decimal comparison", () => {
    render(<PortfolioPage snapshot={snapshot} />);
    fireEvent.change(screen.getByLabelText("Счёт"), { target: { value: "account-2" } });
    expect(screen.getByText("YNDX")).toBeTruthy();
    expect(screen.queryByText("SBER")).toBeNull();
    fireEvent.change(screen.getByLabelText("Счёт"), { target: { value: "" } });
    const valueHeader = screen.getByRole("button", { name: /Стоимость/ });
    fireEvent.click(valueHeader);
    const rows = screen.getAllByRole("row").slice(1);
    expect(rows[0].textContent).toContain("SBER");
  });

  it("opens the selected instrument", () => {
    window.investAi = { getCandles: async () => "[]", getOperations: async () => "[]" } as never;
    render(<PortfolioPage snapshot={snapshot} />);
    fireEvent.click(screen.getByRole("button", { name: "Открыть SBER" }));
    expect(screen.getByRole("dialog", { name: "SBER" })).toBeTruthy();
  });
});
