import { useMemo, useState } from "react";
import type { PortfolioSnapshot, Position } from "../../main/portfolio/types";
import { formatMoney, formatPercent } from "../pages/DashboardPage";

interface PositionsTableProps {
  positions: Position[];
  accounts: PortfolioSnapshot["allocations"]["accounts"];
  onSelect: (position: Position) => void;
}

export function PositionsTable({ positions, accounts, onSelect }: PositionsTableProps) {
  const [query, setQuery] = useState("");
  const [account, setAccount] = useState("");
  const [assetType, setAssetType] = useState("");
  const [descending, setDescending] = useState(true);
  const accountNames = new Map(accounts.map((item) => [item.key, item.label]));
  for (const position of positions) accountNames.set(position.accountId, position.accountName);

  const filtered = useMemo(() => positions
    .filter((position) => `${position.ticker} ${position.name}`.toLowerCase().includes(query.trim().toLowerCase()))
    .filter((position) => !account || position.accountId === account)
    .filter((position) => !assetType || position.assetType === assetType)
    .sort((a, b) => {
      const direction = descending ? -1 : 1;
      if (!a.value && !b.value) return a.ticker.localeCompare(b.ticker);
      if (!a.value) return 1;
      if (!b.value) return -1;
      return a.value.value.cmp(b.value.value) * direction;
    }), [positions, query, account, assetType, descending]);

  return (
    <div className="table-stack">
      <div className="table-filters">
        <input className="field search-field" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Тикер или название" />
        <select className="field" aria-label="Счёт" value={account} onChange={(event) => setAccount(event.target.value)}>
          <option value="">Все счета</option>
          {[...accountNames].map(([id, name]) => <option value={id} key={id}>{name}</option>)}
        </select>
        <select className="field" aria-label="Тип актива" value={assetType} onChange={(event) => setAssetType(event.target.value)}>
          <option value="">Все активы</option>
          <option value="share">Акции</option><option value="bond">Облигации</option>
          <option value="etf">Фонды</option><option value="currency">Валюта</option><option value="other">Другое</option>
        </select>
      </div>
      <div className="table-scroll">
        <table className="data-table">
          <thead><tr><th>Инструмент</th><th>Количество</th><th>Средняя</th><th>Текущая</th><th><button type="button" onClick={() => setDescending((value) => !value)}>Стоимость {descending ? "↓" : "↑"}</button></th><th>Доля</th><th>Доходность</th></tr></thead>
          <tbody>
            {filtered.map((position) => (
              <tr key={`${position.accountId}:${position.instrumentId}`}>
                <td><button className="instrument-link" type="button" aria-label={`Открыть ${position.ticker}`} onClick={() => onSelect(position)}><strong>{position.ticker}</strong><span>{position.name}</span></button></td>
                <td>{position.quantity.toString()}</td>
                <td>{formatMoney(position.averagePrice)}</td>
                <td>{formatMoney(position.currentPrice)}</td>
                <td>{formatMoney(position.value)}</td>
                <td>{formatPercent(position.weightPct)}</td>
                <td className={position.expectedYield?.value.gte(0) ? "positive" : "negative"}>{formatMoney(position.expectedYield)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <p className="table-empty">Позиции по выбранным фильтрам не найдены.</p>}
      </div>
    </div>
  );
}
