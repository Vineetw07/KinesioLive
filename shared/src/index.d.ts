/**
 * @kinesio/shared - Biomechanical, Telemetry, and Session Contracts
 * Conforms strictly to PROJECT.md § Interface Contracts, docs/trd.md § Section-2, and ORIGINAL_REQUEST.md
 */
export declare const SCHEMA_VERSION: 1;
export type Side = "L" | "R";
export type SquatPhase = "standing" | "descending" | "bottom" | "ascending" | "lost";
export type SquatDepthRating = "shallow" | "good" | "deep";
export type SquatTempo = "fast" | "controlled" | "slow";
export type CoachingCueType = "knees_out" | "slower" | "chest_up" | "good_depth";
export type SessionMarkerAction = "start" | "end" | "summary";
export type UserRole = "clinician" | "patient";
/**
 * Base envelope included in all telemetry and event packets.
 */
export interface Envelope {
    v: typeof SCHEMA_VERSION;
    sid: string;
    t: number;
}
/**
 * CHANNEL: TRANSIENT (CometChat.sendTransientMessage to RECEIVER_TYPE.GROUP)
 * High-frequency pose telemetry throttled to 10 Hz via token bucket.
 */
export interface KinePosePayload extends Envelope {
    type: "kine.pose";
    seq: number;
    fps: number;
    phase: SquatPhase;
    kneeFlexionDeg: {
        L: number | null;
        R: number | null;
    };
    kneeDeg?: {
        L: number | null;
        R: number | null;
    };
    valgusDevPct: {
        L: number | null;
        R: number | null;
    };
    depthRatio: number;
    vis: number;
    reps: number;
}
export type RepFormRating = "excellent" | "good" | "needs_work";
/**
 * CHANNEL: CUSTOM PERSISTED (CometChat.sendCustomMessage to RECEIVER_TYPE.GROUP)
 * Emitted when a validated squat repetition completes.
 */
export interface KineRepPayload extends Envelope {
    type: "kine.rep";
    n: number;
    minKneeDeg: number;
    depth: SquatDepthRating;
    durMs: number;
    tempo: SquatTempo;
    formScore?: number;
    formRating?: RepFormRating;
}
/**
 * CHANNEL: CUSTOM PERSISTED (CometChat.sendCustomMessage to RECEIVER_TYPE.GROUP)
 * Emitted when knee valgus deviation exceeds threshold (+8.0%) for >= 3 frames.
 */
export interface KineAlertPayload extends Envelope {
    type: "kine.alert";
    kind: "knee_valgus";
    side: Side;
    value: number;
    thresholdPct: number;
    repN: number;
    phase: SquatPhase;
    note: "Form alert (biomechanical feedback)";
}
/**
 * CHANNEL: CUSTOM PERSISTED (CometChat.sendCustomMessage to RECEIVER_TYPE.GROUP)
 * Real-time coaching cue triggered by clinician.
 */
export interface KineCuePayload extends Envelope {
    type: "kine.cue";
    cue: CoachingCueType;
    text: string;
}
/**
 * CHANNEL: CUSTOM PERSISTED (CometChat.sendCustomMessage to RECEIVER_TYPE.GROUP)
 * Session lifecycle boundary markers.
 */
export interface KineSessionMarkerPayload extends Envelope {
    type: "kine.session";
    action: SessionMarkerAction;
    clinicianUid: string;
    patientUid: string;
}
/**
 * Discriminated union of all KinesioLive message payloads.
 */
export type KineMessage = KinePosePayload | KineRepPayload | KineAlertPayload | KineCuePayload | KineSessionMarkerPayload;
/**
 * Payload sent to Express backend POST /api/session.
 */
export interface SessionRequest {
    role: UserRole;
    sessionId?: string;
}
/**
 * Sanitized response received from Express backend POST /api/session.
 */
export interface SessionResponse {
    sessionId: string;
    authToken: string;
    uid: string;
    appId: string;
    region: string;
}
/**
 * Deterministic Demo User, Telemetry, and Threshold Constants
 */
export declare const CLINICIAN_UID: "dr-demo";
export declare const PATIENT_UID: "pt-demo";
export declare const TELEMETRY_RATE_HZ: 10;
export declare const VALGUS_THRESHOLD_PCT: 8;
export declare const VALGUS_COOLDOWN_MS: 4000;
//# sourceMappingURL=index.d.ts.map