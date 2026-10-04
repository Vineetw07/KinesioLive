/**
 * Spike S4 (Milestone D2.4): Custom Message Persistence & History Retrieval Runner
 * Conforms to TRD § Section 2, Survey 2 & MCP Verified Specs
 */
import type { S4PersistenceMetrics } from '../types';
export interface CustomMessageBurstOptions {
    sessionId?: string;
    burstCount?: number;
    onProgress?: (sent: number, total: number) => void;
    onLog?: (level: 'info' | 'warn' | 'error' | 'success', msg: string) => void;
}
export interface RetrievedCustomMessageSummary {
    id: string | number;
    type: string;
    sentAt: number;
    sender: string;
    data: Record<string, unknown>;
}
export declare class PersistenceBenchmarkRunner {
    runPersistenceTest(options: CustomMessageBurstOptions): Promise<{
        metrics: S4PersistenceMetrics;
        messages: RetrievedCustomMessageSummary[];
    }>;
}
//# sourceMappingURL=persistenceRunner.d.ts.map