import Decimal from "decimal.js";
import type { Currency } from "./types";

export interface Money {
  value: Decimal;
  currency: Currency;
}

export const money = (value: Decimal.Value, currency: Currency): Money => ({
  value: new Decimal(value),
  currency,
});

export function totalValue(values: Money[], currency: Currency): Money | null {
  if (values.some((item) => item.currency !== currency)) return null;
  return values.reduce<Money>(
    (sum, item) => ({ value: sum.value.plus(item.value), currency }),
    money(0, currency),
  );
}
