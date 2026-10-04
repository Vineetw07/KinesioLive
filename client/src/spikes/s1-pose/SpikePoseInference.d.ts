import React from 'react';
import type { S1PoseMetrics, SpikeLogEntry } from '../types';
interface SpikePoseInferenceProps {
    onMetricsUpdate?: (metrics: S1PoseMetrics) => void;
    onLog?: (entry: Omit<SpikeLogEntry, 'id' | 'timestamp' | 'spikeId'>) => void;
    onComplete?: (metrics: S1PoseMetrics) => void;
    isAutoRun?: boolean;
}
export declare const SpikePoseInference: React.FC<SpikePoseInferenceProps>;
export default SpikePoseInference;
//# sourceMappingURL=SpikePoseInference.d.ts.map