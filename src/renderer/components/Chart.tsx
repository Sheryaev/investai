import { useEffect, useRef } from "react";
import * as echarts from "echarts";
import type { EChartsOption } from "echarts";

interface ChartProps {
  option: EChartsOption;
  ariaLabel: string;
  className?: string;
}

export function Chart({ option, ariaLabel, className = "" }: ChartProps) {
  const element = useRef<HTMLDivElement>(null);
  const instance = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!element.current) return;
    const chart = echarts.init(element.current);
    instance.current = chart;
    const observer = new ResizeObserver(() => chart.resize());
    observer.observe(element.current);
    return () => {
      observer.disconnect();
      chart.dispose();
      instance.current = null;
    };
  }, []);

  useEffect(() => {
    instance.current?.setOption(option, true);
  }, [option]);

  return <div ref={element} className={`chart ${className}`} role="img" aria-label={ariaLabel} />;
}
