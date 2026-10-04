/**
 * 10 Hz Token Bucket Rate Limiter
 * Regulates high-frequency biomechanical telemetry dispatch
 */
export declare class TelemetryTokenBucket {
    private capacity;
    private tokens;
    private lastRefill;
    private refillIntervalMs;
    tryConsume(): boolean;
    reset(): void;
}
//# sourceMappingURL=rateCap.d.ts.map