import { Database } from "./database/database";
import { SnapshotRepository } from "./database/snapshot-repository";
import { ChatRepository } from "./database/chat-repository";
import { serializeSnapshot } from "./database/snapshot-codec";
import { serializeCandles, serializeOperations } from "../shared/market-codec";
import type { CandleInterval, InvestGateway } from "./invest/gateway";
import { PortfolioService } from "./portfolio/service";
import type { Currency } from "./portfolio/types";

export class InvestContainer {
  private readonly repository: SnapshotRepository;
  readonly portfolio: PortfolioService;
  readonly chat: ChatRepository;

  constructor(databaseLocation: string, private gateway: InvestGateway) {
    const database = new Database(databaseLocation);
    this.repository = new SnapshotRepository(database);
    this.chat = new ChatRepository(database);
    this.portfolio = new PortfolioService(gateway, this.repository);
  }

  latestSnapshot(): string | null {
    const snapshot = this.portfolio.cached();
    return snapshot ? serializeSnapshot(snapshot) : null;
  }

  async refreshSnapshot(accountIds?: string[], baseCurrency: Currency = "RUB"): Promise<string> {
    return serializeSnapshot(await this.portfolio.refresh(accountIds, baseCurrency));
  }

  async listAccounts() {
    return this.gateway.listAccounts();
  }

  useGateway(gateway: InvestGateway): void {
    const previous = this.gateway;
    this.gateway = gateway;
    this.portfolio.useGateway(gateway);
    if (previous !== gateway && "close" in previous && typeof previous.close === "function") previous.close();
  }

  async operations(accountId: string, from: string, to: string): Promise<string> {
    return serializeOperations(await this.portfolio.operations(accountId, from, to));
  }

  async candles(instrumentId: string, from: string, to: string, interval: CandleInterval): Promise<string> {
    return serializeCandles(await this.portfolio.candles(instrumentId, from, to, interval));
  }

  close(): void {
    if ("close" in this.gateway && typeof this.gateway.close === "function") this.gateway.close();
    this.repository.close();
  }
}
