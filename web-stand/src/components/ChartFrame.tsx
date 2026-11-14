import { useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import * as echarts from "echarts";
import type { EChartsOption } from "echarts";

interface ChartFrameProps {
  option: EChartsOption;
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
  const chartRef = useRef<ReturnType<typeof echarts.init> | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    const chart = echarts.init(ref.current);
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
