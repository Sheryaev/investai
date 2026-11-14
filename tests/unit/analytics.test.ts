import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";
import { calculateSnapshot, concentration } from "../../src/main/portfolio/analytics";
import { basePosition } from "./fixtures";

describe("calculateSnapshot", () => {
  it("does not turn a missing position value into zero", () => {
    const result = calculateSnapshot(
      [basePosition({ value: null, currentPrice: null })],
      [],
      "2026-11-14T12:00:00.000Z",
    );
    expect(result.totalValue).toBeNull();
    expect(result.completeness).toBe("partial");
    expect(result.positions[0].weightPct).toBeNull();
  });

  it("calculates total value, cash, yield and position weights", () => {
    const result = calculateSnapshot(
      [
        basePosition(),
        basePosition({ instrumentId: "yndx", ticker: "YNDX", value: { value: new Decimal("1000"), currency: "RUB" }, expectedYield: { value: new Decimal("100"), currency: "RUB" } }),
      ],
      [{ accountId: "raw-account-1", currency: "RUB", value: new Decimal("500") }],
      "2026-11-14T12:00:00.000Z",
    );
    expect(result.totalValue?.value.toString()).toBe("4500");
    expect(result.totalCash?.value.toString()).toBe("500");
    expect(result.totalYield?.value.toString()).toBe("600");
    expect(result.positions[0].weightPct?.toFixed(4)).toBe("66.6667");
    expect(result.allocations.currencies[0]).toMatchObject({ key: "RUB" });
    expect(result.allocations.currencies[0].percentage?.toString()).toBe("100");
    expect(result.allocations.assets[0].value.value.toString()).toBe("4000");
    expect(result.completeness).toBe("complete");
  });

  it("marks a mixed-currency portfolio partial until conversion is supplied", () => {
    const result = calculateSnapshot(
      [basePosition({ currency: "USD", value: { value: new Decimal("100"), currency: "USD" } })],
      [],
      "2026-11-14T12:00:00.000Z",
    );
    expect(result.totalValue).toBeNull();
    expect(result.completeness).toBe("partial");
  });

  it("treats an empty portfolio as complete zero", () => {
    const result = calculateSnapshot([], [], "2026-11-14T12:00:00.000Z");
    expect(result.totalValue?.value.toString()).toBe("0");
    expect(result.completeness).toBe("complete");
  });
});

describe("concentration", () => {
  it("calculates top-five share and HHI", () => {
    const result = concentration([new Decimal(50), new Decimal(30), new Decimal(20)]);
    expect(result.topFivePct?.toString()).toBe("100");
    expect(result.hhi?.toString()).toBe("0.38");
  });

  it("returns null for an empty portfolio", () => {
    expect(concentration([])).toEqual({ topFivePct: null, hhi: null });
  });
});
