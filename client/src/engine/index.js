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
// ============================================================================
// 1. Re-exports from @kinesio/shared
// ============================================================================
export { SCHEMA_VERSION, CLINICIAN_UID, PATIENT_UID, TELEMETRY_RATE_HZ, VALGUS_THRESHOLD_PCT, VALGUS_COOLDOWN_MS, } from '@kinesio/shared';
// ============================================================================
// 2. Geometry Engine Exports (./geometry)
// ============================================================================
export { compute3DKneeFlexion, calibrateStandingBaseline, computeValgusDeviation, computeDepthRatio, BLAZEPOSE_KEYPOINTS, } from './geometry';
// ============================================================================
// 3. Kinematic Signal Smoothing Filters (./smoothing)
// ============================================================================
export { SlidingMedianFilter, ExponentialMovingAverageFilter, MedianFilter, EmaFilter, } from './smoothing';
// ============================================================================
// 4. Deterministic Rep Counter State Machine (./repCounter)
// ============================================================================
export { RepCounterStateMachine, RepCounter, } from './repCounter';
// ============================================================================
// 5. Biomechanical Summary Engine (./buildSummary)
// ============================================================================
export { buildSummary, } from './buildSummary';
