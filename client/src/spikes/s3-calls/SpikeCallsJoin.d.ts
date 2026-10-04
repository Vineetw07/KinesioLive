import React from 'react';
import type { S3CallsMetrics, SpikeLogEntry } from '../types';
interface SpikeCallsJoinProps {
    onMetricsUpdate?: (metrics: S3CallsMetrics) => void;
    onLog?: (entry: Omit<SpikeLogEntry, 'id' | 'timestamp' | 'spikeId'>) => void;
    onComplete?: (metrics: S3CallsMetrics) => void;
    isAutoRun?: boolean;
}
export declare const SpikeCallsJoin: React.FC<SpikeCallsJoinProps>;
export default SpikeCallsJoin;
//# sourceMappingURL=SpikeCallsJoin.d.ts.map