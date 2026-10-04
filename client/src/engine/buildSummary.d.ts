/**
 * client/src/engine/buildSummary.ts
 *
 * Deterministic Biomechanical Summary Engine for KinesioLive.
 * Ingests raw CometChat.BaseMessage[] history from MessagesRequestBuilder.fetchPrevious(),
 * filters and validates persisted custom messages at the boundary, and compiles comprehensive
 * session analytics with zero ?. at calculation sites.
 *
 * Strictly adheres to:
 * - ORIGINAL_REQUEST.md § R3 (lines 410–470)
 * - docs/trd.md § Section-2
 * - Antigravity Master Engineering Protocol § Critic Rubric C1
 */
import type { CoachingCueType } from '@kinesio/shared';
export interface TimelineEvent {
    id: string;
    timestamp: number;
    type: 'rep' | 'alert' | 'cue' | 'session';
    title: string;
    detail: string;
    severity?: 'normal' | 'warning' | 'critical';
}
export interface SessionSummary {
    sessionId: string;
    durationMs: number;
    totalReps: number;
    validReps: number;
    depthDistribution: {
        shallow: number;
        good: number;
        deep: number;
    };
    tempoDistribution: {
        fast: number;
        controlled: number;
        slow: number;
    };
    averageMinKneeDeg: number;
    peakDepthDeg: number;
    alertCount: number;
    alertBreakdown: {
        L: number;
        R: number;
    };
    maxValgusDevPct: number;
    cuesCount: number;
    cuesDelivered: Array<{
        cue: CoachingCueType;
        text: string;
        timestamp: number;
    }>;
    timeline: Array<TimelineEvent>;
}
export declare function buildSummary(sessionId: string, messages: CometChat.BaseMessage[]): SessionSummary;
//# sourceMappingURL=buildSummary.d.ts.map