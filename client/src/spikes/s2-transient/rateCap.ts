/**
 * 10 Hz Token Bucket Rate Limiter
 * Regulates high-frequency biomechanical telemetry dispatch
 */

export class TelemetryTokenBucket {
  private capacity = 1;
  private tokens = 1;
  private lastRefill = performance.now();
  private refillIntervalMs = 100; // 10 Hz = 100ms per token

  public tryConsume(): boolean {
    const now = performance.now();
    const elapsed = now - this.lastRefill;
    if (elapsed >= this.refillIntervalMs) {
      const addedTokens = Math.floor(elapsed / this.refillIntervalMs);
      this.tokens = Math.min(this.capacity, this.tokens + addedTokens);
      this.lastRefill = now;
    }

    if (this.tokens >= 1) {
      this.tokens -= 1;
      return true;
    }
    return false;
  }

  public reset(): void {
    this.tokens = 1;
    this.lastRefill = performance.now();
  }
}
