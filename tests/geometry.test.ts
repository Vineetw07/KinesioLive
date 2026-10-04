/**
 * tests/geometry.test.ts
 *
 * Comprehensive Vitest suite for Mathematical Geometry Engine (Day 3: D3.1).
 * Tests 3D sagittal knee flexion angle, standing baseline calibration,
 * frontal knee valgus deviation percentage, and normalized pelvic depth ratio.
 *
 * Verifies all boundary conditions, degenerate cases, polarity conventions,
 * and anatomical ordering guards per ORIGINAL_REQUEST.md § R1 & docs/trd.md § 3.
 */

import { describe, it, expect } from 'vitest';
import {
  compute3DKneeFlexion,
  calibrateStandingBaseline,
  computeValgusDeviation,
  computeDepthRatio,
  type Point3D,
  type Point2D,
} from '../client/src/engine/geometry';

describe('Mathematical Geometry Engine (geometry.ts)', () => {
  describe('compute3DKneeFlexion', () => {
    it('computes exactly 90.0° ± 0.1° for orthogonal 3D vectors', () => {
      // Knee at origin (0, 0, 0)
      const knee: Point3D = { x: 0.0, y: 0.0, z: 0.0, visibility: 0.99 };
      // Hip on positive Y axis: v1 = (0, 0.45, 0)
      const hip: Point3D = { x: 0.0, y: 0.45, z: 0.0, visibility: 0.99 };
      // Ankle on positive Z axis: v2 = (0, 0, 0.45)
      const ankle: Point3D = { x: 0.0, y: 0.0, z: 0.45, visibility: 0.99 };

      const angle = compute3DKneeFlexion(hip, knee, ankle);
      expect(angle).not.toBeNull();
      expect(angle!).toBeCloseTo(90.0, 1);
    });

    it('computes exactly 180.0° ± 0.1° for collinear opposite straight leg vectors', () => {
      // Straight upright standing leg along Y axis
      const knee: Point3D = { x: 0.15, y: 0.0, z: 0.0, visibility: 0.95 };
      const hip: Point3D = { x: 0.15, y: 0.45, z: 0.0, visibility: 0.95 };
      const ankle: Point3D = { x: 0.15, y: -0.45, z: 0.0, visibility: 0.95 };

      const angle = compute3DKneeFlexion(hip, knee, ankle);
      expect(angle).not.toBeNull();
      expect(angle!).toBeCloseTo(180.0, 1);
    });

    it('computes acute angle (~60.0° ± 0.1°) for deep flexion', () => {
      const rad60 = (60.0 * Math.PI) / 180.0;
      const knee: Point3D = { x: 0.0, y: 0.0, z: 0.0, visibility: 0.99 };
      const ankle: Point3D = { x: 0.0, y: -0.45, z: 0.0, visibility: 0.99 };
      const hip: Point3D = {
        x: 0.0,
        y: -0.45 * Math.cos(rad60),
        z: 0.45 * Math.sin(rad60),
        visibility: 0.99,
      };

      const angle = compute3DKneeFlexion(hip, knee, ankle);
      expect(angle).not.toBeNull();
      expect(angle!).toBeCloseTo(60.0, 1);
    });

    it('returns null (never NaN, Infinity, or dummy 180) for degenerate zero-length vectors (||v|| <= 1e-6)', () => {
      const knee: Point3D = { x: 0.15, y: 0.0, z: 0.0, visibility: 0.99 };
      // Hip coincident with knee
      const hipCoincident: Point3D = { x: 0.15, y: 0.0, z: 0.0, visibility: 0.99 };
      const ankle: Point3D = { x: 0.15, y: -0.45, z: 0.0, visibility: 0.99 };

      const res1 = compute3DKneeFlexion(hipCoincident, knee, ankle);
      expect(res1).toBeNull();

      // Ankle coincident with knee
      const ankleCoincident: Point3D = { x: 0.15, y: 0.0, z: 0.0, visibility: 0.99 };
      const res2 = compute3DKneeFlexion(hipCoincident, knee, ankleCoincident);
      expect(res2).toBeNull();

      // Vector magnitude barely below threshold (e.g. 5e-7)
      const hipNearZero: Point3D = { x: 0.15, y: 5e-7, z: 0.0, visibility: 0.99 };
      const res3 = compute3DKneeFlexion(hipNearZero, knee, ankle);
      expect(res3).toBeNull();
    });

    it('returns null when any coordinate is non-finite (NaN or Infinity)', () => {
      const knee: Point3D = { x: 0.0, y: 0.0, z: 0.0, visibility: 0.99 };
      const ankle: Point3D = { x: 0.0, y: -0.45, z: 0.0, visibility: 0.99 };

      expect(compute3DKneeFlexion({ x: NaN, y: 0.45, z: 0.0 }, knee, ankle)).toBeNull();
      expect(compute3DKneeFlexion({ x: 0.0, y: Infinity, z: 0.0 }, knee, ankle)).toBeNull();
      expect(compute3DKneeFlexion({ x: 0.0, y: 0.45, z: -Infinity }, knee, ankle)).toBeNull();
      expect(compute3DKneeFlexion(null as any, knee, ankle)).toBeNull();
    });

    it('returns null when landmark visibility is below 0.65', () => {
      const knee: Point3D = { x: 0.0, y: 0.0, z: 0.0, visibility: 0.99 };
      const ankle: Point3D = { x: 0.0, y: -0.45, z: 0.0, visibility: 0.99 };
      const hipLowVis: Point3D = { x: 0.0, y: 0.45, z: 0.0, visibility: 0.64 }; // < 0.65

      expect(compute3DKneeFlexion(hipLowVis, knee, ankle)).toBeNull();

      const kneeLowVis: Point3D = { x: 0.0, y: 0.0, z: 0.0, visibility: 0.50 };
      expect(compute3DKneeFlexion({ x: 0.0, y: 0.45, z: 0.0, visibility: 0.99 }, kneeLowVis, ankle)).toBeNull();

      const ankleLowVis: Point3D = { x: 0.0, y: -0.45, z: 0.0, visibility: 0.10 };
      expect(compute3DKneeFlexion({ x: 0.0, y: 0.45, z: 0.0, visibility: 0.99 }, knee, ankleLowVis)).toBeNull();
    });
  });

  describe('calibrateStandingBaseline', () => {
    function makeValidStandingLandmarks(): Point2D[] {
      const lms: Point2D[] = [];
      for (let i = 0; i < 33; i++) {
        lms.push({ x: 0.5, y: 0.5, visibility: 0.99 });
      }
      // Left leg (viewer right, X=370px => x = 370/640 ~ 0.578125)
      lms[23] = { x: 370 / 640, y: 240 / 480, visibility: 0.99 }; // Left Hip (Y=240)
      lms[25] = { x: 370 / 640, y: 336 / 480, visibility: 0.99 }; // Left Knee (Y=336)
      lms[27] = { x: 370 / 640, y: 432 / 480, visibility: 0.99 }; // Left Ankle (Y=432)

      // Right leg (viewer left, X=270px => x = 270/640 ~ 0.421875)
      lms[24] = { x: 270 / 640, y: 240 / 480, visibility: 0.99 }; // Right Hip (Y=240)
      lms[26] = { x: 270 / 640, y: 336 / 480, visibility: 0.99 }; // Right Knee (Y=336)
      lms[28] = { x: 270 / 640, y: 432 / 480, visibility: 0.99 }; // Right Ankle (Y=432)
      return lms;
    }

    it('successfully calibrates standing baseline with positive bilateral leg lengths and vertical spans', () => {
      const lms = makeValidStandingLandmarks();
      const baseline = calibrateStandingBaseline(lms, 640, 480, 1000);

      expect(baseline).not.toBeNull();
      // Leg length: sqrt((370-370)^2 + (432-240)^2) = 192 px
      expect(baseline!.standingLegLengthL).toBeCloseTo(192.0, 1);
      expect(baseline!.standingLegLengthR).toBeCloseTo(192.0, 1);
      expect(baseline!.L_standing.L).toBeCloseTo(192.0, 1);
      expect(baseline!.L_standing.R).toBeCloseTo(192.0, 1);

      // Heights: hip=240, knee=336, ankle=432
      expect(baseline!.standingHipY).toBeCloseTo(240.0, 1);
      expect(baseline!.standingKneeY).toBeCloseTo(336.0, 1);
      expect(baseline!.standingAnkleY).toBeCloseTo(432.0, 1);
      expect(baseline!.verticalSpan).toBeCloseTo(96.0, 1); // 336 - 240
      expect(baseline!.calibratedAt).toBe(1000);
    });

    it('rejects inverted human posture (Y_ankle <= Y_knee or Y_knee <= Y_hip)', () => {
      const lms = makeValidStandingLandmarks();
      // Invert Left knee above hip: Y_knee = 200 < Y_hip = 240
      lms[25] = { x: 370 / 640, y: 200 / 480, visibility: 0.99 };

      const baseline = calibrateStandingBaseline(lms, 640, 480);
      expect(baseline).toBeNull();

      // Invert Right ankle above knee: Y_ankle = 300 < Y_knee = 336
      const lms2 = makeValidStandingLandmarks();
      lms2[28] = { x: 270 / 640, y: 300 / 480, visibility: 0.99 };
      expect(calibrateStandingBaseline(lms2, 640, 480)).toBeNull();
    });

    it('returns null if any of the 6 bilateral keypoints has visibility < 0.65 or is missing', () => {
      const lms = makeValidStandingLandmarks();
      lms[23] = { x: 370 / 640, y: 240 / 480, visibility: 0.60 }; // Left hip low vis
      expect(calibrateStandingBaseline(lms, 640, 480)).toBeNull();

      const lms2 = makeValidStandingLandmarks();
      lms2[26] = null as any; // Right knee missing
      expect(calibrateStandingBaseline(lms2, 640, 480)).toBeNull();
    });

    it('rejects zero or negative image dimensions', () => {
      const lms = makeValidStandingLandmarks();
      expect(calibrateStandingBaseline(lms, 0, 480)).toBeNull();
      expect(calibrateStandingBaseline(lms, 640, -480)).toBeNull();
    });
  });

  describe('computeValgusDeviation', () => {
    function getStandardBaseline() {
      const lms: Point2D[] = [];
      for (let i = 0; i < 33; i++) lms.push({ x: 0.5, y: 0.5, visibility: 0.99 });
      lms[23] = { x: 370 / 640, y: 240 / 480, visibility: 0.99 };
      lms[25] = { x: 370 / 640, y: 336 / 480, visibility: 0.99 };
      lms[27] = { x: 370 / 640, y: 432 / 480, visibility: 0.99 };
      lms[24] = { x: 270 / 640, y: 240 / 480, visibility: 0.99 };
      lms[26] = { x: 270 / 640, y: 336 / 480, visibility: 0.99 };
      lms[28] = { x: 270 / 640, y: 432 / 480, visibility: 0.99 };
      return calibrateStandingBaseline(lms, 640, 480)!;
    }

    it('yields 0.0% for neutral frontal alignment on both legs', () => {
      const baseline = getStandardBaseline();

      // Left leg neutral: Xh=370, Xk=370, Xa=370
      const hipL: Point2D = { x: 370, y: 240, visibility: 0.99 };
      const kneeL: Point2D = { x: 370, y: 336, visibility: 0.99 };
      const ankleL: Point2D = { x: 370, y: 432, visibility: 0.99 };

      const devL = computeValgusDeviation(hipL, kneeL, ankleL, baseline, 'L');
      expect(devL).not.toBeNull();
      expect(devL!).toBeCloseTo(0.0, 1);

      // Right leg neutral: Xh=270, Xk=270, Xa=270
      const hipR: Point2D = { x: 270, y: 240, visibility: 0.99 };
      const kneeR: Point2D = { x: 270, y: 336, visibility: 0.99 };
      const ankleR: Point2D = { x: 270, y: 432, visibility: 0.99 };

      const devR = computeValgusDeviation(hipR, kneeR, ankleR, baseline, 'R');
      expect(devR).not.toBeNull();
      expect(devR!).toBeCloseTo(0.0, 1);
    });

    it('strictly enforces positive (+) polarity for medial inward collapse on Left leg (X decreases)', () => {
      const baseline = getStandardBaseline();
      const hipL: Point2D = { x: 370, y: 240, visibility: 0.99 };
      // Left knee collapses medially toward body midline (decreasing X: 370 -> 344 px, -26px)
      const kneeL_medial: Point2D = { x: 344, y: 336, visibility: 0.99 };
      const ankleL: Point2D = { x: 370, y: 432, visibility: 0.99 };

      const devL = computeValgusDeviation(hipL, kneeL_medial, ankleL, baseline, 'L');
      expect(devL).not.toBeNull();
      // devPct = (-1 * (344 - 370) / 192) * 100 = 26/192 * 100 = +13.54%
      expect(devL!).toBeGreaterThan(0.0);
      expect(devL!).toBeCloseTo(13.54, 1);
    });

    it('strictly enforces positive (+) polarity for medial inward collapse on Right leg (X increases)', () => {
      const baseline = getStandardBaseline();
      const hipR: Point2D = { x: 270, y: 240, visibility: 0.99 };
      // Right knee collapses medially toward body midline (increasing X: 270 -> 296 px, +26px)
      const kneeR_medial: Point2D = { x: 296, y: 336, visibility: 0.99 };
      const ankleR: Point2D = { x: 270, y: 432, visibility: 0.99 };

      const devR = computeValgusDeviation(hipR, kneeR_medial, ankleR, baseline, 'R');
      expect(devR).not.toBeNull();
      // devPct = (+1 * (296 - 270) / 192) * 100 = +13.54%
      expect(devR!).toBeGreaterThan(0.0);
      expect(devR!).toBeCloseTo(13.54, 1);
    });

    it('strictly enforces negative (-) polarity for outward varus bow-leg deviation on both legs', () => {
      const baseline = getStandardBaseline();

      // Left leg outward varus (increasing X: 370 -> 389 px)
      const hipL: Point2D = { x: 370, y: 240, visibility: 0.99 };
      const kneeL_varus: Point2D = { x: 389, y: 336, visibility: 0.99 };
      const ankleL: Point2D = { x: 370, y: 432, visibility: 0.99 };

      const devL = computeValgusDeviation(hipL, kneeL_varus, ankleL, baseline, 'L');
      expect(devL).not.toBeNull();
      expect(devL!).toBeLessThan(0.0);
      expect(devL!).toBeCloseTo(-9.9, 1);

      // Right leg outward varus (decreasing X: 270 -> 251 px)
      const hipR: Point2D = { x: 270, y: 240, visibility: 0.99 };
      const kneeR_varus: Point2D = { x: 251, y: 336, visibility: 0.99 };
      const ankleR: Point2D = { x: 270, y: 432, visibility: 0.99 };

      const devR = computeValgusDeviation(hipR, kneeR_varus, ankleR, baseline, 'R');
      expect(devR).not.toBeNull();
      expect(devR!).toBeLessThan(0.0);
      expect(devR!).toBeCloseTo(-9.9, 1);
    });

    it('safely guards vertical segment collapse (|Y_ankle - Y_hip| <= 1e-4) returning null without division by zero', () => {
      const baseline = getStandardBaseline();
      const hip: Point2D = { x: 370, y: 240, visibility: 0.99 };
      const knee: Point2D = { x: 370, y: 240, visibility: 0.99 };
      // Ankle has identical Y coordinate to hip
      const ankleHorizontal: Point2D = { x: 450, y: 240, visibility: 0.99 };

      const res = computeValgusDeviation(hip, knee, ankleHorizontal, baseline, 'L');
      expect(res).toBeNull();
    });

    it('returns null on visibility < 0.65 or non-finite inputs', () => {
      const baseline = getStandardBaseline();
      const hip: Point2D = { x: 370, y: 240, visibility: 0.99 };
      const knee: Point2D = { x: 370, y: 336, visibility: 0.60 }; // low vis
      const ankle: Point2D = { x: 370, y: 432, visibility: 0.99 };

      expect(computeValgusDeviation(hip, knee, ankle, baseline, 'L')).toBeNull();
      expect(computeValgusDeviation({ x: NaN, y: 240 }, knee, ankle, baseline, 'L')).toBeNull();
      expect(computeValgusDeviation(hip, knee, ankle, null as any, 'L')).toBeNull();
    });
  });

  describe('computeDepthRatio', () => {
    function getStandardBaseline() {
      const lms: Point2D[] = [];
      for (let i = 0; i < 33; i++) lms.push({ x: 0.5, y: 0.5, visibility: 0.99 });
      lms[23] = { x: 370 / 640, y: 240 / 480, visibility: 0.99 };
      lms[25] = { x: 370 / 640, y: 336 / 480, visibility: 0.99 };
      lms[27] = { x: 370 / 640, y: 432 / 480, visibility: 0.99 };
      lms[24] = { x: 270 / 640, y: 240 / 480, visibility: 0.99 };
      lms[26] = { x: 270 / 640, y: 336 / 480, visibility: 0.99 };
      lms[28] = { x: 270 / 640, y: 432 / 480, visibility: 0.99 };
      return calibrateStandingBaseline(lms, 640, 480)!;
    }

    it('returns 0.0 at standing baseline height', () => {
      const baseline = getStandardBaseline();
      // Standing hip height is 240 px
      const depth = computeDepthRatio(240, baseline);
      expect(depth).toBeCloseTo(0.0, 2);
    });

    it('returns ~1.0 at parallel squat crease (hip descends to knee height)', () => {
      const baseline = getStandardBaseline();
      // Knee height is 336 px, vertical span = 96 px
      const depth = computeDepthRatio(336, baseline);
      expect(depth).toBeCloseTo(1.0, 2);
    });

    it('returns > 1.0 below parallel (deep squat)', () => {
      const baseline = getStandardBaseline();
      // Hip descends to 345.6 px (vertical descent = 105.6 px => ratio = 105.6 / 96 = 1.10)
      const depth = computeDepthRatio(345.6, baseline);
      expect(depth).toBeGreaterThan(1.0);
      expect(depth).toBeCloseTo(1.10, 2);
    });

    it('returns 0.0 safely if vertical span is degenerate (|verticalSpan| <= 1e-4)', () => {
      const degenerateBaseline = {
        standingLegLengthL: 192,
        standingLegLengthR: 192,
        L_standing: { L: 192, R: 192 },
        standingHipY_L: 240,
        standingHipY_R: 240,
        standingKneeY_L: 240,
        standingKneeY_R: 240,
        standingAnkleY_L: 432,
        standingAnkleY_R: 432,
        standingHipY: 240,
        standingKneeY: 240,
        standingAnkleY: 432,
        standingY: {
          hip: { L: 240, R: 240, midpoint: 240 },
          knee: { L: 240, R: 240, midpoint: 240 },
          ankle: { L: 432, R: 432, midpoint: 432 },
        },
        verticalSpan: 0.0,
        imageWidth: 640,
        imageHeight: 480,
        calibratedAt: Date.now(),
      };

      const depth = computeDepthRatio(300, degenerateBaseline as any);
      expect(depth).toBe(0.0);
    });

    it('returns 0.0 on null or non-finite inputs', () => {
      const baseline = getStandardBaseline();
      expect(computeDepthRatio(null as any, baseline)).toBe(0.0);
      expect(computeDepthRatio(NaN, baseline)).toBe(0.0);
      expect(computeDepthRatio(240, null as any)).toBe(0.0);
    });
  });
});
