import { useEffect, useMemo, useRef, useState } from "react";
import type { EChartsOption } from "echarts";
import type { BrokerOperation, Candle, CandleInterval } from "../../main/invest/gateway";
import type { Position } from "../../main/portfolio/types";
import { deserializeCandles, deserializeOperations } from "../../shared/market-codec";
import { Chart } from "./Chart";
import { formatMoney, formatPercent } from "../pages/DashboardPage";

interface InstrumentDrawerProps {
  position: Position;
  onClose: () => void;
}

const periods = {
  "1Д": { days: 1, interval: "1h" },
  "1Н": { days: 7, interval: "1h" },
  "1М": { days: 30, interval: "1d" },
  "1Г": { days: 365, interval: "1w" },
} as const satisfies Record<string, { days: number; interval: CandleInterval }>;
type Period = keyof typeof periods;

export function InstrumentDrawer({ position, onClose }: InstrumentDrawerProps) {
  const [period, setPeriod] = useState<Period>("1М");
  const [candles, setCandles] = useState<Candle[]>([]);
  const [operations, setOperations] = useState<BrokerOperation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  useEffect(() => {
    const id = ++requestId.current;
    const to = new Date();
    const from = new Date(to.getTime() - periods[period].days * 86_400_000);
    setLoading(true);
    setError(null);
    setCandles([]);
    setOperations([]);
    const range = { from: from.toISOString(), to: to.toISOString() };
    void Promise.allSettled([
      window.investAi.getCandles({ instrumentId: position.instrumentId, ...range, interval: periods[period].interval }).then(deserializeCandles),
      window.investAi.getOperations({ accountId: position.accountId, ...range }).then(deserializeOperations),
    ]).then(([candleResult, operationResult]) => {
      if (requestId.current !== id) return;
      const loadedCandles = candleResult.status === "fulfilled" ? candleResult.value : [];
      const loadedOperations = operationResult.status === "fulfilled" ? operationResult.value : [];
      setCandles(loadedCandles);
      setOperations(loadedOperations.filter((operation) => operation.instrumentId === position.instrumentId || operation.figi === position.instrumentId));
      if (candleResult.status === "rejected" || operationResult.status === "rejected") {
        setError("Часть данных инструмента недоступна. Показаны загруженные сведения.");
      }
      setLoading(false);
    });
    return () => { requestId.current += 1; };
  }, [position.instrumentId, position.accountId, period]);

  const option = useMemo<EChartsOption>(() => ({
    animation: false,
    backgroundColor: "transparent",
    legend: { top: 0, right: 0, textStyle: { color: "#8d98a9", fontSize: 10 } },
    axisPointer: { link: [{ xAxisIndex: "all" }] },
    grid: [
      { left: 12, right: 12, top: 34, height: "54%", containLabel: true },
      { left: 12, right: 12, top: "73%", bottom: 20, containLabel: true },
    ],
    tooltip: { trigger: "axis", axisPointer: { type: "cross" } },
    xAxis: [
      { type: "category", data: candles.map((item) => item.time), axisLabel: { color: "#788497", hideOverlap: true }, axisLine: { lineStyle: { color: "#343d4c" } } },
      { type: "category", gridIndex: 1, data: candles.map((item) => item.time), axisLabel: { show: false }, axisLine: { lineStyle: { color: "#343d4c" } } },
    ],
    yAxis: [
      { type: "value", scale: true, axisLabel: { color: "#788497" }, splitLine: { lineStyle: { color: "#252c38" } } },
      { type: "value", gridIndex: 1, axisLabel: { color: "#788497" }, splitLine: { show: false } },
    ],
    series: [
      { name: "Свечи", type: "candlestick", data: candles.map((item) => [item.open.toString(), item.close.toString(), item.low.toString(), item.high.toString()]), itemStyle: { color: "#35b8a0", color0: "#e7838e", borderColor: "#35b8a0", borderColor0: "#e7838e" } },
      { name: "Объём", type: "bar", xAxisIndex: 1, yAxisIndex: 1, data: candles.map((item) => item.volume.toString()), itemStyle: { color: "#6659ae" } },
    ],
  }), [candles]);

  return (
    <div className="drawer-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <aside className="instrument-drawer" role="dialog" aria-modal="true" aria-label={position.ticker}>
        <header className="drawer-header">
          <div><span className="eyebrow">ИНСТРУМЕНТ</span><h1>{position.ticker}</h1><p className="muted">{position.name}</p></div>
          <button className="icon-button" type="button" aria-label="Закрыть" onClick={onClose}>×</button>
        </header>
        <div className="instrument-metrics">
          <div><span>Текущая цена</span><strong>{formatMoney(position.currentPrice)}</strong></div>
          <div><span>Стоимость позиции</span><strong>{formatMoney(position.value)}</strong></div>
          <div><span>Доля портфеля</span><strong>{formatPercent(position.weightPct)}</strong></div>
          <div><span>Доходность</span><strong>{formatMoney(position.expectedYield)}</strong></div>
        </div>
        <dl className="instrument-details">
          <div><dt>Количество</dt><dd>{position.quantity.toString()}</dd></div>
          <div><dt>Средняя цена</dt><dd>{formatMoney(position.averagePrice)}</dd></div>
          <div><dt>Счёт</dt><dd>{position.accountName}</dd></div>
          <div><dt>Отрасль</dt><dd>{position.sector ?? "Не указано"}</dd></div>
        </dl>
        <section className="instrument-market">
          <div className="operations-heading">
            <div><h2>Динамика цены</h2><p className="muted">Свечи и объём торгов</p></div>
            <div className="period-tabs" aria-label="Период графика">
              {(Object.keys(periods) as Period[]).map((item) => <button key={item} type="button" className={period === item ? "active" : ""} onClick={() => setPeriod(item)}>{item}</button>)}
            </div>
          </div>
          {error && <div className="inline-alert" role="alert">{error}</div>}
          {loading && <p className="table-empty">Загружаем рыночные данные…</p>}
          {!loading && candles.length > 0 && <Chart option={option} ariaLabel={`Свечной график ${position.ticker}`} className="instrument-chart" />}
          {!loading && candles.length === 0 && <p className="table-empty">Свечи за выбранный период недоступны.</p>}
          <span className="chart-volume-label">Объём</span>
        </section>
        <section className="instrument-operations">
          <h2>Операции по инструменту</h2>
          {!loading && operations.length === 0 && <p className="muted">За выбранный период операций нет.</p>}
          {operations.map((operation) => <div className="instrument-operation" key={operation.id}>
            <div><strong>{operation.description}</strong><span>{new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(operation.date))}</span></div>
            <strong className={operation.payment?.value.gte(0) ? "positive" : "negative"}>{formatMoney(operation.payment)}</strong>
          </div>)}
        </section>
      </aside>
    </div>
  );
}
