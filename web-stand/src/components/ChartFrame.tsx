import { useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import { init, use } from "echarts/core";
import type { ECharts, EChartsCoreOption } from "echarts/core";
import { LineChart, PieChart } from "echarts/charts";
import { GridComponent, TooltipComponent } from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";

use([LineChart, PieChart, GridComponent, TooltipComponent, CanvasRenderer]);

interface ChartFrameProps {
  option: EChartsCoreOption;
  label: string;
  className?: string;
}

export interface ChartPalette {
  accent: string;
  muted: string;
  line: string;
  surface: string;
  text: string;
}

function subscribeToTheme(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => observer.disconnect();
}

function themeSnapshot() {
  return document.documentElement.dataset.theme ?? "light";
}

export function useChartPalette(): ChartPalette {
  const theme = useSyncExternalStore(subscribeToTheme, themeSnapshot, () => "light");

  return useMemo(() => {
    const styles = getComputedStyle(document.documentElement);
    const token = (name: string, fallback: string) => styles.getPropertyValue(name).trim() || fallback;
    return {
      accent: token("--accent", "#6860ed"),
      muted: token("--muted", "#888b95"),
      line: token("--line", "#e8e9ee"),
      surface: token("--surface", "#fcfcfd"),
      text: token("--text", "#202127"),
    };
  }, [theme]);
}

export function ChartFrame({ option, label, className = "" }: ChartFrameProps) {
  const ref = useRef<HTMLDivElement>(null);
  const chartRef = useRef<ECharts | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    const chart = init(ref.current);
    chartRef.current = chart;
    const observer = new ResizeObserver(() => chart.resize());
    observer.observe(ref.current);
    return () => {
      observer.disconnect();
      chart.dispose();
      chartRef.current = null;
    };
  }, []);

  useEffect(() => {
    chartRef.current?.setOption(option);
  }, [option]);

  return <div ref={ref} className={`chart ${className}`} role="img" aria-label={label} />;
}
