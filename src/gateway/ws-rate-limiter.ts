// In-memory sliding-window limiter, keyed per user. Fine for a single
// gateway instance; a horizontally scaled deployment would need this
// backed by Redis (same pattern as the OTP limiter) instead.
export class WsRateLimiter {
  private readonly hits = new Map<string, number[]>();

  constructor(
    private readonly maxEvents: number,
    private readonly windowMs: number,
  ) {}

  tryConsume(key: string): boolean {
    const now = Date.now();
    const recent = (this.hits.get(key) ?? []).filter(
      (timestamp) => now - timestamp < this.windowMs,
    );

    if (recent.length >= this.maxEvents) {
      this.hits.set(key, recent);
      return false;
    }

    recent.push(now);
    this.hits.set(key, recent);
    return true;
  }

  reset(key: string): void {
    this.hits.delete(key);
  }
}
