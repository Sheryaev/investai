import Decimal from "decimal.js";
import { calculateSnapshot } from "../portfolio/analytics";
import { money } from "../portfolio/money";
import type { Position } from "../portfolio/types";
import type { BrokerAccount, BrokerOperation, BrokerPortfolio, Candle, CandleInterval, InvestGateway } from "./gateway";

const account: BrokerAccount = { id: "raw-account-1", name: "Основной счёт", type: "Брокерский счёт", status: "Открыт", accessLevel: "READ_ONLY" };

const positions: Position[] = [
  ["sber", "SBER", "Сбербанк", "Финансы", 20, "305.4", "267.2"],
  ["yndx", "YNDX", "Яндекс", "Технологии", 4, "4285", "3901"],
  ["gazp", "GAZP", "Газпром", "Энергетика", 35, "178.32", "165.1"],
  ["lkoh", "LKOH", "Лукойл", "Энергетика", 2, "6975", "6420"],
].map(([id, ticker, name, sector, quantity, price, average]) => ({
  instrumentId: String(id), accountId: account.id, accountName: account.name,
  ticker: String(ticker), name: String(name), assetType: "share", sector: String(sector), currency: "RUB",
  quantity: new Decimal(String(quantity)),
  averagePrice: money(String(average), "RUB"), currentPrice: money(String(price), "RUB"),
  value: money(new Decimal(String(quantity)).times(String(price)), "RUB"),
  expectedYield: money(new Decimal(String(quantity)).times(new Decimal(String(price)).minus(String(average))), "RUB"),
  weightPct: null,
}));

export class FixtureGateway implements InvestGateway {
  async listAccounts(): Promise<BrokerAccount[]> { return [account]; }

  async getPortfolio(accountId: string): Promise<BrokerPortfolio> {
    const accountPositions = positions.map((position) => ({ ...position, accountId }));
    const snapshot = calculateSnapshot(accountPositions, [], new Date().toISOString());
    return { accountId, totalValue: snapshot.totalValue, expectedYieldPct: new Decimal("12.84"), positions: accountPositions };
  }

  async getPositions(accountId: string) {
    return [{ accountId, currency: "RUB" as const, value: new Decimal("22500") }];
  }

  async getOperations(accountId: string, from: string, to: string): Promise<BrokerOperation[]> {
    const operations: BrokerOperation[] = [
      { id: "op-1", accountId, date: "2026-11-14T09:15:00.000Z", type: "dividend", description: "Дивиденды Сбербанк", payment: money("1250", "RUB"), quantity: null, instrumentId: "sber", figi: "sber" },
      { id: "op-2", accountId, date: "2026-11-12T12:30:00.000Z", type: "buy", description: "Покупка YNDX", payment: money("-17140", "RUB"), quantity: new Decimal(4), instrumentId: "yndx", figi: "yndx" },
      { id: "op-3", accountId, date: "2026-11-10T08:00:00.000Z", type: "deposit", description: "Пополнение счёта", payment: money("30000", "RUB"), quantity: null, instrumentId: null, figi: null },
      { id: "op-4", accountId, date: "2026-11-05T14:20:00.000Z", type: "coupon", description: "Купон ОФЗ 26238", payment: money("842.5", "RUB"), quantity: null, instrumentId: "ofz", figi: "ofz" },
    ];
    const fromMs = new Date(from).getTime();
    const toMs = new Date(to).getTime();
    return operations.filter((operation) => {
      const time = new Date(operation.date).getTime();
      return time >= fromMs && time <= toMs;
    });
  }

  async getCandles(instrumentId: string, from: string, to: string, interval: CandleInterval): Promise<Candle[]> {
    const start = new Date(from).getTime();
    const end = new Date(to).getTime();
    const step = interval === "1d" ? 86_400_000 : interval === "1w" ? 604_800_000 : 3_600_000;
    const result: Candle[] = [];
    for (let time = start, index = 0; time <= end && result.length < 400; time += step, index += 1) {
      const base = 250 + index * 0.7 + Math.sin(index / 4) * 18;
      const open = new Decimal(base.toFixed(2));
      const close = new Decimal((base + Math.cos(index) * 3).toFixed(2));
      result.push({ time: new Date(time).toISOString(), open, close,
        high: open.plus(5), low: open.minus(5), volume: new Decimal(1000 + index * 17), isComplete: true });
    }
    return result;
  }
}
