import { describe, expect, it } from "vitest";
import { accounts, demoAnswer, formatMoney, historyForPeriod } from "./demo-data";

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

  it.each(accounts)("ends $name history at the exact account total", (account) => {
    expect(account.history.at(-1)?.value).toBe(account.total);
  });

  it("formats rubles without technical labels", () => {
    expect(formatMoney(1284500.5)).toMatch(/1.*284.*500/);
    expect(formatMoney(1284500.5)).toContain("₽");
  });

  it("describes the IIS daily loss with absolute Russian-formatted money", () => {
    const answer = demoAnswer("Kimi", "Что изменилось?", accounts[1]);

    expect(answer).toMatch(/снизился на 1.*240.*₽/);
    expect(answer).not.toMatch(/4.*380/);
    expect(answer).not.toMatch(/вырос/);
  });

  it("derives the default answer from the IIS instead of the main account", () => {
    const answer = demoAnswer("Kimi", "Дай обзор", accounts[1]);

    expect(answer).toContain("11,8%");
    expect(answer).toContain("68,2%");
    expect(answer).not.toContain("18,24%");
    expect(answer).not.toContain("76,4%");
  });

  it("derives the risk answer from the selected account allocation", () => {
    const answer = demoAnswer("Kimi", "Найди риски портфеля", accounts[1]);

    expect(answer).toContain("68,2%");
    expect(answer).not.toContain("76,4%");
  });
});
