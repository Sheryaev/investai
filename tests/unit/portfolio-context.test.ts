import { describe, expect, it } from "vitest";
import { buildPortfolioContext, buildPortfolioPrompt } from "../../src/main/agents/portfolio-context";
import { fixtureSnapshot } from "./fixtures";

 describe("PortfolioContextBuilder", () => {
  it("anonymizes accounts and preserves exact decimal values", () => {
    const context = buildPortfolioContext(fixtureSnapshot);
    const serialized = JSON.stringify(context);
    expect(serialized).not.toContain("raw-account-1");
    expect(serialized).not.toContain("Основной");
    expect(serialized).toContain("Счёт 1");
    expect(context.version).toBe(1);
    expect(context.totals.value).toEqual({ value: "3500", currency: "RUB" });
    expect(context.positions[0]).toMatchObject({ account: "Счёт 1", ticker: "SBER", quantity: "10" });
    expect(context.positions[0]).not.toHaveProperty("accountId");
    expect(context.positions[0]).not.toHaveProperty("instrumentId");
  });

  it("embeds the question and snapshot without accepting secrets", () => {
    const prompt = buildPortfolioPrompt(fixtureSnapshot, "Найди риски");
    expect(prompt).toContain("Найди риски");
    expect(prompt).toContain("2026-11-14T12:00:00.000Z");
    expect(prompt).toContain("не индивидуальная инвестиционная рекомендация");
    expect(prompt).not.toContain("raw-account-1");
  });
});
