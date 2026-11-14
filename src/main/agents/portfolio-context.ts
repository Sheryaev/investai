import type { Money } from "../portfolio/money";
import type { PortfolioSnapshot } from "../portfolio/types";

interface ContextMoney { value: string; currency: string }

function serializeMoney(value: Money | null): ContextMoney | null {
  return value ? { value: value.value.toString(), currency: value.currency } : null;
}

function decimal(value: { toString(): string } | null): string | null {
  return value?.toString() ?? null;
}

export function buildPortfolioContext(snapshot: PortfolioSnapshot) {
  const accountIds = [...new Set([
    ...snapshot.positions.map((position) => position.accountId),
    ...snapshot.cash.map((balance) => balance.accountId),
  ])].sort();
  const aliases = new Map(accountIds.map((id, index) => [id, `Счёт ${index + 1}`]));
  const allocation = (items: PortfolioSnapshot["allocations"]["assets"], accounts = false) => items.map((item) => ({
    ...(accounts ? { account: aliases.get(item.key) ?? "Счёт" } : { key: item.key, label: item.label }),
    value: serializeMoney(item.value), percentage: decimal(item.percentage),
  }));
  return {
    version: 1,
    asOf: snapshot.asOf,
    baseCurrency: snapshot.baseCurrency,
    completeness: snapshot.completeness,
    estimated: snapshot.estimated,
    totals: {
      value: serializeMoney(snapshot.totalValue), cash: serializeMoney(snapshot.totalCash),
      dayYield: serializeMoney(snapshot.dayYield), totalYield: serializeMoney(snapshot.totalYield),
    },
    accounts: accountIds.map((id) => ({ alias: aliases.get(id) })),
    positions: snapshot.positions.map((position) => ({
      account: aliases.get(position.accountId) ?? "Счёт", ticker: position.ticker, name: position.name,
      assetType: position.assetType, sector: position.sector, currency: position.currency,
      quantity: position.quantity.toString(), averagePrice: serializeMoney(position.averagePrice),
      currentPrice: serializeMoney(position.currentPrice), value: serializeMoney(position.value),
      expectedYield: serializeMoney(position.expectedYield), weightPct: decimal(position.weightPct),
    })),
    allocations: {
      assets: allocation(snapshot.allocations.assets), currencies: allocation(snapshot.allocations.currencies),
      sectors: allocation(snapshot.allocations.sectors), accounts: allocation(snapshot.allocations.accounts, true),
    },
    history: snapshot.history.slice(-60).map((point) => ({ asOf: point.asOf, value: serializeMoney(point.value), estimated: point.estimated })),
  };
}

export function buildPortfolioPrompt(snapshot: PortfolioSnapshot, question: string): string {
  const context = JSON.stringify(buildPortfolioContext(snapshot));
  return `Ты — аналитик инвестиционного портфеля. Ответь на русском языке, используя только JSON ниже.\n` +
    `Укажи время снимка, отделяй факты от интерпретаций, не скрывай неполные или оценочные данные.\n` +
    `Не задавай уточняющих вопросов: если данных недостаточно, явно укажи ограничение и выполни возможный анализ.\n` +
    `Не обещай доходность и не предлагай торговых действий. Это аналитика, а не индивидуальная инвестиционная рекомендация.\n\n` +
    `Снимок портфеля (деньги и количества — точные десятичные строки):\n${context}\n\nЗапрос пользователя:\n${question}`;
}
