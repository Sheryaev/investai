// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import Decimal from "decimal.js";
import { afterEach, describe, expect, it, vi } from "vitest";
import { InstrumentDrawer } from "../../src/renderer/components/InstrumentDrawer";
import { serializeCandles, serializeOperations } from "../../src/shared/market-codec";
import { money } from "../../src/main/portfolio/money";
import type { CandlesRequest } from "../../src/shared/contracts";
import { basePosition } from "./fixtures";

vi.mock("../../src/renderer/components/Chart", () => ({
  Chart: ({ ariaLabel }: { ariaLabel: string }) => <div role="img" aria-label={ariaLabel} />,
}));

const candle = {
  time: "2026-11-14T09:00:00.000Z", open: new Decimal("300"), high: new Decimal("305"),
  low: new Decimal("298"), close: new Decimal("303"), volume: new Decimal("1200"), isComplete: true,
};

afterEach(cleanup);

describe("InstrumentDrawer", () => {
  it("loads candles, volume and only operations related to the instrument", async () => {
    const getCandles = vi.fn(async (_request: CandlesRequest) => serializeCandles([candle]));
    const getOperations = vi.fn(async () => serializeOperations([
      { id: "buy", accountId: "raw-account-1", date: "2026-11-14T09:15:00.000Z", type: "buy", description: "Покупка SBER", payment: money("-3000", "RUB"), quantity: new Decimal(10), instrumentId: "sber", figi: "sber" },
      { id: "sell", accountId: "raw-account-1", date: "2026-11-13T09:15:00.000Z", type: "sell", description: "Продажа YNDX", payment: money("4000", "RUB"), quantity: new Decimal(1), instrumentId: "yndx", figi: "yndx" },
    ]));
    window.investAi = { getCandles, getOperations } as never;
    render(<InstrumentDrawer position={basePosition()} onClose={() => undefined} />);
    expect(await screen.findByRole("img", { name: "Свечной график SBER" })).toBeTruthy();
    expect(screen.getByText("Объём")).toBeTruthy();
    expect(screen.getByText("Покупка SBER")).toBeTruthy();
    expect(screen.queryByText("Продажа YNDX")).toBeNull();
    expect(getOperations).toHaveBeenCalledWith(expect.objectContaining({ accountId: "raw-account-1" }));
    fireEvent.click(screen.getByRole("button", { name: "1Г" }));
    await waitFor(() => expect(getCandles).toHaveBeenCalledTimes(2));
    expect(getCandles.mock.lastCall?.[0]).toMatchObject({ instrumentId: "sber", interval: "1w" });
  });
});
