import { describe, expect, it } from "vitest";
import { FixtureGateway } from "../../src/main/invest/fixture-gateway";
import { TInvestGateway } from "../../src/main/invest/tinvest-gateway";

describe("InvestGateway", () => {
  it("provides deterministic demo data", async () => {
    const gateway = new FixtureGateway();
    const [account] = await gateway.listAccounts();
    const portfolio = await gateway.getPortfolio(account.id);
    expect(portfolio.positions.length).toBeGreaterThan(2);
    expect(portfolio.positions[0].ticker).toBe("SBER");
    expect((await gateway.getOperations(account.id, "2020-01-01T00:00:00.000Z", "2030-01-01T00:00:00.000Z")).length).toBeGreaterThan(0);
    expect((await gateway.getCandles(portfolio.positions[0].instrumentId, "2026-01-01T00:00:00.000Z", "2026-12-01T00:00:00.000Z", "1d")).length).toBeGreaterThan(10);
  });

  it("does not expose trading methods", () => {
    expect(Object.getOwnPropertyNames(TInvestGateway.prototype)).not.toContain("postOrder");
    expect(Object.getOwnPropertyNames(TInvestGateway.prototype)).not.toContain("cancelOrder");
    expect(Object.getOwnPropertyNames(FixtureGateway.prototype)).not.toContain("postOrder");
  });
});
