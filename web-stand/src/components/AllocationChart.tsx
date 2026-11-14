import { useMemo } from "react";
import type { EChartsCoreOption } from "echarts/core";
import type { AllocationItem } from "../demo-data";
import { ChartFrame, useChartPalette } from "./ChartFrame";

export function AllocationChart({ items }: { items: AllocationItem[] }) {
  const palette = useChartPalette();
  const option = useMemo<EChartsCoreOption>(() => ({
    tooltip: {
      trigger: "item",
      backgroundColor: palette.surface,
      borderColor: palette.line,
      textStyle: { color: palette.text },
      formatter: "{b}: {c}%",
    },
    series: [{
      type: "pie",
      radius: ["66%", "86%"],
      center: ["50%", "50%"],
      label: { show: false },
      emphasis: { scaleSize: 4 },
      data: items.map(({ label, value, color }) => ({
        name: label,
        value,
        itemStyle: { color },
      })),
    }],
  }), [items, palette]);

  return (
    <ChartFrame
      option={option}
      label="Распределение активов портфеля"
      className="allocation-chart"
    />
  );
}
