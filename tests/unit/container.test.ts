import { describe, expect, it } from "vitest";
import { InvestContainer } from "../../src/main/container";
import { FixtureGateway } from "../../src/main/invest/fixture-gateway";
import { deserializeSnapshot } from "../../src/main/database/snapshot-codec";
import { deserializeCandles, deserializeOperations } from "../../src/shared/market-codec";

 describe("InvestContainer", () => {
  it("provides serialized snapshots and persists refreshes", async () => {
    const container = new InvestContainer(":memory:", new FixtureGateway());
    expect(container.latestSnapshot()).toBeNull();
    const refreshed = await container.refreshSnapshot();
    const snapshot = deserializeSnapshot(refreshed);
    expect(snapshot.positions.length).toBeGreaterThan(0);
    expect(container.latestSnapshot()).toBe(refreshed);
    container.close();
  });

  it("provides serialized operations and candles", async () => {
    const container = new InvestContainer(":memory:", new FixtureGateway());
    const operations = await container.operations("raw-account-1", "2026-11-01T00:00:00.000Z", "2026-11-15T00:00:00.000Z");
    const candles = await container.candles("sber", "2026-11-01T00:00:00.000Z", "2026-11-03T00:00:00.000Z", "1d");
    expect(deserializeOperations(operations)).toHaveLength(4);
    expect(deserializeCandles(candles)).toHaveLength(3);
    container.close();
  });
});
