/**
 * client/src/views/Summary.tsx (Milestone D5.4)
 * Post-Workout Biomechanical Summary Bento View.
 * - Queries CometChat.MessagesRequestBuilder for persisted custom session messages.
 * - Aggregates data deterministically via buildSummary engine.
 * - 4 Stat Cards in a row (Total Reps, Peak Depth, Form Alerts, Coaching Cues).
 * - Anchor Dark Card with hatched diagonal texture, luminous critical pills, depth & tempo distribution.
 * - Scrollable Event Timeline with semantic status pills (stable, critical, cyan, lavender).
 * - Fluid Framer Motion transitions (springPresets.layout & springPresets.snappy).
 * - 100% semantic CSS design tokens - ZERO raw hex codes in style definitions.
 */
import React from 'react';
export interface SummaryProps {
    sessionId: string;
    guid: string;
    onBack?: () => void;
}
export declare const Summary: React.FC<SummaryProps>;
export default Summary;
//# sourceMappingURL=Summary.d.ts.map