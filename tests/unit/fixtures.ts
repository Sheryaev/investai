import Decimal from "decimal.js";
import { calculateSnapshot } from "../../src/main/portfolio/analytics";
import type { Position } from "../../src/main/portfolio/types";

export const basePosition = (overrides: Partial<Position> = {}): Position => ({
  instrumentId: "sber",
  accountId: "raw-account-1",
  accountName: "Основной",
  ticker: "SBER",
  name: "Сбербанк",
  assetType: "share",
  sector: "Финансы",
  currency: "RUB",
  quantity: new Decimal(10),
  averagePrice: { value: new Decimal("250"), currency: "RUB" },
  currentPrice: { value: new Decimal("300"), currency: "RUB" },
  value: { value: new Decimal("3000"), currency: "RUB" },
  expectedYield: { value: new Decimal("500"), currency: "RUB" },
  weightPct: null,
  ...overrides,
});

export const fixtureSnapshot = calculateSnapshot(
  [basePosition()],
  [{ accountId: "raw-account-1", currency: "RUB", value: new Decimal("500") }],
  "2026-11-14T12:00:00.000Z",
);
fixtureSnapshot.dayYield = { value: new Decimal("75"), currency: "RUB" };
fixtureSnapshot.history = [
  { asOf: "2026-11-13T12:00:00.000Z", value: { value: new Decimal("3425"), currency: "RUB" }, estimated: true },
  { asOf: "2026-11-14T12:00:00.000Z", value: { value: new Decimal("3500"), currency: "RUB" }, estimated: false },
];
