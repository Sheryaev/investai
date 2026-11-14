import type Decimal from "decimal.js";
import type { Money } from "../portfolio/money";
import type { CashBalance, Currency, Position } from "../portfolio/types";

export interface BrokerAccount {
  id: string;
  name: string;
  type: string;
  status: string;
  accessLevel: string;
}

export interface BrokerPortfolio {
  accountId: string;
  totalValue: Money | null;
  expectedYieldPct: Decimal | null;
  positions: Position[];
}

export type OperationType = "deposit" | "withdrawal" | "buy" | "sell" | "dividend" | "coupon" | "fee" | "tax" | "other";

export interface BrokerOperation {
  id: string;
  accountId: string;
  date: string;
  type: OperationType;
  description: string;
  payment: Money | null;
  quantity: Decimal | null;
  instrumentId: string | null;
  figi: string | null;
}

export type CandleInterval = "1m" | "5m" | "15m" | "1h" | "1d" | "1w" | "1M";

export interface Candle {
  time: string;
  open: Decimal;
  high: Decimal;
  low: Decimal;
  close: Decimal;
  volume: Decimal;
  isComplete: boolean;
}

export interface InvestGateway {
  listAccounts(): Promise<BrokerAccount[]>;
  getPortfolio(accountId: string, currency?: Currency): Promise<BrokerPortfolio>;
  getPositions(accountId: string): Promise<CashBalance[]>;
  getOperations(accountId: string, from: string, to: string): Promise<BrokerOperation[]>;
  getCandles(instrumentId: string, from: string, to: string, interval: CandleInterval): Promise<Candle[]>;
}
