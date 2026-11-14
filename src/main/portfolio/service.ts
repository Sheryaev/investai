import type { BrokerAccount, BrokerOperation, Candle, CandleInterval, InvestGateway } from "../invest/gateway";
import type { SnapshotRepository } from "../database/snapshot-repository";
import { AppError, normalizeError, type ErrorCategory } from "../../shared/errors";
import { calculateSnapshot } from "./analytics";
import type { CashBalance, Currency, PortfolioSnapshot, Position } from "./types";

interface PortfolioServiceOptions {
  now?: () => Date;
  sleep?: (milliseconds: number) => Promise<void>;
  concurrency?: number;
}

interface AccountResult {
  positions: Position[];
  cash: CashBalance[];
  error: { accountId: string; category: ErrorCategory } | null;
}

function assertDateRange(from: string, to: string): void {
  const fromTime = Date.parse(from);
  const toTime = Date.parse(to);
  if (!Number.isFinite(fromTime) || !Number.isFinite(toTime) || fromTime > toTime) {
    throw new AppError("invalid_response", "Некорректный период: проверьте даты начала и окончания.");
  }
}

export class PortfolioService {
  private inFlight: Promise<PortfolioSnapshot> | null = null;
  private readonly now: () => Date;
  private readonly sleep: (milliseconds: number) => Promise<void>;
  private readonly concurrency: number;
  lastErrors: Array<{ accountId: string; category: ErrorCategory }> = [];

  constructor(
    private gateway: InvestGateway,
    private readonly repository: SnapshotRepository,
    options: PortfolioServiceOptions = {},
  ) {
    this.now = options.now ?? (() => new Date());
    this.sleep = options.sleep ?? ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
    this.concurrency = Math.max(1, Math.min(3, options.concurrency ?? 3));
  }

  cached(): PortfolioSnapshot | null {
    return this.repository.latest();
  }

  refresh(accountIds?: string[], baseCurrency: Currency = "RUB"): Promise<PortfolioSnapshot> {
    if (this.inFlight) return this.inFlight;
    const task = this.performRefresh(accountIds, baseCurrency).finally(() => {
      if (this.inFlight === task) this.inFlight = null;
    });
    this.inFlight = task;
    return task;
  }

  async operations(accountId: string, from: string, to: string): Promise<BrokerOperation[]> {
    assertDateRange(from, to);
    try {
      return await this.gateway.getOperations(accountId, from, to);
    } catch (error) {
      throw normalizeError(error);
    }
  }

  async candles(instrumentId: string, from: string, to: string, interval: CandleInterval): Promise<Candle[]> {
    assertDateRange(from, to);
    try {
      return await this.gateway.getCandles(instrumentId, from, to, interval);
    } catch (error) {
      throw normalizeError(error);
    }
  }

  useGateway(gateway: InvestGateway): void {
    this.gateway = gateway;
  }

  private async performRefresh(accountIds: string[] | undefined, baseCurrency: Currency): Promise<PortfolioSnapshot> {
    let accounts: BrokerAccount[];
    try {
      const available = await this.gateway.listAccounts();
      accounts = accountIds && accountIds.length > 0 ? available.filter((account) => accountIds.includes(account.id)) : available;
    } catch (error) {
      throw normalizeError(error);
    }

    const results = new Array<AccountResult>(accounts.length);
    let cursor = 0;
    const worker = async () => {
      while (cursor < accounts.length) {
        const index = cursor++;
        results[index] = await this.loadAccount(accounts[index], baseCurrency);
      }
    };
    await Promise.all(Array.from({ length: Math.min(this.concurrency, accounts.length) }, () => worker()));

    const successful = results.filter((result) => result.error === null);
    this.lastErrors = results.flatMap((result) => result.error ? [result.error] : []);
    if (accounts.length > 0 && successful.length === 0) {
      const category = this.lastErrors[0]?.category ?? "network";
      throw new AppError(category, "Не удалось обновить ни один выбранный счёт. Последний снимок сохранён.");
    }

    const snapshot = calculateSnapshot(
      results.flatMap((result) => result.positions),
      results.flatMap((result) => result.cash),
      this.now().toISOString(),
      baseCurrency,
    );
    if (this.lastErrors.length > 0) snapshot.completeness = "partial";
    try {
      this.repository.save(snapshot);
    } catch {
      throw new AppError("storage", "Не удалось сохранить снимок портфеля локально.");
    }
    return snapshot;
  }

  private async loadAccount(account: BrokerAccount, baseCurrency: Currency): Promise<AccountResult> {
    try {
      const portfolio = await this.withRetry(() => this.gateway.getPortfolio(account.id, baseCurrency));
      const cash = await this.withRetry(() => this.gateway.getPositions(account.id));
      return {
        positions: portfolio.positions.map((position) => ({ ...position, accountName: account.name })),
        cash,
        error: null,
      };
    } catch (error) {
      return { positions: [], cash: [], error: { accountId: account.id, category: normalizeError(error).category } };
    }
  }

  private async withRetry<T>(operation: () => Promise<T>): Promise<T> {
    const delays = [500, 1500];
    for (let attempt = 0; ; attempt += 1) {
      try {
        return await operation();
      } catch (error) {
        const normalized = normalizeError(error);
        if (attempt >= delays.length || !["network", "rate_limit"].includes(normalized.category)) throw normalized;
        await this.sleep(normalized.retryAfterMs ?? delays[attempt]);
      }
    }
  }
}
