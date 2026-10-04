/**
 * Clinician.tsx (Milestone D4.4)
 * Tele-Rehab Mission-Control Clinician Studio.
 * - Mounts CometChat Calls v5 WebRTC session with MANDATORY startAudioMuted: true.
 * - Ingests 10 Hz kine.pose transient messages via useTelemetryStream.
 * - Applies Framer Motion useSpring dampers for 60 fps smooth telemetry visualization.
 * - Live HUD: Bilateral knee angles, pelvic depth gauge, FPS, squat phase, valgus alerts.
 * - Tactile Coaching Cue Pad (4 cue buttons: Knees Out, Slow Down, Chest Up, Good Depth).
 * - Session Controls: Copy Patient Invite Link and End Session marker.
 * - 100% semantic CSS tokens - ZERO raw hex codes.
 */
import React from 'react';
export interface ClinicianViewProps {
    sessionId?: string;
    onEndSession?: () => void;
}
export declare const Clinician: React.FC<ClinicianViewProps>;
export default Clinician;
//# sourceMappingURL=Clinician.d.ts.map