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
        hip: {
            L: number;
            R: number;
            midpoint: number;
        };
        knee: {
            L: number;
            R: number;
            midpoint: number;
        };
        ankle: {
            L: number;
            R: number;
            midpoint: number;
        };
    };
    /** Timestamp when calibration occurred (milliseconds epoch) */
    calibratedAt: number;
    /** Frame width in pixels */
    imageWidth: number;
    /** Frame height in pixels */
    imageHeight: number;
    standingLegLengthL: number;
    standingLegLengthR: number;
    standingHipY_L: number;
    standingHipY_R: number;
    standingKneeY_L: number;
    standingKneeY_R: number;
    standingAnkleY_L: number;
    standingAnkleY_R: number;
    standingHipY: number;
    standingKneeY: number;
    standingAnkleY: number;
    verticalSpan: number;
}
/**
 * BlazePose 33-landmark bilateral keypoint indices.
 */
export declare const BLAZEPOSE_KEYPOINTS: {
    readonly LEFT_HIP: 23;
    readonly RIGHT_HIP: 24;
    readonly LEFT_KNEE: 25;
    readonly RIGHT_KNEE: 26;
    readonly LEFT_ANKLE: 27;
    readonly RIGHT_ANKLE: 28;
};
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
export declare function compute3DKneeFlexion(hip: Point3D, knee: Point3D, ankle: Point3D): number | null;
export declare function compute3DKneeFlexion(hip: Point3D | null | undefined, knee: Point3D | null | undefined, ankle: Point3D | null | undefined): number | null;
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
export declare function calibrateStandingBaseline(landmarks: Point2D[], imageWidth: number, imageHeight: number, timestamp?: number): StandingBaseline | null;
export declare function calibrateStandingBaseline(landmarks: Array<Point2D | null | undefined>, imageWidth: number, imageHeight: number, timestamp?: number): StandingBaseline | null;
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
export declare function computeValgusDeviation(hip: Point2D, knee: Point2D, ankle: Point2D, baseline: StandingBaseline, side: Side): number | null;
export declare function computeValgusDeviation(hip: Point2D | null | undefined, knee: Point2D | null | undefined, ankle: Point2D | null | undefined, baseline: StandingBaseline | null | undefined, side: Side): number | null;
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
export declare function computeDepthRatio(currentHipY: number, baseline: StandingBaseline): number;
export declare function computeDepthRatio(currentHipY: number | null | undefined, baseline: StandingBaseline | null | undefined): number;
//# sourceMappingURL=geometry.d.ts.map