// @vitest-environment node

import { init, use } from "echarts/core";
import type { EChartsCoreOption } from "echarts/core";
import { LegacyGridContainLabel } from "echarts/features";
import { SVGRenderer } from "echarts/renderers";
import { describe, expect, it } from "vitest";
import { accounts, periods } from "./demo-data";
import type { Account, Period } from "./demo-data";
import type { ChartPalette } from "./components/ChartFrame";
import * as PortfolioChartModule from "./components/PortfolioChart";

use([LegacyGridContainLabel, SVGRenderer]);

const palette: ChartPalette = {
  accent: "#6860ed",
  muted: "#686d79",
  line: "#e8e9ee",
  surface: "#fcfcfd",
  text: "#202127",
};

const createOption = (PortfolioChartModule as unknown as {
  createPortfolioChartOption?: (account: Account, period: Period, palette: ChartPalette) => EChartsCoreOption;
}).createPortfolioChartOption;

const expectedTicks: Record<Period, number[]> = {
  "1Д": [1_266_000, 1_269_000, 1_272_000, 1_275_000, 1_278_000, 1_281_000, 1_284_000, 1_287_000],
  "1Н": [1_266_000, 1_269_000, 1_272_000, 1_275_000, 1_278_000, 1_281_000, 1_284_000, 1_287_000],
  "1М": [1_220_000, 1_230_000, 1_240_000, 1_250_000, 1_260_000, 1_270_000, 1_280_000, 1_290_000],
  "3М": [1_110_000, 1_140_000, 1_170_000, 1_200_000, 1_230_000, 1_260_000, 1_290_000],
  "1Г": [1_000_000, 1_050_000, 1_100_000, 1_150_000, 1_200_000, 1_250_000, 1_300_000],
  "Всё": [1_000_000, 1_050_000, 1_100_000, 1_150_000, 1_200_000, 1_250_000, 1_300_000],
};

describe("real ECharts SSR portfolio axis", () => {
  it.each(periods)("uses the corrected actual ticks for %s", (period) => {
    expect(createOption).toBeTypeOf("function");
    if (!createOption) return;

    const chart = init(null, undefined, { renderer: "svg", ssr: true, width: 1000, height: 400 });
    try {
      chart.setOption(createOption(accounts[0], period, palette));
      chart.renderToSVGString();
      const model = (chart as unknown as { getModel: () => { getComponent: (name: string) => unknown } }).getModel();
      const yAxis = model.getComponent("yAxis") as {
        axis: { scale: { getTicks: () => Array<{ value: number }> } };
      };
      const ticks = yAxis.axis.scale.getTicks().map((tick) => tick.value);

      expect(ticks).toEqual(expectedTicks[period]);
    } finally {
      chart.dispose();
    }
  });
});
