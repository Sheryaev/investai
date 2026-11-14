import Decimal from "decimal.js";
import { describe, expect, it, vi } from "vitest";
import { Database } from "../../src/main/database/database";
import { SnapshotRepository } from "../../src/main/database/snapshot-repository";
import { PortfolioService } from "../../src/main/portfolio/service";
import { money } from "../../src/main/portfolio/money";
import type { BrokerAccount, BrokerPortfolio, InvestGateway } from "../../src/main/invest/gateway";
import { basePosition, fixtureSnapshot } from "./fixtures";

function repositoryWithSnapshot() {
  const repository = new SnapshotRepository(new Database(":memory:"));
  repository.save(fixtureSnapshot);
  return repository;
}

function account(id: string): BrokerAccount {
  return { id, name: `Счёт ${id}`, type: "broker", status: "open", accessLevel: "READ_ONLY" };
}

function portfolio(accountId: string, currency: "RUB" | "USD" = "RUB"): BrokerPortfolio {
  return {
    accountId,
    totalValue: money("100", currency),
    expectedYieldPct: new Decimal("10"),
    positions: [basePosition({
      accountId,
      accountName: `Счёт ${accountId}`,
      currency,
      averagePrice: money("250", currency),
      currentPrice: money("300", currency),
      value: money("3000", currency),
      expectedYield: money("500", currency),
    })],
  };
}

function gateway(overrides: Partial<InvestGateway>): InvestGateway {
  return {
    listAccounts: async () => [account("a")],
    getPortfolio: async (accountId) => portfolio(accountId),
    getPositions: async (accountId) => [{ accountId, currency: "RUB", value: new Decimal("500") }],
    getOperations: async () => [],
    getCandles: async () => [],
    ...overrides,
  };
}

describe("PortfolioService", () => {
  it("keeps the last good snapshot when refresh fails", async () => {
    const repository = repositoryWithSnapshot();
    const service = new PortfolioService(gateway({ listAccounts: async () => { throw new Error("offline"); } }), repository);
    await expect(service.refresh()).rejects.toMatchObject({ category: "network" });
    expect(service.cached()).toEqual(fixtureSnapshot);
    expect(repository.latest()).toEqual(fixtureSnapshot);
    repository.close();
  });

  it("combines available accounts and marks a failed account as partial", async () => {
    const repository = new SnapshotRepository(new Database(":memory:"));
    const service = new PortfolioService(gateway({
      listAccounts: async () => [account("a"), account("b")],
      getPortfolio: async (accountId) => {
        if (accountId === "b") throw new Error("offline");
        return portfolio(accountId);
      },
    }), repository, { sleep: async () => undefined });
    const result = await service.refresh();
    expect(result.completeness).toBe("partial");
    expect(result.positions.map((position) => position.accountId)).toEqual(["a"]);
    expect(repository.latest()).toEqual(result);
    expect(service.lastErrors).toEqual([{ accountId: "b", category: "network" }]);
    repository.close();
  });

  it("does not add RUB and USD without an exchange rate", async () => {
    const repository = new SnapshotRepository(new Database(":memory:"));
    const service = new PortfolioService(gateway({
      listAccounts: async () => [account("a"), account("b")],
      getPortfolio: async (accountId) => portfolio(accountId, accountId === "b" ? "USD" : "RUB"),
      getPositions: async () => [],
    }), repository);
    const result = await service.refresh();
    expect(result.totalValue).toBeNull();
    expect(result.completeness).toBe("partial");
    expect(result.positions).toHaveLength(2);
    repository.close();
  });

  it("retries a network failure at most twice with bounded delays", async () => {
    const sleep = vi.fn(async (_milliseconds: number) => undefined);
    let attempts = 0;
    const service = new PortfolioService(gateway({
      getPortfolio: async (accountId) => {
        attempts += 1;
        if (attempts < 3) throw new Error("offline");
        return portfolio(accountId);
      },
    }), new SnapshotRepository(new Database(":memory:")), { sleep });
    const result = await service.refresh();
    expect(result.positions).toHaveLength(1);
    expect(attempts).toBe(3);
    expect(sleep.mock.calls.map(([delay]) => delay)).toEqual([500, 1500]);
  });

  it("rejects invalid operation ranges before calling the broker", async () => {
    const getOperations = vi.fn(async () => []);
    const service = new PortfolioService(gateway({ getOperations }), new SnapshotRepository(new Database(":memory:")));
    await expect(service.operations("a", "not-a-date", "2026-11-14T00:00:00.000Z")).rejects.toMatchObject({ category: "invalid_response" });
    await expect(service.operations("a", "2026-11-15T00:00:00.000Z", "2026-11-14T00:00:00.000Z")).rejects.toMatchObject({ category: "invalid_response" });
    expect(getOperations).not.toHaveBeenCalled();
  });

  it("deduplicates simultaneous refresh requests", async () => {
    let calls = 0;
    let release: (() => void) | undefined;
    const service = new PortfolioService(gateway({
      listAccounts: async () => {
        calls += 1;
        await new Promise<void>((resolve) => { release = resolve; });
        return [account("a")];
      },
    }), new SnapshotRepository(new Database(":memory:")));
    const first = service.refresh();
    const second = service.refresh();
    release?.();
    await Promise.all([first, second]);
    expect(calls).toBe(1);
  });
});
