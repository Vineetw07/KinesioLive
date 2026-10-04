/**
 * client/src/engine/index.ts
 *
 * Unified Barrel Export for KinesioLive Biomechanical Kinematics Engine.
 * Exports all public functions, classes, interfaces, and mathematical constants
 * across geometry, signal smoothing, and deterministic rep counter state machine,
 * and re-exports core shared telemetry and biomechanics contracts.
 *
 * Strictly adheres to:
 * - ORIGINAL_REQUEST.md § R1–R3
 * - docs/trd.md § Section-2 & Section-3
 * - PROJECT.md § Code Layout & Interface Contracts
 */
export { SCHEMA_VERSION, CLINICIAN_UID, PATIENT_UID, TELEMETRY_RATE_HZ, VALGUS_THRESHOLD_PCT, VALGUS_COOLDOWN_MS, type Side, type SquatPhase, type SquatDepthRating, type SquatTempo, type CoachingCueType, type SessionMarkerAction, type UserRole, type Envelope, type KinePosePayload, type KineRepPayload, type KineAlertPayload, type KineCuePayload, type KineSessionMarkerPayload, type KineMessage, type SessionRequest, type SessionResponse, } from '@kinesio/shared';
export { compute3DKneeFlexion, calibrateStandingBaseline, computeValgusDeviation, computeDepthRatio, BLAZEPOSE_KEYPOINTS, type Point3D, type Point2D, type StandingBaseline, } from './geometry';
export type { Point3D as Landmark3D, Point2D as Landmark2D } from './geometry';
export type PixelPoint2D = import('./geometry').Point2D;
export { SlidingMedianFilter, ExponentialMovingAverageFilter, MedianFilter, EmaFilter, } from './smoothing';
export { RepCounterStateMachine, RepCounter, type RepCounterInput, type RepCounterFrameInput, type RepCounterOutput, type RepCounterOptions, type RepCounterState, type RepCompletedEvent, type ValgusAlertEvent, } from './repCounter';
export { buildSummary, type SessionSummary, type TimelineEvent, } from './buildSummary';
//# sourceMappingURL=index.d.ts.map