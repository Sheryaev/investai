import type { Account, Period } from "../demo-data";
import { formatMoney, periods } from "../demo-data";
import { PortfolioChart } from "./PortfolioChart";
import { AllocationChart } from "./AllocationChart";

interface PortfolioOverviewProps {
  account: Account;
  period: Period;
  onPeriod: (period: Period) => void;
}

function trendClass(value: number) {
  if (value > 0) return "positive";
  if (value < 0) return "negative";
  return "";
}

function signed(value: number) {
  return value > 0 ? "+" : "";
}

export function PortfolioOverview({ account, period, onPeriod }: PortfolioOverviewProps) {
  return (
    <div className="overview-grid">
      <section className="card hero-card" aria-labelledby="portfolio-value-label">
        <div>
          <span className="label" id="portfolio-value-label">Стоимость портфеля</span>
          <strong className="portfolio-value">{formatMoney(account.total)}</strong>
        </div>
        <div className="hero-changes">
          <span className={trendClass(account.dayChange)}>
            {signed(account.dayChange)}{formatMoney(account.dayChange)} сегодня
          </span>
          <span className={trendClass(account.totalYieldPct)}>
            {signed(account.totalYieldPct)}{account.totalYieldPct}% за всё время
          </span>
        </div>
      </section>

      <section className="card dynamics-card">
        <div className="card-head">
          <h2>Динамика</h2>
          <div className="periods" aria-label="Период графика">
            {periods.map((item) => (
              <button
                className={item === period ? "active" : ""}
                key={item}
                type="button"
                aria-pressed={item === period}
                onClick={() => onPeriod(item)}
              >
                {item}
              </button>
            ))}
          </div>
        </div>
        <PortfolioChart account={account} period={period} />
      </section>

      <section className="card allocation-card">
        <h2>Активы</h2>
        <AllocationChart items={account.allocation} />
        <ul className="allocation-legend">
          {account.allocation.map((item) => (
            <li key={item.label}>
              <span className="allocation-swatch" style={{ background: item.color }} aria-hidden="true" />
              <span>{item.label}</span>
              <strong>{item.value}%</strong>
            </li>
          ))}
        </ul>
      </section>

      <section className="card positions-card">
        <div className="card-head"><h2>Позиции</h2><span className="label">Топ 5</span></div>
        <ul className="position-list">
          {account.positions.map((position) => (
            <li className="position" key={position.ticker}>
              <span className="ticker" style={{ background: position.color }} aria-hidden="true">
                {position.ticker.slice(0, 1)}
              </span>
              <div className="position-name">
                <strong>{position.ticker}</strong>
                <small>{position.name}</small>
              </div>
              <span className="position-value">
                {formatMoney(position.value)}
                <small>{position.weight}%</small>
              </span>
              <strong className={`position-yield ${trendClass(position.yieldPct)}`}>
                {signed(position.yieldPct)}{position.yieldPct}%
              </strong>
            </li>
          ))}
        </ul>
      </section>

      <section className="card operations-card">
        <h2>Операции</h2>
        <ul className="operation-list">
          {account.operations.map((operation) => (
            <li className="operation" key={operation.title}>
              <div>
                <strong>{operation.title}</strong>
                <small>{operation.detail}</small>
              </div>
              <span className={trendClass(operation.amount)}>
                {signed(operation.amount)}{formatMoney(operation.amount)}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
