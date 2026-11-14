import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { accounts, historyForPeriod } from "./demo-data";
import { PortfolioOverview } from "./components/PortfolioOverview";
import { StandApp } from "./StandApp";

const echartsMock = vi.hoisted(() => ({
  init: vi.fn(),
  instances: [] as Array<{
    setOption: ReturnType<typeof vi.fn>;
    resize: ReturnType<typeof vi.fn>;
    dispose: ReturnType<typeof vi.fn>;
  }>,
}));

vi.mock("echarts/core", () => ({ init: echartsMock.init, use: vi.fn() }));

interface TestOption {
  series?: Array<{
    type?: string;
    data?: unknown;
    lineStyle?: { color?: string };
  }>;
  xAxis?: { data?: unknown[] };
  yAxis?: { splitLine?: { lineStyle?: { color?: string } } };
}

const themeTokens = {
  light: { accent: "#6860ed", muted: "#777b88", line: "#e8e9ee", surface: "#fcfcfd", text: "#202127" },
  dark: { accent: "#928aff", muted: "#9698a2", line: "#2c2d33", surface: "#1a1b1f", text: "#f0f0f2" },
};

function applyThemeTokens(theme: keyof typeof themeTokens) {
  for (const [name, value] of Object.entries(themeTokens[theme])) {
    document.documentElement.style.setProperty(`--${name}`, value);
  }
}

function lastOption(instanceIndex = 0): TestOption {
  const instance = echartsMock.instances[instanceIndex];
  expect(instance).toBeDefined();
  return instance.setOption.mock.calls.at(-1)?.[0] as TestOption;
}

beforeEach(() => {
  echartsMock.init.mockReset();
  echartsMock.instances.length = 0;
  echartsMock.init.mockImplementation(() => {
    const instance = { setOption: vi.fn(), resize: vi.fn(), dispose: vi.fn() };
    echartsMock.instances.push(instance);
    return instance;
  });
  localStorage.clear();
  document.documentElement.dataset.theme = "light";
  applyThemeTokens("light");
});

afterEach(() => {
  delete document.documentElement.dataset.theme;
  document.documentElement.removeAttribute("style");
});

it("shows portfolio values and changes the chart period", async () => {
  const user = userEvent.setup();
  const onPeriod = vi.fn();
  render(<PortfolioOverview account={accounts[0]} period="3М" onPeriod={onPeriod} />);

  expect(screen.getByText(/1.*284.*500.*₽/)).toBeInTheDocument();
  expect(screen.getByText("SBER")).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "1М" }));
  expect(onPeriod).toHaveBeenCalledWith("1М");
});

it("renders a negative daily change without a forced plus", () => {
  render(<PortfolioOverview account={accounts[1]} period="3М" onPeriod={vi.fn()} />);

  const change = screen.getByText(/1.*240.*₽ сегодня/);
  expect(change).toHaveClass("negative");
  expect(change.textContent).toContain("-");
  expect(change.textContent).not.toContain("+");
});

it("keeps allocation values in HTML and labels both charts", () => {
  render(<PortfolioOverview account={accounts[0]} period="3М" onPeriod={vi.fn()} />);

  expect(screen.getByRole("img", { name: "Динамика стоимости портфеля за 3М" })).toBeInTheDocument();
  expect(screen.getByRole("img", { name: "Распределение активов портфеля" })).toBeInTheDocument();
  expect(screen.getByText("76.4%")).toBeInTheDocument();
  expect(screen.getByText("14.8%")).toBeInTheDocument();
});

it("uses history for the selected period in the portfolio chart", () => {
  render(<PortfolioOverview account={accounts[0]} period="1М" onPeriod={vi.fn()} />);

  expect(lastOption().series?.[0]).toMatchObject({
    type: "line",
    data: historyForPeriod(accounts[0].history, "1М").map((point) => point.value),
  });
});

it("recolors both charts when only the root theme changes", async () => {
  render(<PortfolioOverview account={accounts[0]} period="3М" onPeriod={vi.fn()} />);
  expect(lastOption().series?.[0].lineStyle?.color).toBe("#6860ed");

  act(() => {
    document.documentElement.dataset.theme = "dark";
    applyThemeTokens("dark");
  });

  await waitFor(() => {
    expect(lastOption().series?.[0].lineStyle?.color).toBe("#928aff");
  });
  expect(lastOption().yAxis?.splitLine?.lineStyle?.color).toBe("#2c2d33");
  expect(echartsMock.instances[1].setOption).toHaveBeenCalledTimes(2);
});

it("applies a restored dark theme to the charts on initial load", async () => {
  localStorage.setItem("invest-theme", "dark");
  delete document.documentElement.dataset.theme;
  applyThemeTokens("dark");

  render(<StandApp />);

  await waitFor(() => expect(document.documentElement).toHaveAttribute("data-theme", "dark"));
  await waitFor(() => expect(lastOption().series?.[0].lineStyle?.color).toBe("#928aff"));
  expect(echartsMock.instances[0].setOption.mock.calls.length).toBeGreaterThan(1);
});

it("disposes every chart when the overview unmounts", () => {
  const { unmount } = render(<PortfolioOverview account={accounts[0]} period="3М" onPeriod={vi.fn()} />);

  unmount();

  expect(echartsMock.instances).toHaveLength(2);
  for (const instance of echartsMock.instances) expect(instance.dispose).toHaveBeenCalledTimes(1);
});

it("loads only the required modular ECharts runtime", async () => {
  const { readFileSync } = await import("node:fs");
  const chartFiles = [
    "src/components/ChartFrame.tsx",
    "src/components/PortfolioChart.tsx",
    "src/components/AllocationChart.tsx",
  ];

  for (const file of chartFiles) {
    expect(readFileSync(file, "utf8"), file).not.toMatch(/from\s+["']echarts["']/);
  }

  const frame = readFileSync("src/components/ChartFrame.tsx", "utf8");
  expect(frame).toContain('from "echarts/core";');
  expect(frame).toContain("use([LineChart, PieChart, GridComponent, TooltipComponent, CanvasRenderer]);");
});

it("keeps chart axis labels at the 13px readability minimum", () => {
  render(<PortfolioOverview account={accounts[0]} period="3М" onPeriod={vi.fn()} />);
  const option = lastOption() as unknown as {
    xAxis?: { axisLabel?: { fontSize?: number } };
    yAxis?: { axisLabel?: { fontSize?: number } };
  };

  expect(option.xAxis?.axisLabel?.fontSize).toBeGreaterThanOrEqual(13);
  expect(option.yAxis?.axisLabel?.fontSize).toBeGreaterThanOrEqual(13);
});
