import React from 'react';
import type { SpikeStatus } from '../types';
interface BenchmarkMetricCardProps {
    title: string;
    value: string | number;
    unit?: string;
    threshold?: string;
    status?: SpikeStatus;
    subtext?: string;
}
export declare const BenchmarkMetricCard: React.FC<BenchmarkMetricCardProps>;
export default BenchmarkMetricCard;
//# sourceMappingURL=BenchmarkMetricCard.d.ts.map