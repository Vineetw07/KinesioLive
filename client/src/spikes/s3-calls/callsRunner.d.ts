/**
 * Spike S3 (Milestone D2.2): Headless CometChat Calls v5 Session Join Runner
 * Conforms to .cometchat/skills/cometchat-js-v5-sdk/SKILL.md & MCP Verified Specs
 */
import type { UserRole } from '@kinesio/shared';
import type { S3CallsMetrics } from '../types';
export interface CallsJoinOptions {
    role: UserRole;
    sessionId?: string;
    containerElement: HTMLElement;
    onLog?: (level: 'info' | 'warn' | 'error' | 'success', msg: string) => void;
}
export declare class CallsJoinRunner {
    private activeTeardown;
    private isConnected;
    joinCall(options: CallsJoinOptions): Promise<S3CallsMetrics>;
    leaveCall(): void;
    getIsConnected(): boolean;
}
//# sourceMappingURL=callsRunner.d.ts.map