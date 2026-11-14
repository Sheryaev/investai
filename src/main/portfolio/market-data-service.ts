import type { Money } from "./money";

export interface PriceUpdate {
  instrumentId: string;
  price: Money;
  asOf: string;
}

export interface PriceStream {
  subscribe(
    instrumentIds: string[],
    onPrice: (update: PriceUpdate) => void,
    onFailure: (error: unknown) => void,
  ): { close(): void };
}

export class MarketDataService {
  private instrumentIds: string[] = [];
  private onPrice: ((update: PriceUpdate) => void) | null = null;
  private subscription: { close(): void } | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private generation = 0;
  private reconnectAttempt = 0;
  private polling = false;

  constructor(
    private readonly stream: PriceStream | null,
    private readonly poll: (instrumentId: string) => Promise<PriceUpdate | null>,
  ) {}

  start(instrumentIds: string[], onPrice: (update: PriceUpdate) => void): void {
    const normalized = [...new Set(instrumentIds)].sort();
    if (this.onPrice && normalized.join("\0") === this.instrumentIds.join("\0")) return;
    this.close();
    this.instrumentIds = normalized;
    this.onPrice = onPrice;
    this.generation += 1;
    this.reconnectAttempt = 0;
    if (normalized.length === 0) return;
    if (this.stream) this.connect(this.generation);
    else void this.pollOnce(this.generation);
  }

  close(): void {
    this.generation += 1;
    this.subscription?.close();
    this.subscription = null;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.onPrice = null;
    this.instrumentIds = [];
    this.polling = false;
  }

  private connect(generation: number): void {
    if (!this.stream || generation !== this.generation) return;
    try {
      this.subscription = this.stream.subscribe(
        this.instrumentIds,
        (update) => {
          if (generation !== this.generation) return;
          this.reconnectAttempt = 0;
          this.onPrice?.(update);
        },
        () => {
          if (generation !== this.generation) return;
          this.subscription?.close();
          this.subscription = null;
          const delays = [1000, 2000, 4000, 8000];
          const delay = delays[Math.min(this.reconnectAttempt, delays.length - 1)] ?? 30_000;
          this.reconnectAttempt += 1;
          this.schedule(() => this.connect(generation), delay, generation);
        },
      );
    } catch {
      this.schedule(() => this.connect(generation), 30_000, generation);
    }
  }

  private async pollOnce(generation: number): Promise<void> {
    if (this.polling || generation !== this.generation) return;
    this.polling = true;
    try {
      for (const instrumentId of this.instrumentIds) {
        if (generation !== this.generation) return;
        try {
          const update = await this.poll(instrumentId);
          if (update && generation === this.generation) this.onPrice?.(update);
        } catch {
          // Keep the last priced snapshot and try again on the next bounded poll.
        }
      }
    } finally {
      if (generation === this.generation) {
        this.polling = false;
        this.schedule(() => void this.pollOnce(generation), 30_000, generation);
      }
    }
  }

  private schedule(callback: () => void, delay: number, generation: number): void {
    if (this.timer || generation !== this.generation) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      if (generation === this.generation) callback();
    }, delay);
  }
}
