import * as grpc from "@grpc/grpc-js";
import { loadSync } from "@grpc/proto-loader";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { CashBalance, Currency } from "../portfolio/types";
import type { BrokerAccount, BrokerOperation, BrokerPortfolio, Candle, CandleInterval, InvestGateway } from "./gateway";
import { mapHistoricCandle, mapOperation, mapPortfolioPosition, moneyValueToMoney, quotationToDecimal } from "./mapping";

const defaultContractsRoot = join(dirname(fileURLToPath(import.meta.url)), "../../vendor/invest-contracts");
const endpoint = "invest-public-api.tinkoff.ru:443";
const intervals: Record<CandleInterval, string> = {
  "1m": "CANDLE_INTERVAL_1_MIN", "5m": "CANDLE_INTERVAL_5_MIN", "15m": "CANDLE_INTERVAL_15_MIN",
  "1h": "CANDLE_INTERVAL_HOUR", "1d": "CANDLE_INTERVAL_DAY", "1w": "CANDLE_INTERVAL_WEEK", "1M": "CANDLE_INTERVAL_MONTH",
};

interface GrpcClients {
  users: any;
  operations: any;
  instruments: any;
  marketData: any;
}

function call<T>(client: any, method: string, request: Record<string, unknown>, metadata: grpc.Metadata): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    client[method](request, metadata, (error: grpc.ServiceError | null, response: T) => {
      if (error) reject(error); else resolve(response);
    });
  });
}

export class TInvestGateway implements InvestGateway {
  private readonly clients: GrpcClients;
  private readonly metadata = new grpc.Metadata();

  constructor(token: string, contractsRoot = defaultContractsRoot, clients?: GrpcClients) {
    if (!token.trim()) throw new Error("Токен Т-Инвестиций не может быть пустым.");
    this.metadata.set("authorization", `Bearer ${token}`);
    if (clients) {
      this.clients = clients;
      return;
    }
    const files = ["users", "operations", "instruments", "marketdata"].map((name) => join(contractsRoot, `${name}.proto`));
    const definition = loadSync(files, {
      keepCase: false, longs: String, enums: String, defaults: true, oneofs: true,
      includeDirs: [contractsRoot],
    });
    const loaded: any = grpc.loadPackageDefinition(definition);
    const contract = loaded.tinkoff.public.invest.api.contract.v1;
    const credentials = grpc.credentials.createSsl();
    this.clients = {
      users: new contract.UsersService(endpoint, credentials),
      operations: new contract.OperationsService(endpoint, credentials),
      instruments: new contract.InstrumentsService(endpoint, credentials),
      marketData: new contract.MarketDataService(endpoint, credentials),
    };
  }

  async listAccounts(): Promise<BrokerAccount[]> {
    const response = await call<any>(this.clients.users, "GetAccounts", {}, this.metadata);
    return (response.accounts ?? []).map((account: any) => ({
      id: account.id, name: account.name || `Счёт ${account.id.slice(-4)}`,
      type: account.type, status: account.status, accessLevel: account.accessLevel,
    }));
  }

  async getPortfolio(accountId: string, currency: Currency = "RUB"): Promise<BrokerPortfolio> {
    const response = await call<any>(this.clients.operations, "GetPortfolio", { accountId, currency }, this.metadata);
    const positions = await Promise.all((response.positions ?? []).map(async (raw: any) => {
      const base = mapPortfolioPosition(raw, { accountId, accountName: accountId });
      try {
        const instrumentResponse = await call<any>(this.clients.instruments, "GetInstrumentBy", {
          idType: "INSTRUMENT_ID_TYPE_UID", id: base.instrumentId,
        }, this.metadata);
        const instrument = instrumentResponse.instrument;
        return mapPortfolioPosition(raw, { accountId, accountName: accountId }, instrument);
      } catch {
        return base;
      }
    }));
    return {
      accountId,
      totalValue: moneyValueToMoney(response.totalAmountPortfolio),
      expectedYieldPct: quotationToDecimal(response.expectedYield),
      positions,
    };
  }

  async getPositions(accountId: string): Promise<CashBalance[]> {
    const response = await call<any>(this.clients.operations, "GetPositions", { accountId }, this.metadata);
    return (response.money ?? []).flatMap((raw: any) => {
      const value = moneyValueToMoney(raw);
      return value ? [{ accountId, currency: value.currency, value: value.value }] : [];
    });
  }

  async getOperations(accountId: string, from: string, to: string): Promise<BrokerOperation[]> {
    const response = await call<any>(this.clients.operations, "GetOperations", {
      accountId, from: new Date(from), to: new Date(to), state: "OPERATION_STATE_EXECUTED",
    }, this.metadata);
    return (response.operations ?? []).map((operation: any) => mapOperation(operation, accountId));
  }

  async getCandles(instrumentId: string, from: string, to: string, interval: CandleInterval): Promise<Candle[]> {
    const response = await call<any>(this.clients.marketData, "GetCandles", {
      instrumentId, from: new Date(from), to: new Date(to), interval: intervals[interval],
    }, this.metadata);
    return (response.candles ?? []).map(mapHistoricCandle);
  }

  close(): void {
    for (const client of Object.values(this.clients)) client.close();
  }
}
