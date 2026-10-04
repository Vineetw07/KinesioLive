import React from 'react';
import type { SpikeMetrics, SpikeStatus } from '../types';
interface KillSwitchGateTableProps {
    metrics: SpikeMetrics;
    statuses: {
        s1: SpikeStatus;
        s2: SpikeStatus;
        s3: SpikeStatus;
        s4: SpikeStatus;
    };
    onRunAll?: () => void;
    isRunningAll?: boolean;
}
export declare const KillSwitchGateTable: React.FC<KillSwitchGateTableProps>;
export default KillSwitchGateTable;
//# sourceMappingURL=KillSwitchGateTable.d.ts.map