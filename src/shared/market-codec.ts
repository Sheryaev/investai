import Decimal from "decimal.js";
import { z } from "zod";
import type { BrokerOperation, Candle } from "../main/invest/gateway";

const decimal = z.instanceof(Decimal);
const operationSchema = z.object({
  id: z.string().min(1),
  accountId: z.string().min(1),
  date: z.string().datetime(),
  type: z.enum(["deposit", "withdrawal", "buy", "sell", "dividend", "coupon", "fee", "tax", "other"]),
  description: z.string(),
  payment: z.object({ value: decimal, currency: z.enum(["RUB", "USD", "EUR", "CNY"]) }).nullable(),
  quantity: decimal.nullable(),
  instrumentId: z.string().nullable(),
  figi: z.string().nullable(),
});
const candleSchema = z.object({
  time: z.string().datetime(),
  open: decimal,
  high: decimal,
  low: decimal,
  close: decimal,
  volume: decimal,
  isComplete: z.boolean(),
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

function deserialize<T>(payload: string, schema: z.ZodType<T>, label: string): T {
  try {
    return schema.parse(decode(JSON.parse(payload)));
  } catch (error) {
    throw new Error(`Получены повреждённые данные ${label}.`, { cause: error });
  }
}

export function serializeOperations(operations: BrokerOperation[]): string {
  return JSON.stringify(encode(z.array(operationSchema).parse(operations)));
}

export function deserializeOperations(payload: string): BrokerOperation[] {
  return deserialize(payload, z.array(operationSchema), "операций");
}

export function serializeCandles(candles: Candle[]): string {
  return JSON.stringify(encode(z.array(candleSchema).parse(candles)));
}

export function deserializeCandles(payload: string): Candle[] {
  return deserialize(payload, z.array(candleSchema), "свечей");
}
