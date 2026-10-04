import React from 'react';
import type { S4PersistenceMetrics, SpikeLogEntry } from '../types';
interface SpikePersistenceFetchProps {
    onMetricsUpdate?: (metrics: S4PersistenceMetrics) => void;
    onLog?: (entry: Omit<SpikeLogEntry, 'id' | 'timestamp' | 'spikeId'>) => void;
    onComplete?: (metrics: S4PersistenceMetrics) => void;
    isAutoRun?: boolean;
}
export declare const SpikePersistenceFetch: React.FC<SpikePersistenceFetchProps>;
export default SpikePersistenceFetch;
//# sourceMappingURL=SpikePersistenceFetch.d.ts.map