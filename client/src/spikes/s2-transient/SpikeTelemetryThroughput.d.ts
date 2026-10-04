import React from 'react';
import type { S2TelemetryMetrics, SpikeLogEntry } from '../types';
interface SpikeTelemetryThroughputProps {
    onMetricsUpdate?: (metrics: S2TelemetryMetrics) => void;
    onLog?: (entry: Omit<SpikeLogEntry, 'id' | 'timestamp' | 'spikeId'>) => void;
    onComplete?: (metrics: S2TelemetryMetrics) => void;
    isAutoRun?: boolean;
}
export declare const SpikeTelemetryThroughput: React.FC<SpikeTelemetryThroughputProps>;
export default SpikeTelemetryThroughput;
//# sourceMappingURL=SpikeTelemetryThroughput.d.ts.map