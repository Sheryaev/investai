import Decimal from "decimal.js";
import { z } from "zod";
import type { PortfolioSnapshot } from "../portfolio/types";

const decimal = z.instanceof(Decimal);
const currency = z.enum(["RUB", "USD", "EUR", "CNY"]);
const money = z.object({ value: decimal, currency });
const nullableMoney = money.nullable();
const allocation = z.object({ key: z.string(), label: z.string(), value: money, percentage: decimal.nullable() });

const snapshotSchema = z.object({
  id: z.string().min(1),
  asOf: z.string().datetime(),
  baseCurrency: currency,
  completeness: z.enum(["complete", "partial"]),
  estimated: z.boolean(),
  totalValue: nullableMoney,
  totalCash: nullableMoney,
  dayYield: nullableMoney,
  totalYield: nullableMoney,
  positions: z.array(z.object({
    instrumentId: z.string().min(1),
    accountId: z.string(),
    accountName: z.string(),
    ticker: z.string(),
    name: z.string(),
    assetType: z.enum(["share", "bond", "etf", "currency", "futures", "option", "other"]),
    sector: z.string().nullable(),
    currency,
    quantity: decimal,
    averagePrice: nullableMoney,
    currentPrice: nullableMoney,
    value: nullableMoney,
    expectedYield: nullableMoney,
    weightPct: decimal.nullable(),
  })),
  cash: z.array(z.object({ accountId: z.string(), currency, value: decimal })),
  allocations: z.object({
    assets: z.array(allocation),
    currencies: z.array(allocation),
    accounts: z.array(allocation),
    sectors: z.array(allocation),
  }),
  history: z.array(z.object({ asOf: z.string().datetime(), value: money, estimated: z.boolean() })),
});

function encode(value: unknown): unknown {
  if (value instanceof Decimal) return { __decimal: value.toString() };
  if (Array.isArray(value)) return value.map(encode);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, encode(item)]));
  }
  return value;
}

function decode(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(decode);
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const entries = Object.entries(record);
    if (entries.length === 1 && typeof record.__decimal === "string") return new Decimal(record.__decimal);
    return Object.fromEntries(entries.map(([key, item]) => [key, decode(item)]));
  }
  return value;
}

export function serializeSnapshot(snapshot: PortfolioSnapshot): string {
  snapshotSchema.parse(snapshot);
  return JSON.stringify(encode(snapshot));
}

export function deserializeSnapshot(payload: string): PortfolioSnapshot {
  try {
    return snapshotSchema.parse(decode(JSON.parse(payload))) as PortfolioSnapshot;
  } catch (error) {
    throw new Error("Локальный снимок повреждён и не может быть прочитан.", { cause: error });
  }
}
