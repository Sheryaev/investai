import Decimal from "decimal.js";
import { money } from "../portfolio/money";
import type { Money } from "../portfolio/money";
import type { AssetType, Currency, Position } from "../portfolio/types";
import type { BrokerOperation, Candle, OperationType } from "./gateway";

export interface RawQuotation { units?: string | number; nano?: number }
export interface RawMoneyValue extends RawQuotation { currency?: string }
interface RawTimestamp { seconds?: string | number; nanos?: number }

const supportedCurrencies = new Set<Currency>(["RUB", "USD", "EUR", "CNY"]);

export function quotationToDecimal(value?: RawQuotation | null): Decimal | null {
  if (!value || value.units === undefined) return null;
  return new Decimal(value.units).plus(new Decimal(value.nano ?? 0).div(1_000_000_000));
}

export function moneyValueToMoney(value?: RawMoneyValue | null): Money | null {
  const decimal = quotationToDecimal(value);
  const currency = value?.currency?.toUpperCase() as Currency;
  return decimal && supportedCurrencies.has(currency) ? money(decimal, currency) : null;
}

export function timestampToIso(value?: RawTimestamp | null): string {
  const milliseconds = Number(value?.seconds ?? 0) * 1000 + Number(value?.nanos ?? 0) / 1_000_000;
  return new Date(milliseconds).toISOString();
}

const assetTypes: Record<string, AssetType> = {
  share: "share", shares: "share", bond: "bond", bonds: "bond", etf: "etf",
  currency: "currency", futures: "futures", option: "option",
};

export function mapPortfolioPosition(
  raw: Record<string, any>,
  account: { accountId: string; accountName: string },
  instrument?: { ticker?: string; name?: string; sector?: string },
): Position {
  const currentPrice = moneyValueToMoney(raw.currentPrice ?? raw.current_price);
  const averagePrice = moneyValueToMoney(raw.averagePositionPrice ?? raw.average_position_price);
  const quantity = quotationToDecimal(raw.quantity) ?? new Decimal(0);
  const expectedYieldValue = quotationToDecimal(raw.expectedYield ?? raw.expected_yield);
  const currency = currentPrice?.currency ?? averagePrice?.currency ?? "RUB";
  const figi = raw.figi ?? "";
  return {
    instrumentId: raw.instrumentUid ?? raw.instrument_uid ?? figi,
    accountId: account.accountId,
    accountName: account.accountName,
    ticker: instrument?.ticker || figi || "—",
    name: instrument?.name || instrument?.ticker || figi || "Инструмент",
    assetType: assetTypes[String(raw.instrumentType ?? raw.instrument_type).toLowerCase()] ?? "other",
    sector: instrument?.sector || null,
    currency,
    quantity,
    averagePrice,
    currentPrice,
    value: currentPrice ? money(quantity.times(currentPrice.value), currentPrice.currency) : null,
    expectedYield: expectedYieldValue ? money(expectedYieldValue, currency) : null,
    weightPct: null,
  };
}

const operationTypes: Record<string, OperationType> = {
  OPERATION_TYPE_INPUT: "deposit", OPERATION_TYPE_INPUT_SWIFT: "deposit", OPERATION_TYPE_INPUT_ACQUIRING: "deposit",
  OPERATION_TYPE_OUTPUT: "withdrawal", OPERATION_TYPE_OUTPUT_SWIFT: "withdrawal", OPERATION_TYPE_OUTPUT_ACQUIRING: "withdrawal",
  OPERATION_TYPE_BUY: "buy", OPERATION_TYPE_BUY_CARD: "buy", OPERATION_TYPE_BUY_MARGIN: "buy",
  OPERATION_TYPE_SELL: "sell", OPERATION_TYPE_SELL_MARGIN: "sell",
  OPERATION_TYPE_DIVIDEND: "dividend", OPERATION_TYPE_DIV_EXT: "dividend", OPERATION_TYPE_COUPON: "coupon",
  OPERATION_TYPE_TAX: "tax", OPERATION_TYPE_BOND_TAX: "tax", OPERATION_TYPE_DIVIDEND_TAX: "tax",
  OPERATION_TYPE_BROKER_FEE: "fee", OPERATION_TYPE_SERVICE_FEE: "fee",
};

export function mapOperation(raw: Record<string, any>, accountId = raw.accountId ?? raw.account_id ?? ""): BrokerOperation {
  const rawType = String(raw.operationType ?? raw.operation_type ?? "");
  return {
    id: String(raw.id ?? ""),
    accountId,
    date: timestampToIso(raw.date),
    type: operationTypes[rawType] ?? "other",
    description: String(raw.type ?? raw.description ?? rawType ?? "Операция"),
    payment: moneyValueToMoney(raw.payment),
    quantity: raw.quantity === undefined ? null : new Decimal(raw.quantity),
    instrumentId: raw.instrumentUid ?? raw.instrument_uid ?? null,
    figi: raw.figi ?? null,
  };
}

export function mapHistoricCandle(raw: Record<string, any>): Candle {
  return {
    time: timestampToIso(raw.time),
    open: quotationToDecimal(raw.open) ?? new Decimal(0),
    high: quotationToDecimal(raw.high) ?? new Decimal(0),
    low: quotationToDecimal(raw.low) ?? new Decimal(0),
    close: quotationToDecimal(raw.close) ?? new Decimal(0),
    volume: new Decimal(raw.volume ?? 0),
    isComplete: Boolean(raw.isComplete ?? raw.is_complete),
  };
}
