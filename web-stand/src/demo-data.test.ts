import { describe, expect, it } from "vitest";
import { accounts, formatMoney, historyForPeriod } from "./demo-data";

 describe("demo portfolio", () => {
  it("keeps the full history for the all period", () => {
    const points = accounts[0].history;
    expect(historyForPeriod(points, "Всё")).toBe(points);
  });

  it("filters a week relative to the latest demo point", () => {
    const points = accounts[0].history;
    const result = historyForPeriod(points, "1Н");
    expect(result.length).toBe(8);
    expect(result.at(-1)).toBe(points.at(-1));
  });

  it("formats rubles without technical labels", () => {
    expect(formatMoney(1284500.5)).toMatch(/1.*284.*500/);
    expect(formatMoney(1284500.5)).toContain("₽");
  });
});
