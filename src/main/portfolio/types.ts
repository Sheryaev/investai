import type Decimal from "decimal.js";
import type { Money } from "./money";

export type Currency = "RUB" | "USD" | "EUR" | "CNY";
export type AssetType = "share" | "bond" | "etf" | "currency" | "futures" | "option" | "other";
export type Completeness = "complete" | "partial";

export interface Position {
  instrumentId: string;
  accountId: string;
  accountName: string;
  ticker: string;
  name: string;
  assetType: AssetType;
  sector: string | null;
  currency: Currency;
  quantity: Decimal;
  averagePrice: Money | null;
  currentPrice: Money | null;
  value: Money | null;
  expectedYield: Money | null;
  weightPct: Decimal | null;
}

export interface CashBalance {
  accountId: string;
  currency: Currency;
  value: Decimal;
}

export interface Allocation {
  key: string;
  label: string;
  value: Money;
  percentage: Decimal | null;
}

export interface AllocationGroups {
  assets: Allocation[];
  currencies: Allocation[];
  accounts: Allocation[];
  sectors: Allocation[];
}

export interface HistoryPoint {
  asOf: string;
  value: Money;
  estimated: boolean;
}

export interface PortfolioSnapshot {
  id: string;
  asOf: string;
  baseCurrency: Currency;
  completeness: Completeness;
  estimated: boolean;
  totalValue: Money | null;
  totalCash: Money | null;
  dayYield: Money | null;
  totalYield: Money | null;
  positions: Position[];
  cash: CashBalance[];
  allocations: AllocationGroups;
  history: HistoryPoint[];
}
