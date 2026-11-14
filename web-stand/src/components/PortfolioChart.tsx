import { useMemo } from "react";
import type { EChartsCoreOption } from "echarts/core";
import type { Account, Period } from "../demo-data";
import { historyForPeriod } from "../demo-data";
import { ChartFrame, useChartPalette } from "./ChartFrame";

interface PortfolioChartProps {
  account: Account;
  period: Period;
}

const compactAxisValue = new Intl.NumberFormat("ru-RU", {
  notation: "compact",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function PortfolioChart({ account, period }: PortfolioChartProps) {
  const palette = useChartPalette();
  const option = useMemo<EChartsCoreOption>(() => {
    const history = historyForPeriod(account.history, period);
    return {
      animationDuration: 300,
      grid: { left: 12, right: 12, top: 20, bottom: 8, containLabel: true },
      tooltip: {
        trigger: "axis",
        backgroundColor: palette.surface,
        borderColor: palette.line,
        textStyle: { color: palette.text },
      },
      xAxis: {
        type: "category",
        boundaryGap: false,
        data: history.map((point) => new Intl.DateTimeFormat("ru-RU", {
          day: "2-digit",
          month: "short",
        }).format(new Date(point.date))),
        axisLine: { lineStyle: { color: palette.line } },
        axisTick: { show: false },
        axisLabel: { color: palette.muted, hideOverlap: true, fontSize: 13 },
      },
      yAxis: {
        type: "value",
        scale: true,
        axisLabel: {
          color: palette.muted,
          fontSize: 13,
          formatter: (value: number) => compactAxisValue.format(value),
        },
        splitLine: { lineStyle: { color: palette.line } },
      },
      series: [{
        name: "Стоимость",
        type: "line",
        smooth: 0.35,
        showSymbol: false,
        data: history.map((point) => point.value),
        lineStyle: { color: palette.accent, width: 3 },
        itemStyle: { color: palette.accent },
        areaStyle: { color: palette.accent, opacity: 0.12 },
      }],
    };
  }, [account.history, palette, period]);

  return (
    <ChartFrame
      option={option}
      label={`Динамика стоимости портфеля за ${period}`}
      className="portfolio-chart"
    />
  );
}
