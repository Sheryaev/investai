import { describe, expect, it } from "vitest";
import { mapHistoricCandle, mapOperation, mapPortfolioPosition, moneyValueToMoney, quotationToDecimal } from "../../src/main/invest/mapping";

describe("T-Invest mapping", () => {
  it("converts units and nano exactly", () => {
    expect(quotationToDecimal({ units: "12", nano: 345000000 })?.toString()).toBe("12.345");
    expect(quotationToDecimal({ units: "-1", nano: -250000000 })?.toString()).toBe("-1.25");
    expect(quotationToDecimal(null)).toBeNull();
  });

  it("maps money and keeps unknown currency out of supported totals", () => {
    expect(moneyValueToMoney({ currency: "RUB", units: "10", nano: 1 })?.value.toString()).toBe("10.000000001");
    expect(moneyValueToMoney({ currency: "GBP", units: "10", nano: 0 })).toBeNull();
  });

  it("maps a portfolio position without inventing missing prices", () => {
    const result = mapPortfolioPosition({
      instrumentUid: "uid-1",
      figi: "figi-1",
      instrumentType: "share",
      quantity: { units: "2", nano: 0 },
      currentPrice: { currency: "RUB", units: "300", nano: 0 },
      averagePositionPrice: { currency: "RUB", units: "250", nano: 0 },
      expectedYield: { units: "100", nano: 0 },
    }, { accountId: "account-1", accountName: "Основной" });
    expect(result.value?.value.toString()).toBe("600");
    expect(result.expectedYield?.value.toString()).toBe("100");
    expect(result.ticker).toBe("figi-1");
    expect(result.sector).toBeNull();
  });

  it("maps operations and candles", () => {
    const operation = mapOperation({
      id: "op-1",
      accountId: "account-1",
      date: { seconds: 1763112000, nanos: 0 },
      type: "Пополнение",
      operationType: "OPERATION_TYPE_INPUT",
      payment: { currency: "RUB", units: "1000", nano: 0 },
      quantity: 0,
    });
    expect(operation.type).toBe("deposit");
    expect(operation.payment?.value.toString()).toBe("1000");
    const candle = mapHistoricCandle({
      time: { seconds: 1763112000, nanos: 0 },
      open: { units: "10", nano: 0 }, high: { units: "12", nano: 0 },
      low: { units: "9", nano: 0 }, close: { units: "11", nano: 0 },
      volume: 42, isComplete: true,
    });
    expect(candle.volume.toString()).toBe("42");
    expect(candle.close.toString()).toBe("11");
  });
});
