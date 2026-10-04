/**
 * tests/challenger_d3_1.test.ts
 *
 * Adversarial Challenge & Stress-Test Suite for Mathematical Geometry Engine
 * and Kinematic Smoothing Filters (challenger_d3_1).
 *
 * Scopes tested:
 * 1. Degenerate inputs: vector magnitude 0, 1e-7, 1e-6 (must return null)
 * 2. Non-finite coordinates: NaN, Infinity, -Infinity (must return null, never NaN)
 * 3. Visibility < 0.65 threshold boundary (must return null)
 * 4. 3D angles: orthogonal (90.0°), straight collinear (180.0°), acute (30°, 45°, 60°), rotated in 3D
 * 5. Inverted anatomical postures for calibration (must reject with null)
 * 6. Valgus polarity: Left medial (+), Right medial (+), Left varus (-), Right varus (-)
 * 7. Horizontal leg segment (|Y_a - Y_h| <= 1e-4) guard against division by zero
 * 8. Median filter: single-frame impulse annihilation, alternating spikes, null/NaN resets
 * 9. EMA filter: step response rise time, latency < 50ms at 30 FPS, missing frame hold & 3-frame reset
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
import {
  SlidingMedianFilter,
  ExponentialMovingAverageFilter,
} from '../client/src/engine/smoothing';

describe('Adversarial Challenger Suite: Geometry & Smoothing Engine', () => {
  // =========================================================================
  // 1. Degenerate Inputs (Vector magnitude <= 1e-6)
  // =========================================================================
  describe('1. Degenerate Inputs (compute3DKneeFlexion)', () => {
    const knee: Point3D = { x: 0.0, y: 0.0, z: 0.0, visibility: 0.95 };
    const validAnkle: Point3D = { x: 0.0, y: -0.5, z: 0.0, visibility: 0.95 };

    it('rejects vector magnitude 0 (coincident hip and knee)', () => {
      const hipZero: Point3D = { x: 0.0, y: 0.0, z: 0.0, visibility: 0.95 };
      expect(compute3DKneeFlexion(hipZero, knee, validAnkle)).toBeNull();
    });

    it('rejects vector magnitude 0 (coincident ankle and knee)', () => {
      const validHip: Point3D = { x: 0.0, y: 0.5, z: 0.0, visibility: 0.95 };
      const ankleZero: Point3D = { x: 0.0, y: 0.0, z: 0.0, visibility: 0.95 };
      expect(compute3DKneeFlexion(validHip, knee, ankleZero)).toBeNull();
    });

    it('rejects vector magnitude 1e-7 (far below 1e-6 threshold)', () => {
      const hip1e7: Point3D = { x: 1e-7, y: 0.0, z: 0.0, visibility: 0.95 };
      expect(compute3DKneeFlexion(hip1e7, knee, validAnkle)).toBeNull();
    });

    it('rejects vector magnitude 1e-6 (exact boundary <= 1e-6)', () => {
      const hip1e6: Point3D = { x: 1e-6, y: 0.0, z: 0.0, visibility: 0.95 };
      expect(compute3DKneeFlexion(hip1e6, knee, validAnkle)).toBeNull();

      const ankle1e6: Point3D = { x: 0.0, y: 1e-6, z: 0.0, visibility: 0.95 };
      const validHip: Point3D = { x: 0.0, y: 0.5, z: 0.0, visibility: 0.95 };
      expect(compute3DKneeFlexion(validHip, knee, ankle1e6)).toBeNull();
    });

    it('rejects 3D vector where Euclidean norm is 1e-6: sqrt((1/sqrt(3)*1e-6)^2 * 3) = 1e-6', () => {
      const comp = 1e-6 / Math.sqrt(3);
      const hipNorm1e6: Point3D = { x: comp, y: comp, z: comp, visibility: 0.95 };
      expect(compute3DKneeFlexion(hipNorm1e6, knee, validAnkle)).toBeNull();
    });

    it('accepts valid vector just above threshold (e.g. 1e-4)', () => {
      const hip1e4: Point3D = { x: 1e-4, y: 0.0, z: 0.0, visibility: 0.95 };
      const res = compute3DKneeFlexion(hip1e4, knee, validAnkle);
      expect(res).not.toBeNull();
      expect(res!).toBeCloseTo(90.0, 1);
    });
  });

  // =========================================================================
  // 2. Non-Finite Coordinates (NaN, Infinity, -Infinity)
  // =========================================================================
  describe('2. Non-Finite Coordinates (Never NaN or Infinity)', () => {
    const knee: Point3D = { x: 0.0, y: 0.0, z: 0.0, visibility: 0.95 };
    const ankle: Point3D = { x: 0.0, y: -0.45, z: 0.0, visibility: 0.95 };

    it('compute3DKneeFlexion returns null when coordinates contain NaN, +Infinity, or -Infinity', () => {
      const nonFinites = [NaN, Infinity, -Infinity];

      for (const val of nonFinites) {
        expect(compute3DKneeFlexion({ x: val, y: 0.45, z: 0.0 }, knee, ankle)).toBeNull();
        expect(compute3DKneeFlexion({ x: 0.0, y: val, z: 0.0 }, knee, ankle)).toBeNull();
        expect(compute3DKneeFlexion({ x: 0.0, y: 0.45, z: val }, knee, ankle)).toBeNull();
        expect(compute3DKneeFlexion({ x: 0.0, y: 0.45, z: 0.0 }, { x: val, y: 0.0, z: 0.0 }, ankle)).toBeNull();
        expect(compute3DKneeFlexion({ x: 0.0, y: 0.45, z: 0.0 }, knee, { x: 0.0, y: 0.0, z: val })).toBeNull();
      }
    });

    it('calibrateStandingBaseline returns null on non-finite coordinates or dimensions', () => {
      const lms: Point2D[] = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 0.95 }));
      lms[23] = { x: 0.6, y: 0.5, visibility: 0.95 };
      lms[25] = { x: 0.6, y: 0.7, visibility: 0.95 };
      lms[27] = { x: 0.6, y: 0.9, visibility: 0.95 };
      lms[24] = { x: 0.4, y: 0.5, visibility: 0.95 };
      lms[26] = { x: 0.4, y: 0.7, visibility: 0.95 };
      lms[28] = { x: 0.4, y: 0.9, visibility: 0.95 };

      // Valid baseline check
      expect(calibrateStandingBaseline(lms, 640, 480)).not.toBeNull();

      // Non-finite image dimensions
      expect(calibrateStandingBaseline(lms, NaN, 480)).toBeNull();
      expect(calibrateStandingBaseline(lms, 640, Infinity)).toBeNull();

      // Non-finite keypoints
      const lmsNaN = [...lms];
      lmsNaN[25] = { x: NaN, y: 0.7, visibility: 0.95 };
      expect(calibrateStandingBaseline(lmsNaN, 640, 480)).toBeNull();

      const lmsInf = [...lms];
      lmsInf[28] = { x: 0.4, y: Infinity, visibility: 0.95 };
      expect(calibrateStandingBaseline(lmsInf, 640, 480)).toBeNull();
    });

    it('computeValgusDeviation returns null on non-finite coordinates', () => {
      const lms: Point2D[] = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 0.95 }));
      lms[23] = { x: 0.6, y: 0.5, visibility: 0.95 };
      lms[25] = { x: 0.6, y: 0.7, visibility: 0.95 };
      lms[27] = { x: 0.6, y: 0.9, visibility: 0.95 };
      lms[24] = { x: 0.4, y: 0.5, visibility: 0.95 };
      lms[26] = { x: 0.4, y: 0.7, visibility: 0.95 };
      lms[28] = { x: 0.4, y: 0.9, visibility: 0.95 };
      const baseline = calibrateStandingBaseline(lms, 640, 480)!;

      const kneeNaN: Point2D = { x: NaN, y: 0.7, visibility: 0.95 };
      const ankleInf: Point2D = { x: 0.6, y: Infinity, visibility: 0.95 };
      expect(computeValgusDeviation(lms[23], kneeNaN, lms[27], baseline, 'L')).toBeNull();
      expect(computeValgusDeviation(lms[23], lms[25], ankleInf, baseline, 'L')).toBeNull();
    });

    it('computeDepthRatio returns 0.0 on NaN or non-finite inputs', () => {
      const lms: Point2D[] = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 0.95 }));
      lms[23] = { x: 0.6, y: 0.5, visibility: 0.95 };
      lms[25] = { x: 0.6, y: 0.7, visibility: 0.95 };
      lms[27] = { x: 0.6, y: 0.9, visibility: 0.95 };
      lms[24] = { x: 0.4, y: 0.5, visibility: 0.95 };
      lms[26] = { x: 0.4, y: 0.7, visibility: 0.95 };
      lms[28] = { x: 0.4, y: 0.9, visibility: 0.95 };
      const baseline = calibrateStandingBaseline(lms, 640, 480)!;

      expect(computeDepthRatio(NaN, baseline)).toBe(0.0);
      expect(computeDepthRatio(Infinity, baseline)).toBe(0.0);
      expect(computeDepthRatio(-Infinity, baseline)).toBe(0.0);
    });
  });

  // =========================================================================
  // 3. Visibility Threshold (< 0.65)
  // =========================================================================
  describe('3. Visibility Threshold (< 0.65)', () => {
    const knee: Point3D = { x: 0.0, y: 0.0, z: 0.0, visibility: 0.95 };
    const ankle: Point3D = { x: 0.0, y: -0.45, z: 0.0, visibility: 0.95 };

    it('rejects visibility strictly below 0.65 (e.g., 0.649999)', () => {
      const hipBarelyUnder: Point3D = { x: 0.0, y: 0.45, z: 0.0, visibility: 0.649999 };
      expect(compute3DKneeFlexion(hipBarelyUnder, knee, ankle)).toBeNull();

      const kneeBarelyUnder: Point3D = { x: 0.0, y: 0.0, z: 0.0, visibility: 0.64 };
      expect(compute3DKneeFlexion({ x: 0.0, y: 0.45, z: 0.0, visibility: 0.95 }, kneeBarelyUnder, ankle)).toBeNull();

      const ankleBarelyUnder: Point3D = { x: 0.0, y: -0.45, z: 0.0, visibility: 0.0 };
      expect(compute3DKneeFlexion({ x: 0.0, y: 0.45, z: 0.0, visibility: 0.95 }, knee, ankleBarelyUnder)).toBeNull();
    });

    it('accepts visibility >= 0.65 (boundary 0.6500)', () => {
      const hipBoundary: Point3D = { x: 0.0, y: 0.45, z: 0.0, visibility: 0.65 };
      const res = compute3DKneeFlexion(hipBoundary, knee, ankle);
      expect(res).not.toBeNull();
      expect(res!).toBeCloseTo(180.0, 1);
    });

    it('rejects non-numeric or non-finite visibility', () => {
      const hipNaNVis: Point3D = { x: 0.0, y: 0.45, z: 0.0, visibility: NaN };
      expect(compute3DKneeFlexion(hipNaNVis, knee, ankle)).toBeNull();

      const hipInfVis: Point3D = { x: 0.0, y: 0.45, z: 0.0, visibility: Infinity };
      expect(compute3DKneeFlexion(hipInfVis, knee, ankle)).toBeNull();
    });
  });

  // =========================================================================
  // 4. 3D Angles: Orthogonal, Straight Collinear, and Acute (30°, 45°, 60°)
  // =========================================================================
  describe('4. 3D Angles Accuracy & Invariance', () => {
    it('computes exactly 90.0° for orthogonal 3D vectors', () => {
      const knee: Point3D = { x: 1.0, y: 2.0, z: 3.0, visibility: 0.99 };
      const hip: Point3D = { x: 1.0, y: 2.5, z: 3.0, visibility: 0.99 }; // (0, 0.5, 0)
      const ankle: Point3D = { x: 1.5, y: 2.0, z: 3.0, visibility: 0.99 }; // (0.5, 0, 0)

      const angle = compute3DKneeFlexion(hip, knee, ankle);
      expect(angle).not.toBeNull();
      expect(angle!).toBeCloseTo(90.0, 2);
    });

    it('computes exactly 180.0° for straight collinear leg', () => {
      const knee: Point3D = { x: 0.2, y: 0.5, z: -0.1, visibility: 0.99 };
      const hip: Point3D = { x: 0.2, y: 0.9, z: -0.1, visibility: 0.99 }; // (0, +0.4, 0)
      const ankle: Point3D = { x: 0.2, y: 0.1, z: -0.1, visibility: 0.99 }; // (0, -0.4, 0)

      const angle = compute3DKneeFlexion(hip, knee, ankle);
      expect(angle).not.toBeNull();
      expect(angle!).toBeCloseTo(180.0, 2);
    });

    it('computes 30.0°, 45.0°, and 60.0° acute angles across 3D orientations', () => {
      const L = 0.45;
      const knee: Point3D = { x: 0.0, y: 0.0, z: 0.0, visibility: 1.0 };
      // Base shank along positive X axis: (L, 0, 0)
      const ankle: Point3D = { x: L, y: 0.0, z: 0.0, visibility: 1.0 };

      const anglesToTest = [30.0, 45.0, 60.0, 75.0, 120.0, 135.0, 150.0];

      for (const deg of anglesToTest) {
        const rad = (deg * Math.PI) / 180.0;
        // Hip rotated in XY plane by `deg`
        const hip: Point3D = {
          x: L * Math.cos(rad),
          y: L * Math.sin(rad),
          z: 0.0,
          visibility: 1.0,
        };

        const calculated = compute3DKneeFlexion(hip, knee, ankle);
        expect(calculated).not.toBeNull();
        expect(calculated!).toBeCloseTo(deg, 2);
      }
    });

    it('remains invariant under arbitrary 3D rotation (Rodrigues / 3D axis tilt)', () => {
      // Create a 60° angle, then rotate all points in 3D around axis (1, 1, 1)
      const deg = 60.0;
      const rad = (deg * Math.PI) / 180.0;
      const L = 0.40;

      // Unrotated points
      const pKnee = [0.1, 0.2, 0.3];
      const pAnkle = [pKnee[0] + L, pKnee[1], pKnee[2]];
      const pHip = [pKnee[0] + L * Math.cos(rad), pKnee[1] + L * Math.sin(rad), pKnee[2]];

      // Arbitrary 3D rotation matrix (yaw=37°, pitch=42°, roll=19°)
      const yaw = 0.645;
      const pitch = 0.733;
      const roll = 0.331;

      const Rz = [
        [Math.cos(yaw), -Math.sin(yaw), 0],
        [Math.sin(yaw), Math.cos(yaw), 0],
        [0, 0, 1],
      ];
      const Ry = [
        [Math.cos(pitch), 0, Math.sin(pitch)],
        [0, 1, 0],
        [-Math.sin(pitch), 0, Math.cos(pitch)],
      ];
      const Rx = [
        [1, 0, 0],
        [0, Math.cos(roll), -Math.sin(roll)],
        [0, Math.sin(roll), Math.cos(roll)],
      ];

      function matMulVec(m: number[][], v: number[]): number[] {
        return [
          m[0][0] * v[0] + m[0][1] * v[1] + m[0][2] * v[2],
          m[1][0] * v[0] + m[1][1] * v[1] + m[1][2] * v[2],
          m[2][0] * v[0] + m[2][1] * v[1] + m[2][2] * v[2],
        ];
      }

      function rotate(v: number[]): number[] {
        return matMulVec(Rz, matMulVec(Ry, matMulVec(Rx, v)));
      }

      const rotKnee = rotate(pKnee);
      const rotAnkle = rotate(pAnkle);
      const rotHip = rotate(pHip);

      const k3D: Point3D = { x: rotKnee[0], y: rotKnee[1], z: rotKnee[2], visibility: 0.99 };
      const a3D: Point3D = { x: rotAnkle[0], y: rotAnkle[1], z: rotAnkle[2], visibility: 0.99 };
      const h3D: Point3D = { x: rotHip[0], y: rotHip[1], z: rotHip[2], visibility: 0.99 };

      const computed = compute3DKneeFlexion(h3D, k3D, a3D);
      expect(computed).not.toBeNull();
      expect(computed!).toBeCloseTo(deg, 1);
    });
  });

  // =========================================================================
  // 5. Inverted Anatomical Postures for Standing Calibration
  // =========================================================================
  describe('5. Inverted Anatomical Posture Rejection (calibrateStandingBaseline)', () => {
    function makeStandardLandmarks(): Point2D[] {
      const lms: Point2D[] = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 0.95 }));
      // Left leg (viewer right)
      lms[23] = { x: 0.6, y: 0.4, visibility: 0.95 }; // Hip
      lms[25] = { x: 0.6, y: 0.6, visibility: 0.95 }; // Knee
      lms[27] = { x: 0.6, y: 0.8, visibility: 0.95 }; // Ankle
      // Right leg (viewer left)
      lms[24] = { x: 0.4, y: 0.4, visibility: 0.95 }; // Hip
      lms[26] = { x: 0.4, y: 0.6, visibility: 0.95 }; // Knee
      lms[28] = { x: 0.4, y: 0.8, visibility: 0.95 }; // Ankle
      return lms;
    }

    it('rejects upside-down inverted posture (handstand: Y_ankle < Y_knee < Y_hip)', () => {
      const lms = makeStandardLandmarks();
      // Ankle is top (Y=0.2), Knee middle (Y=0.5), Hip bottom (Y=0.8)
      lms[23].y = 0.8; lms[25].y = 0.5; lms[27].y = 0.2;
      lms[24].y = 0.8; lms[26].y = 0.5; lms[28].y = 0.2;

      expect(calibrateStandingBaseline(lms, 640, 480)).toBeNull();
    });

    it('rejects when Left knee is higher than hip (Y_knee <= Y_hip)', () => {
      const lms = makeStandardLandmarks();
      lms[25].y = 0.35; // knee at 0.35, hip at 0.40
      expect(calibrateStandingBaseline(lms, 640, 480)).toBeNull();
    });

    it('rejects when Right ankle is higher than knee (Y_ankle <= Y_knee)', () => {
      const lms = makeStandardLandmarks();
      lms[28].y = 0.55; // ankle at 0.55, knee at 0.60
      expect(calibrateStandingBaseline(lms, 640, 480)).toBeNull();
    });

    it('rejects when horizontal thigh or shank (Y_knee == Y_hip or Y_ankle == Y_knee)', () => {
      const lms1 = makeStandardLandmarks();
      lms1[25].y = lms1[23].y; // Left knee Y == Left hip Y
      expect(calibrateStandingBaseline(lms1, 640, 480)).toBeNull();

      const lms2 = makeStandardLandmarks();
      lms2[28].y = lms2[26].y; // Right ankle Y == Right knee Y
      expect(calibrateStandingBaseline(lms2, 640, 480)).toBeNull();
    });

    it('rejects asymmetric invalid posture where one leg is inverted and the other is valid', () => {
      const lms = makeStandardLandmarks();
      // Left leg valid, Right leg inverted
      lms[24].y = 0.8; lms[26].y = 0.5; lms[28].y = 0.2;
      expect(calibrateStandingBaseline(lms, 640, 480)).toBeNull();
    });
  });

  // =========================================================================
  // 6. Valgus Polarity Enforcement
  // =========================================================================
  describe('6. Valgus Polarity Enforcement (computeValgusDeviation)', () => {
    function getCalibratedBaseline() {
      const lms: Point2D[] = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 0.95 }));
      // W=640, H=480
      // Left leg: X=384 (x=0.60), Hip Y=192 (y=0.40), Knee Y=288 (y=0.60), Ankle Y=384 (y=0.80)
      lms[23] = { x: 384 / 640, y: 192 / 480, visibility: 0.95 };
      lms[25] = { x: 384 / 640, y: 288 / 480, visibility: 0.95 };
      lms[27] = { x: 384 / 640, y: 384 / 480, visibility: 0.95 };
      // Right leg: X=256 (x=0.40), Hip Y=192 (y=0.40), Knee Y=288 (y=0.60), Ankle Y=384 (y=0.80)
      lms[24] = { x: 256 / 640, y: 192 / 480, visibility: 0.95 };
      lms[26] = { x: 256 / 640, y: 288 / 480, visibility: 0.95 };
      lms[28] = { x: 256 / 640, y: 384 / 480, visibility: 0.95 };

      return calibrateStandingBaseline(lms, 640, 480)!;
    }

    it('Left leg medial collapse (X decrease towards midline) yields strictly positive (+)', () => {
      const baseline = getCalibratedBaseline();
      const hip: Point2D = { x: 384, y: 192, visibility: 0.95 };
      const ankle: Point2D = { x: 384, y: 384, visibility: 0.95 };
      // Medial collapse: knee moves leftwards towards body center (384 -> 350)
      const kneeMedial: Point2D = { x: 350, y: 288, visibility: 0.95 };

      const dev = computeValgusDeviation(hip, kneeMedial, ankle, baseline, 'L');
      expect(dev).not.toBeNull();
      expect(dev!).toBeGreaterThan(0.0);
    });

    it('Right leg medial collapse (X increase towards midline) yields strictly positive (+)', () => {
      const baseline = getCalibratedBaseline();
      const hip: Point2D = { x: 256, y: 192, visibility: 0.95 };
      const ankle: Point2D = { x: 256, y: 384, visibility: 0.95 };
      // Medial collapse: knee moves rightwards towards body center (256 -> 290)
      const kneeMedial: Point2D = { x: 290, y: 288, visibility: 0.95 };

      const dev = computeValgusDeviation(hip, kneeMedial, ankle, baseline, 'R');
      expect(dev).not.toBeNull();
      expect(dev!).toBeGreaterThan(0.0);
    });

    it('Outward varus deviation yields strictly negative (-) on both Left and Right legs', () => {
      const baseline = getCalibratedBaseline();

      // Left leg varus: moves outward (384 -> 410)
      const hipL: Point2D = { x: 384, y: 192, visibility: 0.95 };
      const ankleL: Point2D = { x: 384, y: 384, visibility: 0.95 };
      const kneeLVarus: Point2D = { x: 410, y: 288, visibility: 0.95 };
      const devL = computeValgusDeviation(hipL, kneeLVarus, ankleL, baseline, 'L');
      expect(devL).not.toBeNull();
      expect(devL!).toBeLessThan(0.0);

      // Right leg varus: moves outward (256 -> 230)
      const hipR: Point2D = { x: 256, y: 192, visibility: 0.95 };
      const ankleR: Point2D = { x: 256, y: 384, visibility: 0.95 };
      const kneeRVarus: Point2D = { x: 230, y: 288, visibility: 0.95 };
      const devR = computeValgusDeviation(hipR, kneeRVarus, ankleR, baseline, 'R');
      expect(devR).not.toBeNull();
      expect(devR!).toBeLessThan(0.0);
    });

    it('Neutral alignment produces exactly 0.0 without IEEE 754 negative zero (-0)', () => {
      const baseline = getCalibratedBaseline();
      const hip: Point2D = { x: 384, y: 192, visibility: 0.95 };
      const knee: Point2D = { x: 384, y: 288, visibility: 0.95 };
      const ankle: Point2D = { x: 384, y: 384, visibility: 0.95 };

      const dev = computeValgusDeviation(hip, knee, ankle, baseline, 'L');
      expect(dev).toBe(0.0);
      expect(Object.is(dev, -0)).toBe(false);
    });
  });

  // =========================================================================
  // 7. Horizontal Leg Segment Division-by-Zero Defense
  // =========================================================================
  describe('7. Horizontal Leg Segment Guard (|Y_a - Y_h| <= 1e-4)', () => {
    function getCalibratedBaseline() {
      const lms: Point2D[] = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 0.95 }));
      lms[23] = { x: 0.6, y: 0.4, visibility: 0.95 };
      lms[25] = { x: 0.6, y: 0.6, visibility: 0.95 };
      lms[27] = { x: 0.6, y: 0.8, visibility: 0.95 };
      lms[24] = { x: 0.4, y: 0.4, visibility: 0.95 };
      lms[26] = { x: 0.4, y: 0.6, visibility: 0.95 };
      lms[28] = { x: 0.4, y: 0.8, visibility: 0.95 };
      return calibrateStandingBaseline(lms, 640, 480)!;
    }

    it('returns null safely without dividing by zero when Ya == Yh', () => {
      const baseline = getCalibratedBaseline();
      const hip: Point2D = { x: 384, y: 250, visibility: 0.95 };
      const knee: Point2D = { x: 350, y: 250, visibility: 0.95 };
      const ankle: Point2D = { x: 300, y: 250, visibility: 0.95 }; // Ya == Yh == 250

      const res = computeValgusDeviation(hip, knee, ankle, baseline, 'L');
      expect(res).toBeNull();
    });

    it('returns null safely when |Ya - Yh| is within 1e-4 threshold (e.g. 0, 1e-5, 0.99e-4, 1e-4)', () => {
      const baseline = getCalibratedBaseline();
      const hip: Point2D = { x: 384, y: 250.0, visibility: 0.95 };
      const knee: Point2D = { x: 350, y: 250.0, visibility: 0.95 };

      // 1. Exactly 0 difference
      const ankleZero: Point2D = { x: 300, y: 250.0, visibility: 0.95 };
      expect(computeValgusDeviation(hip, knee, ankleZero, baseline, 'L')).toBeNull();

      // 2. Positive delta 1e-5 <= 1e-4
      const ankle1e5: Point2D = { x: 300, y: 250.0 + 1e-5, visibility: 0.95 };
      expect(computeValgusDeviation(hip, knee, ankle1e5, baseline, 'L')).toBeNull();

      // 3. Negative delta -1e-5 <= 1e-4
      const ankleNeg1e5: Point2D = { x: 300, y: 250.0 - 1e-5, visibility: 0.95 };
      expect(computeValgusDeviation(hip, knee, ankleNeg1e5, baseline, 'L')).toBeNull();

      // 4. Positive delta 0.99e-4 <= 1e-4
      const ankle099e4: Point2D = { x: 300, y: 250.0 + 0.99e-4, visibility: 0.95 };
      expect(computeValgusDeviation(hip, knee, ankle099e4, baseline, 'L')).toBeNull();

      // 5. Exact 1e-4 boundary: hip.y = 0.0, ankle.y = 1e-4
      const hipZeroY: Point2D = { x: 384, y: 0.0, visibility: 0.95 };
      const kneeZeroY: Point2D = { x: 350, y: 0.0, visibility: 0.95 };
      const ankleExact1e4: Point2D = { x: 300, y: 1e-4, visibility: 0.95 };
      expect(computeValgusDeviation(hipZeroY, kneeZeroY, ankleExact1e4, baseline, 'L')).toBeNull();
    });
  });

  // =========================================================================
  // 8. 3-Frame Sliding Median Filter Stress
  // =========================================================================
  describe('8. 3-Frame Sliding Median Filter Stress', () => {
    it('completely annihilates single-frame impulse spikes without delay', () => {
      const filter = new SlidingMedianFilter(3);
      const cleanStream = [20, 21, 20, 22, 21, 20];
      const noisyStream = [20, 21, 150, 22, 21, 20]; // 150 is a huge impulse spike at frame 3

      const outputs: number[] = [];
      for (const val of noisyStream) {
        outputs.push(filter.filter(val)!);
      }

      // Frame 1: 20
      expect(outputs[0]).toBe(20);
      // Frame 2: (20 + 21) / 2 = 20.5
      expect(outputs[1]).toBe(20.5);
      // Frame 3: buffer [20, 21, 150] -> sorted [20, 21, 150] -> median 21!
      expect(outputs[2]).toBe(21);
      // Frame 4: buffer [21, 150, 22] -> sorted [21, 22, 150] -> median 22!
      expect(outputs[3]).toBe(22);
      // Frame 5: buffer [150, 22, 21] -> sorted [21, 22, 150] -> median 22!
      expect(outputs[4]).toBe(22);
      // Frame 6: buffer [22, 21, 20] -> sorted [20, 21, 22] -> median 21!
      expect(outputs[5]).toBe(21);

      // The spike value of 150 never appears in the output!
      expect(outputs.every((v) => v < 30)).toBe(true);
    });

    it('handles alternating high-frequency noise gracefully', () => {
      const filter = new SlidingMedianFilter(3);
      // Alternating [10, 90, 10, 90, 10]
      const f1 = filter.filter(10); // 10
      const f2 = filter.filter(90); // (10+90)/2 = 50
      const f3 = filter.filter(10); // [10, 90, 10] -> median 10
      const f4 = filter.filter(90); // [90, 10, 90] -> median 90
      const f5 = filter.filter(10); // [10, 90, 10] -> median 10

      expect(f1).toBe(10);
      expect(f2).toBe(50);
      expect(f3).toBe(10);
      expect(f4).toBe(90);
      expect(f5).toBe(10);
    });

    it('resets buffer immediately on null or non-finite inputs and restarts clean', () => {
      const filter = new SlidingMedianFilter(3);
      filter.filter(50);
      filter.filter(60);
      filter.filter(70);
      expect(filter.getBuffer().length).toBe(3);

      // Dropout resets
      expect(filter.filter(null)).toBeNull();
      expect(filter.getBuffer().length).toBe(0);

      // Next frame behaves as fresh frame 1
      expect(filter.filter(100)).toBe(100);
      expect(filter.getBuffer()).toEqual([100]);

      // NaN resets
      expect(filter.filter(NaN)).toBeNull();
      expect(filter.getBuffer().length).toBe(0);

      // Infinity resets
      expect(filter.filter(Infinity)).toBeNull();
      expect(filter.getBuffer().length).toBe(0);
    });
  });

  // =========================================================================
  // 9. Exponential Moving Average Filter Stress
  // =========================================================================
  describe('9. Exponential Moving Average Filter Stress', () => {
    it('verifies step-response rise time: 0 to 100 step latency < 50ms at 30 FPS', () => {
      const alpha = 0.40;
      const ema = new ExponentialMovingAverageFilter(alpha);

      // Initial steady state at 0
      ema.filter(0);

      // Step to 100 at frame 1 (t = 33.33ms):
      // y1 = 0.40 * 100 + 0.60 * 0 = 40.0
      const y1 = ema.filter(100)!;
      expect(y1).toBeCloseTo(40.0, 2);

      // Frame 2 (t = 66.67ms):
      // y2 = 0.40 * 100 + 0.60 * 40 = 64.0
      const y2 = ema.filter(100)!;
      expect(y2).toBeCloseTo(64.0, 2);

      // Analytical verification:
      // Continuous rise time to 50%: t_50% = ln(1 - 0.5) / ln(1 - 0.40) * (1000 / 30) ms
      const theoreticalLatencyMs = (Math.log(0.5) / Math.log(1 - alpha)) * (1000.0 / 30.0);
      expect(theoreticalLatencyMs).toBeLessThan(50.0);
      expect(theoreticalLatencyMs).toBeCloseTo(45.23, 1);
    });

    it('holds filtered value during 1 or 2 missing frames, resets on 3rd missing frame', () => {
      const ema = new ExponentialMovingAverageFilter(0.40, 3, true);
      ema.filter(85.0);

      // 1st dropout: holds 85.0
      expect(ema.filter(null)).toBe(85.0);
      expect(ema.getMissingFrames()).toBe(1);

      // 2nd dropout: holds 85.0
      expect(ema.filter(null)).toBe(85.0);
      expect(ema.getMissingFrames()).toBe(2);

      // 3rd dropout: threshold reached -> returns null and resets internal state
      expect(ema.filter(null)).toBeNull();
      expect(ema.getCurrent()).toBeNull();

      // Next valid frame initializes fresh without old state pollution
      expect(ema.filter(110.0)).toBe(110.0);
      expect(ema.getCurrent()).toBe(110.0);
    });

    it('recovers without reset if valid frame arrives before 3rd missing frame', () => {
      const ema = new ExponentialMovingAverageFilter(0.40, 3, true);
      ema.filter(50.0);

      // 2 transient dropouts
      expect(ema.filter(null)).toBe(50.0);
      expect(ema.filter(null)).toBe(50.0);

      // Frame 3 arrives with valid value 70.0
      // y = 0.40 * 70.0 + 0.60 * 50.0 = 28.0 + 30.0 = 58.0
      const recovered = ema.filter(70.0);
      expect(recovered).toBeCloseTo(58.0, 2);
      expect(ema.getMissingFrames()).toBe(0);
    });

    it('immediately treats NaN and Infinity as missing frames', () => {
      const ema = new ExponentialMovingAverageFilter(0.40, 3, true);
      ema.filter(60.0);

      // NaN as dropout 1
      expect(ema.filter(NaN)).toBe(60.0);
      expect(ema.getMissingFrames()).toBe(1);

      // Infinity as dropout 2
      expect(ema.filter(Infinity)).toBe(60.0);
      expect(ema.getMissingFrames()).toBe(2);

      // -Infinity as dropout 3 -> reset!
      expect(ema.filter(-Infinity)).toBeNull();
      expect(ema.getCurrent()).toBeNull();
    });
  });

  // =========================================================================
  // 10. Deep Boundary & Architectural Stress
  // =========================================================================
  describe('10. Deep Boundary & Constructor Fallback Stress', () => {
    it('compute3DKneeFlexion handles collinear 0.0° vectors (fully folded knee) without NaN', () => {
      const knee: Point3D = { x: 0.0, y: 0.0, z: 0.0, visibility: 0.99 };
      // Both hip and ankle in the exact same direction along Y axis
      const hip: Point3D = { x: 0.0, y: 0.45, z: 0.0, visibility: 0.99 };
      const ankle: Point3D = { x: 0.0, y: 0.45, z: 0.0, visibility: 0.99 };

      const angle = compute3DKneeFlexion(hip, knee, ankle);
      expect(angle).not.toBeNull();
      expect(angle!).toBeCloseTo(0.0, 2);
    });

    it('SlidingMedianFilter robustly falls back to default windowSize 3 on invalid constructor arguments', () => {
      const invalidFilters = [
        new SlidingMedianFilter(0),
        new SlidingMedianFilter(-5),
        new SlidingMedianFilter(NaN),
        new SlidingMedianFilter(Infinity),
      ];

      for (const f of invalidFilters) {
        expect(f.windowSize).toBe(3);
        // Validates proper median calculation with default window 3
        f.filter(10);
        f.filter(80);
        expect(f.filter(15)).toBe(15);
      }
    });

    it('ExponentialMovingAverageFilter robustly falls back to defaults on invalid constructor arguments', () => {
      const invalidFilters = [
        new ExponentialMovingAverageFilter(0),
        new ExponentialMovingAverageFilter(-0.5),
        new ExponentialMovingAverageFilter(1.5),
        new ExponentialMovingAverageFilter(NaN),
      ];

      for (const f of invalidFilters) {
        expect(f.alpha).toBe(0.40);
        expect(f.filter(100)).toBe(100);
      }
    });

    it('ExponentialMovingAverageFilter with holdOnMissing = false returns null immediately on dropout', () => {
      const emaNoHold = new ExponentialMovingAverageFilter(0.40, 3, false);
      emaNoHold.filter(100);
      expect(emaNoHold.getCurrent()).toBe(100);

      // Dropout 1: does not hold, returns null
      expect(emaNoHold.filter(null)).toBeNull();
      expect(emaNoHold.getMissingFrames()).toBe(1);

      // Frame recovers
      expect(emaNoHold.filter(150)).toBeCloseTo(120, 1);
    });

    it('calibrateStandingBaseline safely rejects malformed landmark arrays', () => {
      expect(calibrateStandingBaseline(null as any, 640, 480)).toBeNull();
      expect(calibrateStandingBaseline(undefined as any, 640, 480)).toBeNull();
      expect(calibrateStandingBaseline([] as any, 640, 480)).toBeNull();
      expect(calibrateStandingBaseline(new Array(20) as any, 640, 480)).toBeNull(); // < 29
    });
  });
});

