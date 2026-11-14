import Decimal from "decimal.js";
import { money, totalValue } from "./money";
import type {
  Allocation,
  AllocationGroups,
  AssetType,
  CashBalance,
  Currency,
  PortfolioSnapshot,
  Position,
} from "./types";

const assetLabels: Record<AssetType, string> = {
  share: "Акции",
  bond: "Облигации",
  etf: "Фонды",
  currency: "Валюта",
  futures: "Фьючерсы",
  option: "Опционы",
  other: "Другое",
};

interface AllocationInput {
  key: string;
  label: string;
  value: Decimal;
}

function allocations(inputs: AllocationInput[], total: Decimal, currency: Currency): Allocation[] {
  const groups = new Map<string, AllocationInput>();
  for (const input of inputs) {
    const current = groups.get(input.key);
    groups.set(input.key, current
      ? { ...current, value: current.value.plus(input.value) }
      : input);
  }
  return [...groups.values()]
    .map((input) => ({
      ...input,
      value: money(input.value, currency),
      percentage: total.isZero() ? null : input.value.div(total).mul(100),
    }))
    .sort((a, b) => b.value.value.cmp(a.value.value));
}

function buildAllocations(positions: Position[], cash: CashBalance[], total: Decimal | null, currency: Currency): AllocationGroups {
  if (total === null) return { assets: [], currencies: [], accounts: [], sectors: [] };
  const valuedPositions = positions.flatMap((position) => position.value
    ? [{ ...position, value: position.value.value }]
    : []);
  const cashInputs = cash.map((balance) => ({
    accountId: balance.accountId,
    currency: balance.currency,
    value: balance.value,
  }));
  return {
    assets: allocations(valuedPositions.map((position) => ({
      key: position.assetType,
      label: assetLabels[position.assetType],
      value: position.value,
    })), total, currency),
    currencies: allocations([
      ...valuedPositions.map((position) => ({ key: position.currency, label: position.currency, value: position.value })),
      ...cashInputs.map((balance) => ({ key: balance.currency, label: balance.currency, value: balance.value })),
    ], total, currency),
    accounts: allocations([
      ...valuedPositions.map((position) => ({ key: position.accountId, label: position.accountName, value: position.value })),
      ...cashInputs.map((balance) => ({ key: balance.accountId, label: balance.accountId, value: balance.value })),
    ], total, currency),
    sectors: allocations(valuedPositions.map((position) => ({
      key: position.sector ?? "unknown",
      label: position.sector ?? "Не указано",
      value: position.value,
    })), total, currency),
  };
}

export function calculateSnapshot(
  positions: Position[],
  cash: CashBalance[],
  asOf: string,
  baseCurrency: Currency = "RUB",
): PortfolioSnapshot {
  const values = [...positions.map((position) => position.value), ...cash.map((balance) => money(balance.value, balance.currency))];
  const hasMissingValue = values.some((value) => value === null);
  const total = hasMissingValue
    ? null
    : totalValue(values.filter((value) => value !== null), baseCurrency);
  const totalCash = totalValue(cash.map((balance) => money(balance.value, balance.currency)), baseCurrency);
  const yields = positions.map((position) => position.expectedYield);
  const totalYield = yields.some((value) => value === null)
    ? null
    : totalValue(yields.filter((value) => value !== null), baseCurrency);
  const totalNumber = total?.value ?? null;

  return {
    id: `snapshot:${asOf}`,
    asOf,
    baseCurrency,
    completeness: total === null ? "partial" : "complete",
    estimated: false,
    totalValue: total,
    totalCash,
    dayYield: null,
    totalYield,
    positions: positions.map((position) => ({
      ...position,
      weightPct: totalNumber && !totalNumber.isZero() && position.value?.currency === baseCurrency
        ? position.value.value.div(totalNumber).mul(100)
        : null,
    })),
    cash,
    allocations: buildAllocations(positions, cash, totalNumber, baseCurrency),
    history: [],
  };
}

export function concentration(values: Decimal[]): { topFivePct: Decimal | null; hhi: Decimal | null } {
  const positive = values.filter((value) => value.gt(0));
  const total = positive.reduce((sum, value) => sum.plus(value), new Decimal(0));
  if (total.isZero()) return { topFivePct: null, hhi: null };
  const weights = positive.map((value) => value.div(total)).sort((a, b) => b.cmp(a));
  return {
    topFivePct: weights.slice(0, 5).reduce((sum, value) => sum.plus(value), new Decimal(0)).mul(100),
    hhi: weights.reduce((sum, value) => sum.plus(value.pow(2)), new Decimal(0)),
  };
}
