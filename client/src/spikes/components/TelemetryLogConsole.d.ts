import React from 'react';
import type { SpikeLogEntry } from '../types';
interface TelemetryLogConsoleProps {
    logs: SpikeLogEntry[];
    onClear?: () => void;
    maxEntries?: number;
}
export declare const TelemetryLogConsole: React.FC<TelemetryLogConsoleProps>;
export default TelemetryLogConsole;
//# sourceMappingURL=TelemetryLogConsole.d.ts.map