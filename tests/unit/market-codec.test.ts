import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";
import { deserializeCandles, deserializeOperations, serializeCandles, serializeOperations } from "../../src/shared/market-codec";
import { money } from "../../src/main/portfolio/money";
import type { BrokerOperation, Candle } from "../../src/main/invest/gateway";

const operation: BrokerOperation = {
  id: "op-1", accountId: "account-1", date: "2026-11-14T09:15:00.000Z", type: "buy",
  description: "Покупка SBER", payment: money("-3000", "RUB"), quantity: new Decimal("10"),
  instrumentId: "sber", figi: "figi-sber",
};
const candle: Candle = {
  time: "2026-11-14T09:00:00.000Z", open: new Decimal("300"), high: new Decimal("305"),
  low: new Decimal("298"), close: new Decimal("303"), volume: new Decimal("1200"), isComplete: true,
};

describe("market data IPC codec", () => {
  it("round-trips operations without converting decimal values to numbers", () => {
    const result = deserializeOperations(serializeOperations([operation]));
    expect(result).toEqual([operation]);
    expect(result[0].payment?.value).toBeInstanceOf(Decimal);
    expect(result[0].quantity).toBeInstanceOf(Decimal);
  });

  it("round-trips candles and rejects malformed payloads", () => {
    expect(deserializeCandles(serializeCandles([candle]))).toEqual([candle]);
    expect(() => deserializeOperations("{broken")).toThrow("операций");
    expect(() => deserializeCandles(JSON.stringify([{ time: "invalid" }]))).toThrow("свечей");
  });
});
