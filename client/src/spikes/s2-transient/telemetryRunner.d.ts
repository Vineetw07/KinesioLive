/**
 * Spike S2 (Milestone D2.3): 10 Hz Transient Message Telemetry Runner
 * Conforms to TRD § Section 2 and MCP Verified Specifications
 */
import type { S2TelemetryMetrics } from '../types';
import { TelemetryTokenBucket } from './rateCap';
export { TelemetryTokenBucket };
export interface TelemetryRunOptions {
    sessionId: string;
    targetCount?: number;
    onProgress?: (sent: number, target: number, currentLatencyMs: number) => void;
    onLog?: (level: 'info' | 'warn' | 'error' | 'success', msg: string) => void;
}
export declare class TelemetryBenchmarkRunner {
    private listenerId;
    private receivedLatencies;
    private receivedPackets;
    private isRunning;
    private abortController;
    constructor();
    runBenchmark(options: TelemetryRunOptions): Promise<S2TelemetryMetrics>;
    stop(): void;
    private teardown;
}
//# sourceMappingURL=telemetryRunner.d.ts.map