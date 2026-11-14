// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Chart } from "../../src/renderer/components/Chart";

const echarts = vi.hoisted(() => ({
  init: vi.fn(),
  setOption: vi.fn(),
  resize: vi.fn(),
  dispose: vi.fn(),
}));

vi.mock("echarts", () => ({ init: echarts.init }));

class ResizeObserverMock {
  observe = vi.fn();
  disconnect = vi.fn();
  constructor(public readonly callback: () => void) {}
}

beforeEach(() => {
  echarts.init.mockReturnValue({ setOption: echarts.setOption, resize: echarts.resize, dispose: echarts.dispose });
  vi.stubGlobal("ResizeObserver", ResizeObserverMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("Chart", () => {
  it("initializes once, updates options and disposes resources", () => {
    const option = { series: [] };
    const { rerender, unmount, container } = render(<Chart option={option} ariaLabel="График" />);
    const element = container.firstElementChild;
    expect(echarts.init).toHaveBeenCalledTimes(1);
    expect(echarts.setOption).toHaveBeenCalledWith(option, true);
    rerender(<Chart option={{ series: [{ type: "line" }] }} ariaLabel="График" />);
    expect(echarts.init).toHaveBeenCalledTimes(1);
    expect(echarts.setOption).toHaveBeenCalledTimes(2);
    expect(element).toBeTruthy();
    unmount();
    expect(echarts.dispose).toHaveBeenCalledTimes(1);
  });
});
