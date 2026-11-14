import { useMemo } from "react";
import type { EChartsOption } from "echarts";
import { concentration } from "../../main/portfolio/analytics";
import type { Allocation, PortfolioSnapshot } from "../../main/portfolio/types";
import { Chart } from "../components/Chart";
import { MetricCard } from "../components/MetricCard";
import { OperationsTable } from "../components/OperationsTable";
import { formatMoney, formatPercent } from "./DashboardPage";

function allocationChart(title: string, allocations: Allocation[]): EChartsOption {
  return {
    animation: false,
    color: ["#7c6cf2", "#35b8a0", "#f2b35c", "#eb7a8a", "#5b9cf5", "#a880e8"],
    tooltip: { trigger: "item" },
    legend: { bottom: 0, textStyle: { color: "#9ba5b5" } },
    series: [{ name: title, type: "pie", radius: ["42%", "68%"], center: ["50%", "42%"], label: { show: false }, data: allocations.map((item) => ({ name: item.label, value: Number(item.value.value) })) }],
  };
}

export function AnalyticsPage({ snapshot }: { snapshot: PortfolioSnapshot | null }) {
  const metrics = useMemo(() => snapshot ? concentration(snapshot.positions.flatMap((position) => position.value ? [position.value.value] : [])) : null, [snapshot]);
  if (!snapshot || !metrics) return <section className="empty-state"><h1>Нет данных для аналитики</h1><p>Сначала загрузите портфель.</p></section>;
  return (
    <div className="page-stack">
      <header className="page-header"><div><span className="eyebrow">РИСКИ И СТРУКТУРА</span><h1>Аналитика</h1><p className="muted">Концентрация, валюты и отрасли портфеля</p></div></header>
      <div className="metrics-grid">
        <MetricCard label="Общая стоимость" value={formatMoney(snapshot.totalValue)} />
        <MetricCard label="Доходность" value={formatMoney(snapshot.totalYield)} tone={snapshot.totalYield?.value.gte(0) ? "positive" : "negative"} />
        <MetricCard label="Концентрация топ-5" value={formatPercent(metrics.topFivePct)} detail="Доля крупнейших позиций" />
        <MetricCard label="HHI" value={metrics.hhi?.toFixed(4) ?? "Н/Д"} detail="0 — распределённый, 1 — одна позиция" />
      </div>
      <div className="dashboard-grid">
        <article className="panel chart-panel wide"><div className="panel-heading"><div><h2>Валютная структура</h2><p>Без конвертации несовместимых валют</p></div></div><Chart option={allocationChart("Валюты", snapshot.allocations.currencies)} ariaLabel="Валютная структура портфеля" /></article>
        <article className="panel chart-panel"><div className="panel-heading"><div><h2>Отрасли</h2><p>Неизвестные отрасли не скрываются</p></div></div><Chart option={allocationChart("Отрасли", snapshot.allocations.sectors)} ariaLabel="Отраслевая структура портфеля" /></article>
        <article className="panel positions-preview"><div className="panel-heading"><div><h2>Распределение по отраслям</h2><p>Текущая оценка</p></div></div><div className="allocation-list">{snapshot.allocations.sectors.map((item) => <div className="allocation-row" key={item.key}><span>{item.label}</span><strong>{formatMoney(item.value)}</strong><span>{formatPercent(item.percentage)}</span></div>)}</div></article>
      </div>
      <OperationsTable accounts={snapshot.allocations.accounts.map((account) => ({ id: account.key, name: account.label }))} />
    </div>
  );
}
