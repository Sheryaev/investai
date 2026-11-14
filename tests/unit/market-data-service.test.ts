import { afterEach, describe, expect, it, vi } from "vitest";
import { MarketDataService, type PriceStream } from "../../src/main/portfolio/market-data-service";
import { money } from "../../src/main/portfolio/money";

const update = { instrumentId: "sber", price: money("300", "RUB"), asOf: "2026-11-14T12:00:00.000Z" };

afterEach(() => {
  vi.useRealTimers();
});

describe("MarketDataService", () => {
  it("does not create a duplicate subscription for the same positions", () => {
    let subscriptions = 0;
    const stream: PriceStream = {
      subscribe: () => { subscriptions += 1; return { close: vi.fn() }; },
    };
    const service = new MarketDataService(stream, async () => null);
    service.start(["sber"], () => undefined);
    service.start(["sber"], () => undefined);
    expect(subscriptions).toBe(1);
    service.close();
  });

  it("reconnects with a bounded backoff after a stream failure", async () => {
    vi.useFakeTimers();
    let subscriptions = 0;
    let fail: (() => void) | undefined;
    const stream: PriceStream = {
      subscribe: (_ids, _onPrice, onFailure) => {
        subscriptions += 1;
        fail = () => onFailure(new Error("offline"));
        return { close: vi.fn() };
      },
    };
    const service = new MarketDataService(stream, async () => null);
    service.start(["sber"], () => undefined);
    fail?.();
    await vi.advanceTimersByTimeAsync(999);
    expect(subscriptions).toBe(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(subscriptions).toBe(2);
    service.close();
  });

  it("closes the stream and pending reconnect", async () => {
    vi.useFakeTimers();
    const close = vi.fn();
    let fail: (() => void) | undefined;
    let subscriptions = 0;
    const service = new MarketDataService({
      subscribe: (_ids, _onPrice, onFailure) => {
        subscriptions += 1;
        fail = () => onFailure(new Error("offline"));
        return { close };
      },
    }, async () => null);
    service.start(["sber"], () => undefined);
    fail?.();
    service.close();
    await vi.advanceTimersByTimeAsync(30_000);
    expect(close).toHaveBeenCalled();
    expect(subscriptions).toBe(1);
  });

  it("polls only open positions when no stream is available", async () => {
    vi.useFakeTimers();
    const poll = vi.fn(async () => update);
    const onPrice = vi.fn();
    const service = new MarketDataService(null, poll);
    service.start(["sber"], onPrice);
    await vi.advanceTimersByTimeAsync(0);
    expect(poll).toHaveBeenCalledWith("sber");
    expect(onPrice).toHaveBeenCalledWith(update);
    await vi.advanceTimersByTimeAsync(30_000);
    expect(poll).toHaveBeenCalledTimes(2);
    service.close();
  });
});
