/**
 * client/src/engine/geometry.ts
 *
 * Decoupled, zero-DOM Mathematical Geometry Engine for KinesioLive.
 * Computes 3D sagittal knee flexion angle, standing baseline calibration,
 * frontal knee valgus deviation percentage, and normalized pelvic depth ratio.
 *
 * Strictly adheres to:
 * - ORIGINAL_REQUEST.md § R1
 * - docs/trd.md § Section-3
 * - docs/testing.md § Section-2
 * - PROJECT.md § Architecture & Interface Contracts
 */

import type { Side } from '@kinesio/shared';

export type { Side };

/**
 * 3D Landmark representation in metric Euclidean space (meters).
 * Typically sourced from MediaPipe BlazePose worldLandmarks.
 */
export interface Point3D {
  x: number;
  y: number;
  z: number;
  visibility?: number;
}

/**
 * 2D Landmark representation in image or normalized space.
 * Accepts optional z coordinate and visibility for compatibility with MediaPipe landmarks.
 */
export interface Point2D {
  x: number;
  y: number;
  z?: number;
  visibility?: number;
}

/**
 * Calibrated neutral standing biomechanical baseline.
 * Contains both structured hierarchical groupings and flat convenience accessors.
 */
export interface StandingBaseline {
  /** Bilateral standing leg lengths in unmirrored camera pixels */
  L_standing: {
    L: number;
    R: number;
  };
  /** Bilateral and midpoint standing vertical heights in camera pixels */
  standingY: {
    hip: { L: number; R: number; midpoint: number };
    knee: { L: number; R: number; midpoint: number };
    ankle: { L: number; R: number; midpoint: number };
  };
  /** Timestamp when calibration occurred (milliseconds epoch) */
  calibratedAt: number;
  /** Frame width in pixels */
  imageWidth: number;
  /** Frame height in pixels */
  imageHeight: number;

  // Flat aliases for direct convenience access across test suites & consumers
  standingLegLengthL: number;
  standingLegLengthR: number;
  standingHipY_L: number;
  standingHipY_R: number;
  standingKneeY_L: number;
  standingKneeY_R: number;
  standingAnkleY_L: number;
  standingAnkleY_R: number;
  standingHipY: number;    // Bilateral midpoint
  standingKneeY: number;   // Bilateral midpoint
  standingAnkleY: number;  // Bilateral midpoint
  verticalSpan: number;    // standingKneeY - standingHipY
}

/**
 * BlazePose 33-landmark bilateral keypoint indices.
 */
export const BLAZEPOSE_KEYPOINTS = {
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
  LEFT_KNEE: 25,
  RIGHT_KNEE: 26,
  LEFT_ANKLE: 27,
  RIGHT_ANKLE: 28,
} as const;

/**
 * Computes 3D sagittal knee flexion angle in degrees from metric worldLandmarks.
 *
 * Vectors:
 *   v1 = hip - knee
 *   v2 = ankle - knee
 *
 * Formula:
 *   theta = arccos(clamp((v1 . v2) / (||v1|| * ||v2||), -1.0, 1.0)) * (180 / pi)
 *
 * Returns null (never NaN, Infinity, or placeholder like 180) if:
 *   - Any landmark is null/undefined
 *   - Any coordinate is non-finite (isNaN or !Number.isFinite)
 *   - Landmark visibility is present and < 0.65
 *   - Either vector magnitude is degenerate (||v|| <= 1e-6)
 */
export function compute3DKneeFlexion(
  hip: Point3D,
  knee: Point3D,
  ankle: Point3D
): number | null;
export function compute3DKneeFlexion(
  hip: Point3D | null | undefined,
  knee: Point3D | null | undefined,
  ankle: Point3D | null | undefined
): number | null;
export function compute3DKneeFlexion(
  hip: Point3D | null | undefined,
  knee: Point3D | null | undefined,
  ankle: Point3D | null | undefined
): number | null {
  if (!hip || !knee || !ankle) return null;
  if (typeof hip !== 'object' || typeof knee !== 'object' || typeof ankle !== 'object') return null;

  // Visibility threshold guard (< 0.65)
  if (hip.visibility !== undefined && (typeof hip.visibility !== 'number' || !Number.isFinite(hip.visibility) || hip.visibility < 0.65)) return null;
  if (knee.visibility !== undefined && (typeof knee.visibility !== 'number' || !Number.isFinite(knee.visibility) || knee.visibility < 0.65)) return null;
  if (ankle.visibility !== undefined && (typeof ankle.visibility !== 'number' || !Number.isFinite(ankle.visibility) || ankle.visibility < 0.65)) return null;

  // Finite coordinate validation
  if (
    typeof hip.x !== 'number' || !Number.isFinite(hip.x) ||
    typeof hip.y !== 'number' || !Number.isFinite(hip.y) ||
    typeof hip.z !== 'number' || !Number.isFinite(hip.z) ||
    typeof knee.x !== 'number' || !Number.isFinite(knee.x) ||
    typeof knee.y !== 'number' || !Number.isFinite(knee.y) ||
    typeof knee.z !== 'number' || !Number.isFinite(knee.z) ||
    typeof ankle.x !== 'number' || !Number.isFinite(ankle.x) ||
    typeof ankle.y !== 'number' || !Number.isFinite(ankle.y) ||
    typeof ankle.z !== 'number' || !Number.isFinite(ankle.z)
  ) {
    return null;
  }

  // Vectors from knee vertex
  const v1x = hip.x - knee.x;
  const v1y = hip.y - knee.y;
  const v1z = hip.z - knee.z;

  const v2x = ankle.x - knee.x;
  const v2y = ankle.y - knee.y;
  const v2z = ankle.z - knee.z;

  // Degenerate vector length check (magnitude <= 1e-6)
  const mag1Sq = v1x * v1x + v1y * v1y + v1z * v1z;
  const mag2Sq = v2x * v2x + v2y * v2y + v2z * v2z;

  if (!Number.isFinite(mag1Sq) || !Number.isFinite(mag2Sq)) return null;
  if (mag1Sq <= 1e-12 || mag2Sq <= 1e-12) return null; // sqrt(1e-12) = 1e-6

  const mag1 = Math.sqrt(mag1Sq);
  const mag2 = Math.sqrt(mag2Sq);

  if (mag1 <= 1e-6 || mag2 <= 1e-6) return null;

  const denominator = mag1 * mag2;
  if (denominator <= 1e-12 || !Number.isFinite(denominator)) return null;

  // Dot product and clamping to avoid IEEE 754 precision overshoot beyond [-1, 1]
  const dot = v1x * v2x + v1y * v2y + v1z * v2z;
  const cosTheta = dot / denominator;
  const clampedCos = Math.max(-1.0, Math.min(1.0, cosTheta));

  if (!Number.isFinite(clampedCos)) return null;

  const angleRad = Math.acos(clampedCos);
  const angleDeg = (angleRad * 180.0) / Math.PI;

  return Number.isFinite(angleDeg) ? angleDeg : null;
}

/**
 * Calibrates the user's neutral upright standing baseline from 2D landmarks.
 *
 * Requirements:
 * - Validates all 6 bilateral keypoints (Left: 23, 25, 27; Right: 24, 26, 28) exist and have visibility >= 0.65.
 * - Converts to unmirrored camera pixel coordinates: X = x * imageWidth, Y = y * imageHeight.
 * - Anatomical Orientation Invariant: Validates Y_ankle > Y_knee > Y_hip for both Left (27 > 25 > 23) and Right (28 > 26 > 24). If invalid, returns null.
 * - Records bilateral standing leg lengths:
 *     L_standing^L = sqrt((X_27 - X_23)^2 + (Y_27 - Y_23)^2)
 *     L_standing^R = sqrt((X_28 - X_24)^2 + (Y_28 - Y_24)^2)
 * - Records standing hip and knee heights (bilateral and midpoint).
 */
export function calibrateStandingBaseline(
  landmarks: Point2D[],
  imageWidth: number,
  imageHeight: number,
  timestamp?: number
): StandingBaseline | null;
export function calibrateStandingBaseline(
  landmarks: Array<Point2D | null | undefined>,
  imageWidth: number,
  imageHeight: number,
  timestamp?: number
): StandingBaseline | null;
export function calibrateStandingBaseline(
  landmarks: Array<Point2D | null | undefined> | null | undefined,
  imageWidth: number,
  imageHeight: number,
  timestamp?: number
): StandingBaseline | null {
  if (!landmarks || !Array.isArray(landmarks)) return null;
  if (!Number.isFinite(imageWidth) || imageWidth <= 0) return null;
  if (!Number.isFinite(imageHeight) || imageHeight <= 0) return null;

  // Must have at least index 28 available
  if (landmarks.length < 29) return null;

  // Validate the 6 bilateral keypoints
  const requiredIndices = [23, 24, 25, 26, 27, 28] as const;
  for (const idx of requiredIndices) {
    const lm = landmarks[idx];
    if (!lm || typeof lm !== 'object') return null;
    if (lm.visibility !== undefined && (typeof lm.visibility !== 'number' || !Number.isFinite(lm.visibility) || lm.visibility < 0.65)) {
      return null;
    }
    if (typeof lm.x !== 'number' || !Number.isFinite(lm.x) || typeof lm.y !== 'number' || !Number.isFinite(lm.y)) {
      return null;
    }
  }

  // Convert normalized [0, 1] coordinates to unmirrored camera pixel space
  const lm23 = landmarks[23]!;
  const lm24 = landmarks[24]!;
  const lm25 = landmarks[25]!;
  const lm26 = landmarks[26]!;
  const lm27 = landmarks[27]!;
  const lm28 = landmarks[28]!;

  const hL = { x: lm23.x * imageWidth, y: lm23.y * imageHeight };
  const hR = { x: lm24.x * imageWidth, y: lm24.y * imageHeight };
  const kL = { x: lm25.x * imageWidth, y: lm25.y * imageHeight };
  const kR = { x: lm26.x * imageWidth, y: lm26.y * imageHeight };
  const aL = { x: lm27.x * imageWidth, y: lm27.y * imageHeight };
  const aR = { x: lm28.x * imageWidth, y: lm28.y * imageHeight };

  // Anatomical Orientation Invariant:
  // In camera pixel space, Y=0 is top of image and Y increases downwards towards floor.
  // Upright standing requires Y_ankle > Y_knee > Y_hip for both sides.
  if (!(aL.y > kL.y && kL.y > hL.y)) return null;
  if (!(aR.y > kR.y && kR.y > hR.y)) return null;

  // Bilateral standing leg lengths
  const lenL = Math.sqrt((aL.x - hL.x) ** 2 + (aL.y - hL.y) ** 2);
  const lenR = Math.sqrt((aR.x - hR.x) ** 2 + (aR.y - hR.y) ** 2);

  if (!Number.isFinite(lenL) || !Number.isFinite(lenR) || lenL <= 1e-4 || lenR <= 1e-4) {
    return null;
  }

  // Standing heights & vertical spans
  const hipMid = (hL.y + hR.y) / 2.0;
  const kneeMid = (kL.y + kR.y) / 2.0;
  const ankleMid = (aL.y + aR.y) / 2.0;
  const verticalSpan = kneeMid - hipMid;

  if (verticalSpan <= 1e-4) {
    return null;
  }

  const calTime = timestamp !== undefined && Number.isFinite(timestamp) ? timestamp : Date.now();

  return {
    L_standing: {
      L: lenL,
      R: lenR,
    },
    standingY: {
      hip: { L: hL.y, R: hR.y, midpoint: hipMid },
      knee: { L: kL.y, R: kR.y, midpoint: kneeMid },
      ankle: { L: aL.y, R: aR.y, midpoint: ankleMid },
    },
    calibratedAt: calTime,
    imageWidth,
    imageHeight,
    standingLegLengthL: lenL,
    standingLegLengthR: lenR,
    standingHipY_L: hL.y,
    standingHipY_R: hR.y,
    standingKneeY_L: kL.y,
    standingKneeY_R: kR.y,
    standingAnkleY_L: aL.y,
    standingAnkleY_R: aR.y,
    standingHipY: hipMid,
    standingKneeY: kneeMid,
    standingAnkleY: ankleMid,
    verticalSpan,
  };
}

/**
 * Computes signed frontal knee valgus deviation percentage relative to calibrated standing leg length.
 *
 * Neutral frontal axis at knee vertical height Y_k:
 *   X_baseline = X_h + (X_a - X_h) * (Y_k - Y_h) / (Y_a - Y_h)
 *
 * Polarity Enforcement in unmirrored camera space:
 *   - Left Leg: polarity = -1 (medial collapse towards midline decreases X).
 *   - Right Leg: polarity = +1 (medial collapse towards midline increases X).
 *
 * Signed Medial Deviation Percentage:
 *   valgusDevPct = (polarity * (X_k - X_baseline) / L_standing^side) * 100
 *
 * Invariant: Inward medial collapse MUST yield positive values (+); outward varus bow-leg MUST yield negative values (-).
 * Guard: If |Y_a - Y_h| <= 1e-4 or L_standing <= 1e-4, returns null.
 */
export function computeValgusDeviation(
  hip: Point2D,
  knee: Point2D,
  ankle: Point2D,
  baseline: StandingBaseline,
  side: Side
): number | null;
export function computeValgusDeviation(
  hip: Point2D | null | undefined,
  knee: Point2D | null | undefined,
  ankle: Point2D | null | undefined,
  baseline: StandingBaseline | null | undefined,
  side: Side
): number | null;
export function computeValgusDeviation(
  hip: Point2D | null | undefined,
  knee: Point2D | null | undefined,
  ankle: Point2D | null | undefined,
  baseline: StandingBaseline | null | undefined,
  side: Side
): number | null {
  if (!hip || !knee || !ankle || !baseline) return null;
  if (typeof hip !== 'object' || typeof knee !== 'object' || typeof ankle !== 'object') return null;

  // Visibility guards (< 0.65)
  if (hip.visibility !== undefined && (typeof hip.visibility !== 'number' || !Number.isFinite(hip.visibility) || hip.visibility < 0.65)) return null;
  if (knee.visibility !== undefined && (typeof knee.visibility !== 'number' || !Number.isFinite(knee.visibility) || knee.visibility < 0.65)) return null;
  if (ankle.visibility !== undefined && (typeof ankle.visibility !== 'number' || !Number.isFinite(ankle.visibility) || ankle.visibility < 0.65)) return null;

  let Xh = hip.x;
  let Yh = hip.y;
  let Xk = knee.x;
  let Yk = knee.y;
  let Xa = ankle.x;
  let Ya = ankle.y;

  if (
    typeof Xh !== 'number' || !Number.isFinite(Xh) ||
    typeof Yh !== 'number' || !Number.isFinite(Yh) ||
    typeof Xk !== 'number' || !Number.isFinite(Xk) ||
    typeof Yk !== 'number' || !Number.isFinite(Yk) ||
    typeof Xa !== 'number' || !Number.isFinite(Xa) ||
    typeof Ya !== 'number' || !Number.isFinite(Ya)
  ) {
    return null;
  }

  // Retrieve leg length for designated side
  const L_standing = side === 'L'
    ? (baseline.L_standing?.L ?? baseline.standingLegLengthL)
    : (baseline.L_standing?.R ?? baseline.standingLegLengthR);

  if (L_standing === undefined || !Number.isFinite(L_standing) || L_standing <= 1e-4) {
    return null;
  }

  // Guard against vertical division by zero on input coordinates (prone/horizontal posture or collapsed keypoints)
  if (Math.abs(ankle.y - hip.y) <= 1e-4) {
    return null;
  }

  // If points are provided in normalized [0, 1] coordinates while baseline was calibrated with pixel dimensions
  const pointsNormalized = (
    Math.abs(Xh) <= 1.0 && Math.abs(Yh) <= 1.0 &&
    Math.abs(Xk) <= 1.0 && Math.abs(Yk) <= 1.0 &&
    Math.abs(Xa) <= 1.0 && Math.abs(Ya) <= 1.0
  );
  if (pointsNormalized && baseline.imageWidth > 1 && baseline.imageHeight > 1 && L_standing > 2.0) {
    Xh *= baseline.imageWidth;
    Yh *= baseline.imageHeight;
    Xk *= baseline.imageWidth;
    Yk *= baseline.imageHeight;
    Xa *= baseline.imageWidth;
    Ya *= baseline.imageHeight;
  }

  // Guard against vertical division by zero on effective coordinates
  const deltaY = Ya - Yh;
  if (Math.abs(deltaY) <= 1e-4) {
    return null;
  }

  // Neutral frontal axis interpolation at current knee vertical height Yk
  const X_baseline = Xh + (Xa - Xh) * ((Yk - Yh) / deltaY);

  // Polarity in unmirrored camera coordinates:
  // Left leg appears on viewer's right (X ~ 0.60): medial collapse decreases X -> polarity = -1
  // Right leg appears on viewer's left (X ~ 0.40): medial collapse increases X -> polarity = +1
  const polarity = side === 'L' ? -1.0 : 1.0;

  const deviation = polarity * (Xk - X_baseline);
  const valgusDevPct = (deviation / L_standing) * 100.0;

  if (!Number.isFinite(valgusDevPct)) {
    return null;
  }

  // Avoid IEEE 754 negative zero (-0)
  return Object.is(valgusDevPct, -0) ? 0.0 : valgusDevPct;
}

/**
 * Computes normalized pelvic descent ratio relative to calibrated standing baseline.
 *
 * Formula:
 *   depthRatio = (currentHipY - Y_hip(standing)) / (Y_knee(standing) - Y_hip(standing))
 *
 * Characteristics:
 *   - 0.0 at upright standing
 *   - ~1.0 at parallel squat crease
 *   - > 1.0 below parallel
 *
 * Guard: If |Y_knee(standing) - Y_hip(standing)| <= 1e-4, returns 0.0.
 */
export function computeDepthRatio(
  currentHipY: number,
  baseline: StandingBaseline
): number;
export function computeDepthRatio(
  currentHipY: number | null | undefined,
  baseline: StandingBaseline | null | undefined
): number;
export function computeDepthRatio(
  currentHipY: number | null | undefined,
  baseline: StandingBaseline | null | undefined
): number {
  if (currentHipY === null || currentHipY === undefined || !baseline) return 0.0;
  if (typeof currentHipY !== 'number' || !Number.isFinite(currentHipY)) return 0.0;

  const standingHipY = baseline.standingY?.hip?.midpoint ?? baseline.standingHipY;
  const standingKneeY = baseline.standingY?.knee?.midpoint ?? baseline.standingKneeY;

  if (standingHipY === undefined || standingKneeY === undefined) return 0.0;

  const verticalSpan = standingKneeY - standingHipY;
  if (Math.abs(verticalSpan) <= 1e-4) {
    return 0.0;
  }

  let hipY = currentHipY;
  // If currentHipY is normalized [0, 1] but baseline was calibrated in pixel space
  if (
    Math.abs(hipY) <= 1.0 &&
    baseline.imageHeight !== undefined &&
    baseline.imageHeight > 1 &&
    Math.abs(standingHipY) > 2.0
  ) {
    hipY *= baseline.imageHeight;
  }

  const depthRatio = (hipY - standingHipY) / verticalSpan;
  if (!Number.isFinite(depthRatio)) {
    return 0.0;
  }

  return Object.is(depthRatio, -0) ? 0.0 : depthRatio;
}
