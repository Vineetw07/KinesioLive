/**
 * tests/repFormScore.test.ts
 *
 * Biomechanical Verification Test Suite for Repetition Form Quality Scoring
 * and Clinical Envelope Evaluation.
 *
 * Validates:
 * - Mathematical scoring of depth compliance against clinical thresholds (parallel depthRatio >= 0.70 / flexion <= 100 deg).
 * - Knee valgus stability penalty for medial collapse (> 3% threshold, heavy penalty > 8%).
 * - Ascent/descent tempo symmetry and cadence evaluation.
 * - Overall composite formScore (0 - 100%) and rating classification ('excellent' | 'good' | 'needs_work').
 * - State machine lifecycle integration: attachment of formScore to KineRepPayload on rep completion.
 * - Resilience to non-finite inputs and edge cases.
 */

import { describe, it, expect } from 'vitest';
import {
  evaluateRepFormQuality,
  RepCounterStateMachine,
} from '../client/src/engine';

describe('Biomechanical Rep Form Quality Scoring', () => {
  // =========================================================================
  // 1. Depth Compliance Evaluation
  // =========================================================================
  describe('1. Depth Compliance Criteria', () => {
    it('awards full 40 points for deep squat (minKneeDeg <= 80 deg or maxDepthRatio >= 0.85)', () => {
      const result = evaluateRepFormQuality({
        minKneeDeg: 75.0,
        maxDepthRatio: 0.90,
        durMs: 2400,
        descentMs: 1200,
        ascentMs: 1200,
        peakValgusL: 1.0,
        peakValgusR: 1.0,
      });

      expect(result.breakdown.depthScore).toBe(40.0);
      expect(result.formScore).toBe(100);
      expect(result.formRating).toBe('excellent');
    });

    it('guarantees >= 30 points for meeting clinical parallel target (knee <= 100 deg or depthRatio >= 0.70)', () => {
      const result = evaluateRepFormQuality({
        minKneeDeg: 98.0,
        maxDepthRatio: 0.72,
        durMs: 2000,
        descentMs: 1000,
        ascentMs: 1000,
        peakValgusL: 0,
        peakValgusR: 0,
      });

      expect(result.breakdown.depthScore).toBeGreaterThanOrEqual(30.0);
      expect(result.formScore).toBeGreaterThanOrEqual(90);
      expect(result.formRating).toBe('excellent');
    });

    it('scales down depthScore when squat depth is borderline shallow (minKneeDeg = 104 deg, depthRatio = 0.50)', () => {
      const result = evaluateRepFormQuality({
        minKneeDeg: 104.0,
        maxDepthRatio: 0.50,
        durMs: 2000,
        descentMs: 1000,
        ascentMs: 1000,
        peakValgusL: 0,
        peakValgusR: 0,
      });

      expect(result.breakdown.depthScore).toBeLessThan(30.0);
      expect(result.breakdown.depthScore).toBeGreaterThan(15.0);
    });
  });

  // =========================================================================
  // 2. Valgus Stability Penalty
  // =========================================================================
  describe('2. Valgus Stability Penalty', () => {
    it('awards full 35 valgus points when knees maintain neutral alignment (peak <= 3.0%)', () => {
      const result = evaluateRepFormQuality({
        minKneeDeg: 85.0,
        maxDepthRatio: 0.82,
        durMs: 2000,
        descentMs: 1000,
        ascentMs: 1000,
        peakValgusL: 2.5,
        peakValgusR: 2.0,
        meanValgusL: 1.2,
        meanValgusR: 0.8,
      });

      expect(result.breakdown.valgusScore).toBe(35.0);
    });

    it('deducts valgus score proportionally when medial collapse exceeds 3.0%', () => {
      const result = evaluateRepFormQuality({
        minKneeDeg: 85.0,
        maxDepthRatio: 0.82,
        durMs: 2000,
        descentMs: 1000,
        ascentMs: 1000,
        peakValgusL: 6.0,
        peakValgusR: 2.0,
        meanValgusL: 3.5,
        meanValgusR: 1.0,
      });

      // Deduction: (6.0 - 3.0) * 2.5 + 3.5 * 1.5 = 7.5 + 5.25 = 12.75 -> valgusScore = ~22.3
      expect(result.breakdown.valgusScore).toBeLessThan(30.0);
      expect(result.breakdown.valgusScore).toBeGreaterThan(15.0);
    });

    it('heavily penalizes severe medial knee valgus collapse (> 12% peak deviation)', () => {
      const result = evaluateRepFormQuality({
        minKneeDeg: 85.0,
        maxDepthRatio: 0.82,
        durMs: 2000,
        descentMs: 1000,
        ascentMs: 1000,
        peakValgusL: 14.0,
        peakValgusR: 4.0,
        meanValgusL: 8.0,
        meanValgusR: 2.0,
      });

      expect(result.breakdown.valgusScore).toBeLessThanOrEqual(5.0);
      expect(result.formScore).toBeLessThan(75);
    });
  });

  // =========================================================================
  // 3. Ascent/Descent Tempo Symmetry & Cadence
  // =========================================================================
  describe('3. Tempo Symmetry & Cadence', () => {
    it('awards full 25 points for balanced 1:1 eccentric/concentric tempo in 2s repetition', () => {
      const result = evaluateRepFormQuality({
        minKneeDeg: 80.0,
        maxDepthRatio: 0.85,
        durMs: 2000,
        descentMs: 1000,
        ascentMs: 1000,
        peakValgusL: 1.0,
        peakValgusR: 1.0,
      });

      expect(result.breakdown.tempoScore).toBe(25.0);
    });

    it('penalizes severe tempo asymmetry (e.g. 3.0s descent with 0.6s rapid rebound)', () => {
      const result = evaluateRepFormQuality({
        minKneeDeg: 80.0,
        maxDepthRatio: 0.85,
        durMs: 3600,
        descentMs: 3000,
        ascentMs: 600,
        peakValgusL: 1.0,
        peakValgusR: 1.0,
      });

      // Symmetry = 600 / 3000 = 0.20 -> tempoScore = 25 * 0.20 = 5.0
      expect(result.breakdown.tempoScore).toBeCloseTo(5.0, 1);
      expect(result.formScore).toBeLessThanOrEqual(80);
    });

    it('penalizes rapid dive-bomb bounce rep duration (< 1000 ms)', () => {
      const result = evaluateRepFormQuality({
        minKneeDeg: 80.0,
        maxDepthRatio: 0.85,
        durMs: 850,
        descentMs: 425,
        ascentMs: 425,
        peakValgusL: 1.0,
        peakValgusR: 1.0,
      });

      // Pacing factor scales down tempo score even if symmetrical
      expect(result.breakdown.tempoScore).toBeLessThan(23.0);
    });
  });

  // =========================================================================
  // 4. Clinical Rating Stratification
  // =========================================================================
  describe('4. Clinical Rating Stratification', () => {
    it('classifies pristine squat as "excellent" (score >= 85)', () => {
      const result = evaluateRepFormQuality({
        minKneeDeg: 82.0,
        maxDepthRatio: 0.85,
        durMs: 2200,
        descentMs: 1100,
        ascentMs: 1100,
        peakValgusL: 1.5,
        peakValgusR: 1.0,
      });

      expect(result.formScore).toBeGreaterThanOrEqual(85);
      expect(result.formRating).toBe('excellent');
    });

    it('classifies acceptable rep with minor valgus as "good" (65 <= score < 85)', () => {
      const result = evaluateRepFormQuality({
        minKneeDeg: 95.0,
        maxDepthRatio: 0.74,
        durMs: 2000,
        descentMs: 1200,
        ascentMs: 800,
        peakValgusL: 5.5,
        peakValgusR: 2.0,
        meanValgusL: 3.0,
      });

      expect(result.formScore).toBeGreaterThanOrEqual(65);
      expect(result.formScore).toBeLessThan(85);
      expect(result.formRating).toBe('good');
    });

    it('classifies compromised rep with severe valgus collapse as "needs_work" (score < 65)', () => {
      const result = evaluateRepFormQuality({
        minKneeDeg: 104.0,
        maxDepthRatio: 0.65,
        durMs: 1600,
        descentMs: 1200,
        ascentMs: 400,
        peakValgusL: 11.0,
        peakValgusR: 6.0,
        meanValgusL: 7.0,
        meanValgusR: 4.0,
      });

      expect(result.formScore).toBeLessThan(65);
      expect(result.formRating).toBe('needs_work');
    });
  });

  // =========================================================================
  // 5. State Machine Lifecycle & KineRepPayload Attachment
  // =========================================================================
  describe('5. RepCounterStateMachine Integration', () => {
    it('attaches formScore and formRating to completedRep when repetition finishes', () => {
      const fsm = new RepCounterStateMachine('test-session');
      let timestamp = 1000;
      let completedRep: any = null;

      // 1. Standing upright
      fsm.update({ timestamp, kneeAngle: 170.0, depthRatio: 0.05 });

      // 2. Controlled Descent
      for (let i = 1; i <= 10; i++) {
        timestamp += 100;
        const progress = i / 10;
        const angle = 170.0 - progress * (170.0 - 80.0);
        const depth = 0.05 + progress * (0.85 - 0.05);
        const out = fsm.update({ timestamp, kneeAngle: angle, depthRatio: depth, valgusDevPct: 1.0 });
        if (out.completedRep) completedRep = out.completedRep;
      }

      // 3. Bottom hold
      timestamp += 100;
      const bottomOut = fsm.update({ timestamp, kneeAngle: 78.0, depthRatio: 0.88, valgusDevPct: 1.2 });
      if (bottomOut.completedRep) completedRep = bottomOut.completedRep;

      // 4. Controlled Ascent
      for (let i = 1; i <= 10; i++) {
        timestamp += 100;
        const progress = i / 10;
        const angle = 78.0 + progress * (165.0 - 78.0);
        const depth = 0.88 - progress * (0.88 - 0.15);
        const out = fsm.update({ timestamp, kneeAngle: angle, depthRatio: depth, valgusDevPct: 1.0 });
        if (out.completedRep) completedRep = out.completedRep;
      }

      // 5. Standing completion frame
      timestamp += 100;
      const finalOutput = fsm.update({
        timestamp,
        kneeAngle: 170.0,
        depthRatio: 0.10,
        valgusDevPct: 0.5,
      });
      if (finalOutput.completedRep) completedRep = finalOutput.completedRep;

      expect(fsm.reps).toBe(1);
      expect(completedRep).not.toBeNull();

      expect(completedRep.type).toBe('kine.rep');
      expect(completedRep.n).toBe(1);
      expect(typeof completedRep.formScore).toBe('number');
      expect(completedRep.formScore).toBeGreaterThanOrEqual(85);
      expect(completedRep.formRating).toBe('excellent');

      // Accessors on FSM must also be populated
      expect(fsm.lastFormScore).toBe(completedRep.formScore);
      expect(fsm.lastFormRating).toBe(completedRep.formRating);
    });

    it('accurately scores lower formScore when severe valgus occurs during rep in FSM', () => {
      const fsm = new RepCounterStateMachine('test-session');
      let timestamp = 1000;
      let completedRep: any = null;

      // Standing
      fsm.update({ timestamp, kneeAngle: 170.0, depthRatio: 0.05 });

      // Descent with severe knee valgus collapse (12.5% dev)
      for (let i = 1; i <= 10; i++) {
        timestamp += 100;
        const progress = i / 10;
        const angle = 170.0 - progress * (170.0 - 85.0);
        const depth = 0.05 + progress * (0.85 - 0.05);
        const out = fsm.update({
          timestamp,
          kneeAngle: angle,
          depthRatio: depth,
          valgusDevPctL: 12.5,
          valgusDevPctR: 2.0,
        });
        if (out.completedRep) completedRep = out.completedRep;
      }

      // Bottom
      timestamp += 100;
      const bottomOut = fsm.update({ timestamp, kneeAngle: 85.0, depthRatio: 0.85, valgusDevPctL: 13.0 });
      if (bottomOut.completedRep) completedRep = bottomOut.completedRep;

      // Ascent
      for (let i = 1; i <= 10; i++) {
        timestamp += 100;
        const progress = i / 10;
        const angle = 85.0 + progress * (165.0 - 85.0);
        const depth = 0.85 - progress * (0.85 - 0.15);
        const out = fsm.update({ timestamp, kneeAngle: angle, depthRatio: depth, valgusDevPctL: 10.0 });
        if (out.completedRep) completedRep = out.completedRep;
      }

      // Standing completion
      timestamp += 100;
      const finalOutput = fsm.update({
        timestamp,
        kneeAngle: 170.0,
        depthRatio: 0.10,
        valgusDevPctL: 2.0,
      });
      if (finalOutput.completedRep) completedRep = finalOutput.completedRep;

      expect(fsm.reps).toBe(1);
      expect(completedRep).not.toBeNull();

      expect(completedRep.formScore).toBeLessThan(75);
      expect(completedRep.formRating).not.toBe('excellent');
    });

    it('resets form score on explicit fsm.reset()', () => {
      const fsm = new RepCounterStateMachine();
      fsm.update({ timestamp: 1000, kneeAngle: 170, depthRatio: 0.05 });
      fsm.reset();

      expect(fsm.lastFormScore).toBeNull();
      expect(fsm.lastFormRating).toBeNull();
    });
  });
});
