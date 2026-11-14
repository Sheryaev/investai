import { useMemo, useState } from "react";
import type { EChartsOption } from "echarts";
import type { Money } from "../../main/portfolio/money";
import type { PortfolioSnapshot } from "../../main/portfolio/types";
import { Chart } from "../components/Chart";
import { MetricCard } from "../components/MetricCard";
import { StatusBar } from "../components/StatusBar";

interface DashboardPageProps {
  snapshot: PortfolioSnapshot | null;
  stale?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
}

const currencyNames = { RUB: "RUB", USD: "USD", EUR: "EUR", CNY: "CNY" };
const periods = ["1Д", "1Н", "1М", "3М", "1Г", "Всё"] as const;
type ChartPeriod = typeof periods[number];
const periodMilliseconds: Record<Exclude<ChartPeriod, "Всё">, number> = {
  "1Д": 86_400_000,
  "1Н": 7 * 86_400_000,
  "1М": 30 * 86_400_000,
  "3М": 90 * 86_400_000,
  "1Г": 365 * 86_400_000,
};

export function formatMoney(value: Money | null): string {
  if (!value) return "Н/Д";
  const amount = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(Number(value.value));
  return `${amount} ${currencyNames[value.currency]}`;
}

export function formatPercent(value: { toString(): string } | null): string {
  return value ? `${new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(Number(value.toString()))}%` : "Н/Д";
}

const chartColors = ["#7c6cf2", "#35b8a0", "#f2b35c", "#eb7a8a", "#5b9cf5", "#a880e8"];

export function DashboardPage({ snapshot, stale = false, refreshing = false, onRefresh }: DashboardPageProps) {
  const [period, setPeriod] = useState<ChartPeriod>("Всё");
  const history = useMemo(() => {
    if (!snapshot || period === "Всё") return snapshot?.history ?? [];
    const latest = snapshot.history.reduce((maximum, point) => Math.max(maximum, new Date(point.asOf).getTime()), 0);
    const threshold = latest - periodMilliseconds[period];
    return snapshot.history.filter((point) => new Date(point.asOf).getTime() >= threshold);
  }, [snapshot, period]);
  const historyOption = useMemo<EChartsOption>(() => ({
    animation: false,
    color: chartColors,
    grid: { left: 18, right: 18, top: 24, bottom: 18, containLabel: true },
    tooltip: { trigger: "axis" },
    xAxis: { type: "time", axisLine: { lineStyle: { color: "#394152" } }, axisLabel: { color: "#8e98aa" } },
    yAxis: { type: "value", scale: true, splitLine: { lineStyle: { color: "#262d3a" } }, axisLabel: { color: "#8e98aa" } },
    series: [{
      name: "Стоимость",
      type: "line",
      smooth: true,
      showSymbol: false,
      areaStyle: { opacity: 0.12 },
      data: history.map((point) => [point.asOf, point.value.value.toString()]),
    }],
  }), [history]);

  const allocationOption = useMemo<EChartsOption>(() => ({
    animation: false,
    color: chartColors,
    tooltip: { trigger: "item" },
    legend: { bottom: 0, textStyle: { color: "#9ba5b5" } },
    series: [{
      type: "pie",
      radius: ["48%", "72%"],
      center: ["50%", "43%"],
      label: { show: false },
      data: snapshot?.allocations.assets.map((item) => ({ name: item.label, value: Number(item.value.value) })) ?? [],
    }],
  }), [snapshot]);

  if (!snapshot) {
    return (
      <section className="empty-state">
        <span className="eyebrow">INVEST AI</span>
        <h1>Пока нет данных портфеля</h1>
        <p>Подключите read-only токен или откройте демонстрационный режим.</p>
        {onRefresh && <button className="button primary" type="button" onClick={onRefresh}>Загрузить портфель</button>}
      </section>
    );
  }

  const largest = [...snapshot.positions]
    .filter((position) => position.value !== null)
    .sort((a, b) => (b.value?.value ?? a.value!.value).cmp(a.value?.value ?? b.value!.value))
    .slice(0, 5);

  return (
    <div className="page-stack">
      <header className="page-header">
        <div>
          <span className="eyebrow">ПОРТФЕЛЬ</span>
          <h1>Обзор портфеля</h1>
          <p className="muted">Главные показатели и структура ваших активов</p>
        </div>
        <StatusBar asOf={snapshot.asOf} stale={stale} partial={snapshot.completeness === "partial"} refreshing={refreshing} onRefresh={onRefresh} />
      </header>

      <div className="metrics-grid">
        <MetricCard label="Общая стоимость" value={formatMoney(snapshot.totalValue)} detail={snapshot.baseCurrency} />
        <MetricCard label="Свободные средства" value={formatMoney(snapshot.totalCash)} />
        <MetricCard label="Прибыль за день" value={formatMoney(snapshot.dayYield)} detail="Процент: Н/Д" tone={snapshot.dayYield?.value.gte(0) ? "positive" : "negative"} />
        <MetricCard label="Прибыль за весь период" value={formatMoney(snapshot.totalYield)} tone={snapshot.totalYield?.value.gte(0) ? "positive" : "negative"} />
      </div>

      <div className="dashboard-grid">
        <article className="panel chart-panel wide">
          <div className="panel-heading">
            <div><h2>Динамика стоимости</h2><p>{snapshot.history.some((point) => point.estimated) ? "Расчётная оценка" : "Фактические снимки"}</p></div>
            <div className="period-tabs" aria-label="Период графика">{periods.map((item) => <button type="button" key={item} className={period === item ? "active" : ""} onClick={() => setPeriod(item)}>{item}</button>)}</div>
          </div>
          <Chart option={historyOption} ariaLabel="Динамика стоимости портфеля" />
        </article>

        <article className="panel chart-panel">
          <div className="panel-heading"><div><h2>Структура активов</h2><p>По текущей оценке</p></div></div>
          <Chart option={allocationOption} ariaLabel="Распределение по типам активов" />
        </article>

        <article className="panel positions-preview">
          <div className="panel-heading"><div><h2>Крупнейшие позиции</h2><p>Доля от оценённого портфеля</p></div></div>
          <div className="position-list">
            {largest.map((position) => (
              <div className="position-row" key={`${position.accountId}:${position.instrumentId}`}>
                <span className="ticker-badge">{position.ticker.slice(0, 4)}</span>
                <div className="position-name"><strong>{position.ticker}</strong><span>{position.name}</span></div>
                <div className="position-amount"><strong>{formatMoney(position.value)}</strong><span>{formatPercent(position.weightPct)}</span></div>
              </div>
            ))}
            {largest.length === 0 && <p className="muted">Нет оценённых позиций · Н/Д</p>}
          </div>
        </article>
      </div>
    </div>
  );
}
