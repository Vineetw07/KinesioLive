/**
 * Patient.tsx (Milestone D4.3)
 * Tele-Rehab Zero-Contention Studio for Patient.
 * - Authenticates via POST /api/session (role: "patient").
 * - Mounts CometChat Calls v5 session (startAudioMuted: false).
 * - Zero-Contention Camera Ingestion: Taps active DOM <video> element rendered by Calls SDK
 *   via requestVideoFrameCallback (with rAF fallback). NEVER initiates secondary getUserMedia.
 * - Pose Inference & Kinematics:
 *   - PoseLandmarker in VIDEO mode.
 *   - Calibrates standing baseline (calibrateStandingBaseline).
 *   - 3D knee flexion angle (compute3DKneeFlexion).
 *   - Frontal valgus deviation (computeValgusDeviation).
 *   - Pelvic depth ratio (computeDepthRatio).
 *   - Feed into RepCounterStateMachine.
 * - Dynamic 2D Skeleton Canvas Overlay:
 *   - Aligned 1:1 over video pixels.
 *   - Highlights femur/tibia and neutral axes.
 *   - Valgus deviation vector: emerald green (var(--status-stable)) for <= 8.0%,
 *     bright red (var(--status-critical)) for > 8.0%.
 * - Optimistic Local HUD:
 *   - Joint angles, depth gauge, phase indicator, rep count badge with spring pop.
 * - Real-Time Transmission:
 *   - 10 Hz rate-capped transient messaging using TelemetryTokenBucket (kine.pose).
 *   - On rep completion, dispatch persisted kine.rep (shouldUpdateConversation: false).
 *   - On valgus alert, dispatch persisted kine.alert (shouldUpdateConversation: false).
 * - Coaching Feedback:
 *   - Listens for kine.cue custom messages and renders prominent animated toast notifications.
 * - Strict React 19 cleanup:
 *   - Cancel rVFC loops, remove message listeners, leave call, close pose landmarker.
 * - ZERO console.log in 10 Hz / frame loops. ZERO raw hex codes.
 */
import React from 'react';
export interface PatientViewProps {
    sessionId?: string;
    onLeaveSession?: () => void;
}
export interface OutboxItem {
    message: CometChat.CustomMessage;
    retries: number;
}
export declare const Patient: React.FC<PatientViewProps>;
export default Patient;
//# sourceMappingURL=Patient.d.ts.map