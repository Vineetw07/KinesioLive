/**
 * useTelemetryStream.ts (Milestone D4.4)
 * Decoupled React Hook consuming CometChat 10 Hz transient pose telemetry.
 * Conforms to docs/frontend_architecture_spec.md §6 and ORIGINAL_REQUEST.md §R3.
 */
import type { KinePosePayload } from '@kinesio/shared';
export interface UseTelemetryStreamResult {
    currentPose: KinePosePayload | null;
    isConnected: boolean;
    error: Error | null;
}
export declare function useTelemetryStream(sessionId: string | null | undefined): UseTelemetryStreamResult;
//# sourceMappingURL=useTelemetryStream.d.ts.map