// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AnalyticsPage } from "../../src/renderer/pages/AnalyticsPage";
import { calculateSnapshot } from "../../src/main/portfolio/analytics";
import { basePosition } from "./fixtures";

vi.mock("../../src/renderer/components/Chart", () => ({
  Chart: ({ ariaLabel }: { ariaLabel: string }) => <div role="img" aria-label={ariaLabel} />,
}));
vi.mock("../../src/renderer/components/OperationsTable", () => ({
  OperationsTable: () => <div>Таблица операций</div>,
}));

afterEach(cleanup);

describe("AnalyticsPage", () => {
  it("shows concentration and groups unknown sectors", () => {
    const snapshot = calculateSnapshot([basePosition({ sector: null })], [], "2026-11-14T12:00:00.000Z");
    render(<AnalyticsPage snapshot={snapshot} />);
    expect(screen.getByText("Концентрация топ-5")).toBeTruthy();
    expect(screen.getByText("HHI")).toBeTruthy();
    expect(screen.getByText("Не указано")).toBeTruthy();
    expect(screen.getByText("Таблица операций")).toBeTruthy();
    expect(screen.getAllByText(/100/)).not.toHaveLength(0);
  });

  it("does not invent analytics for an empty portfolio", () => {
    render(<AnalyticsPage snapshot={null} />);
    expect(screen.getByText(/Нет данных для аналитики/i)).toBeTruthy();
  });
});
