/**
 * tests/repCounterAdversarial.test.ts
 *
 * Adversarial stress-test suite for Rep Counter FSM and Valgus Alert Detector (D3.3 / D3.4).
 * Rigorously verifies all 7 empirical challenge criteria:
 * 1. FSM boundary hysteresis (rapid oscillations around 150° and 100°)
 * 2. Shallow squat reversal (consecutive reversals at 120°, 130°, 140° without deadlock)
 * 3. Rapid bounce rejection (600ms, 700ms, 799ms rejected vs 801ms accepted)
 * 4. Valgus alert cooldown boundary (t=0 fires, t=2000 suppressed, t=3999 suppressed, t=4001 fires)
 * 5. Bilateral alert independence (Left at t=0 fires, Right at t=500 fires despite Left cooldown)
 * 6. Valgus phase suppression (strictly suppressed in standing and ascending even if >8%)
 * 7. Tracking dropout handling (500ms dropout mid-rep resumes; 1200ms dropout resets to standing)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { RepCounterStateMachine, type RepCounterOutput } from '../client/src/engine/repCounter';

describe('Adversarial Stress Test Suite: Rep Counter FSM & Valgus Detector', () => {
  let counter: RepCounterStateMachine;

  beforeEach(() => {
    counter = new RepCounterStateMachine('test-session-adversarial');
  });

  describe('1. FSM Boundary Hysteresis & Rapid Oscillations', () => {
    it('survives rapid oscillations around 150° descent threshold without thrashing or dropping reps', () => {
      let t = 1000;
      // Start in standing
      let out = counter.update({ timestamp: t, kneeDeg: 165, depthRatio: 0.10, visibility: 1.0 });
      expect(out.phase).toBe('standing');

      // Rapidly oscillate around 150° (149° -> 151° -> 148° -> 152° ...)
      // Once it dips below 150°, it enters descending.
      // Small oscillations (+/-3°) must NOT trigger reversal (reversal requires +10° and depthRatio decreasing).
      const oscAngles = [149, 151, 148, 152, 149, 151, 147, 152, 148, 150];
      for (const angle of oscAngles) {
        t += 33;
        out = counter.update({ timestamp: t, kneeDeg: angle, depthRatio: 0.27, visibility: 1.0 });
        expect(out.phase).toBe('descending');
      }

      // Now continue full valid squat to bottom (80°) and return to standing (165°)
      const descent = [140, 130, 115, 100, 85, 80];
      for (const angle of descent) {
        t += 50;
        out = counter.update({ timestamp: t, kneeDeg: angle, depthRatio: 0.95, visibility: 1.0 });
      }
      expect(out.phase).toBe('bottom');

      // Rising out of bottom: 95° is still <= 110°, so it remains in bottom
      t += 50;
      out = counter.update({ timestamp: t, kneeDeg: 95, depthRatio: 0.70, visibility: 1.0 });
      expect(out.phase).toBe('bottom');

      // Now at 112° (> 110°) and depthRatio decreasing, it transitions to ascending
      const ascent = [112, 130, 145, 155];
      for (const angle of ascent) {
        t += 100;
        out = counter.update({ timestamp: t, kneeDeg: angle, depthRatio: 0.40, visibility: 1.0 });
        expect(out.phase).toBe('ascending');
      }

      t += 50;
      out = counter.update({ timestamp: t, kneeDeg: 165, depthRatio: 0.10, visibility: 1.0 });
      expect(out.phase).toBe('standing');
      expect(out.reps).toBe(1);
      expect(out.completedRep).not.toBeNull();
      expect(out.completedRep?.depth).toBe('deep');
    });

    it('survives rapid oscillations around 100° bottom threshold without thrashing between descending and bottom', () => {
      let t = 1000;
      counter.update({ timestamp: t, kneeDeg: 165, depthRatio: 0.10, visibility: 1.0 });

      // Descend toward bottom threshold
      const descent = [140, 120, 105];
      for (const angle of descent) {
        t += 50;
        counter.update({ timestamp: t, kneeDeg: angle, depthRatio: 0.70, visibility: 1.0 });
      }
      expect(counter.phase).toBe('descending');

      // Hit bottom at 99°
      t += 33;
      let out = counter.update({ timestamp: t, kneeDeg: 99, depthRatio: 0.86, visibility: 1.0 });
      expect(out.phase).toBe('bottom');

      // Oscillate rapidly across 100° (99 -> 102 -> 98 -> 103 -> 99 -> 104)
      // Since bottom -> ascending requires knee > 110°, it must remain locked in bottom!
      const oscBottom = [102, 98, 103, 99, 104, 98, 105, 99];
      for (const angle of oscBottom) {
        t += 33;
        out = counter.update({ timestamp: t, kneeDeg: angle, depthRatio: 0.86, visibility: 1.0 });
        expect(out.phase).toBe('bottom');
      }

      // Deepen to 75°
      t += 100;
      counter.update({ timestamp: t, kneeDeg: 75, depthRatio: 1.05, visibility: 1.0 });
      expect(counter.phase).toBe('bottom');

      // Ascend through 115° (> 110°) with decreasing depthRatio
      t += 200;
      out = counter.update({ timestamp: t, kneeDeg: 115, depthRatio: 0.50, visibility: 1.0 });
      expect(out.phase).toBe('ascending');

      // Complete rep: ensure duration >= 800 ms (t was at ~1750, start was at 1050 -> 700ms, add 300ms)
      t += 300;
      out = counter.update({ timestamp: t, kneeDeg: 165, depthRatio: 0.10, visibility: 1.0 });
      expect(out.phase).toBe('standing');
      expect(out.reps).toBe(1);
    });
    it('documents requirement for depthRatio tracking during ascent transitions', () => {
      // In accordance with R3: "Reversal detected (theta_knee increases by > 10 deg and depthRatio decreases)"
      // and "theta_knee > 110 deg AND depthRatio is decreasing"
      // If depthRatio is constant (e.g. omitted 0.0), ascending transition requires depthRatio to decrease below maxDepthRatio.
      const c = new RepCounterStateMachine('test-depth-requirement');
      c.update({ timestamp: 1000, kneeDeg: 145, depthRatio: 0.35, visibility: 1.0 });
      c.update({ timestamp: 1200, kneeDeg: 80, depthRatio: 0.95, visibility: 1.0 });
      expect(c.phase).toBe('bottom');

      // Ascent with depthRatio decreasing (0.60 < 0.95)
      const f3 = c.update({ timestamp: 1500, kneeDeg: 120, depthRatio: 0.60, visibility: 1.0 });
      expect(f3.phase).toBe('ascending');

      // Full return to standing
      const f4 = c.update({ timestamp: 2000, kneeDeg: 170, depthRatio: 0.10, visibility: 1.0 });
      expect(f4.phase).toBe('standing');
      expect(c.reps).toBe(1);
    });
  });

  describe('2. Shallow Squat Reversal (Deadlock Prevention)', () => {
    it('handles consecutive shallow squats reversing at 120°, 130°, and 140° without deadlock and rep count stays 0', () => {
      let t = 1000;

      // Shallow Squat 1: Reversal at 120°
      counter.update({ timestamp: t, kneeDeg: 165, depthRatio: 0.10, visibility: 1.0 });
      t += 50;
      counter.update({ timestamp: t, kneeDeg: 145, depthRatio: 0.30, visibility: 1.0 });
      expect(counter.phase).toBe('descending');
      t += 50;
      counter.update({ timestamp: t, kneeDeg: 120, depthRatio: 0.60, visibility: 1.0 });
      expect(counter.phase).toBe('descending');
      // Reversal: knee increases by > 10° (132° > 120 + 10) and depthRatio decreases (0.45 < 0.60)
      t += 50;
      let out = counter.update({ timestamp: t, kneeDeg: 132, depthRatio: 0.45, visibility: 1.0 });
      expect(out.phase).toBe('ascending');
      // Return to standing
      t += 50;
      out = counter.update({ timestamp: t, kneeDeg: 165, depthRatio: 0.10, visibility: 1.0 });
      expect(out.phase).toBe('standing');
      expect(out.reps).toBe(0);
      expect(out.isShallow).toBe(true);

      // Shallow Squat 2: Reversal at 130°
      t += 100;
      counter.update({ timestamp: t, kneeDeg: 145, depthRatio: 0.30, visibility: 1.0 });
      expect(counter.phase).toBe('descending');
      t += 50;
      counter.update({ timestamp: t, kneeDeg: 130, depthRatio: 0.50, visibility: 1.0 });
      expect(counter.phase).toBe('descending');
      // Reversal: 142° (> 130 + 10) with depthRatio 0.35 (< 0.50)
      t += 50;
      out = counter.update({ timestamp: t, kneeDeg: 142, depthRatio: 0.35, visibility: 1.0 });
      expect(out.phase).toBe('ascending');
      // Return to standing
      t += 50;
      out = counter.update({ timestamp: t, kneeDeg: 165, depthRatio: 0.10, visibility: 1.0 });
      expect(out.phase).toBe('standing');
      expect(out.reps).toBe(0);
      expect(out.isShallow).toBe(true);

      // Shallow Squat 3: Reversal at 140°
      t += 100;
      counter.update({ timestamp: t, kneeDeg: 145, depthRatio: 0.30, visibility: 1.0 });
      expect(counter.phase).toBe('descending');
      t += 50;
      counter.update({ timestamp: t, kneeDeg: 140, depthRatio: 0.40, visibility: 1.0 });
      expect(counter.phase).toBe('descending');
      // Reversal: 152° (> 140 + 10) with depthRatio 0.25 (< 0.40)
      t += 50;
      out = counter.update({ timestamp: t, kneeDeg: 152, depthRatio: 0.25, visibility: 1.0 });
      expect(out.phase).toBe('ascending');
      // Return to standing
      t += 50;
      out = counter.update({ timestamp: t, kneeDeg: 165, depthRatio: 0.10, visibility: 1.0 });
      expect(out.phase).toBe('standing');
      expect(out.reps).toBe(0);
      expect(out.isShallow).toBe(true);

      // Now verify FSM is NOT deadlocked: perform 1 full valid squat
      t += 100;
      counter.update({ timestamp: t, kneeDeg: 140, depthRatio: 0.35, visibility: 1.0 });
      t += 200;
      counter.update({ timestamp: t, kneeDeg: 80, depthRatio: 1.00, visibility: 1.0 });
      t += 200;
      counter.update({ timestamp: t, kneeDeg: 115, depthRatio: 0.50, visibility: 1.0 });
      t += 500;
      out = counter.update({ timestamp: t, kneeDeg: 165, depthRatio: 0.10, visibility: 1.0 });
      expect(out.phase).toBe('standing');
      expect(out.reps).toBe(1);
      expect(out.isShallow).toBe(false);
    });
  });

  describe('3. Rapid Bounce vs Valid Duration Boundary', () => {
    it('rejects squats completing in 600ms, 700ms, and 799ms (reps = 0) vs accepting 801ms (reps = 1)', () => {
      // Bounce A: 600ms duration
      let tStart = 1000;
      counter.update({ timestamp: tStart, kneeDeg: 145, depthRatio: 0.30, visibility: 1.0 }); // start descent
      counter.update({ timestamp: tStart + 200, kneeDeg: 80, depthRatio: 1.00, visibility: 1.0 }); // bottom
      counter.update({ timestamp: tStart + 400, kneeDeg: 115, depthRatio: 0.50, visibility: 1.0 }); // ascending
      let out = counter.update({ timestamp: tStart + 600, kneeDeg: 165, depthRatio: 0.10, visibility: 1.0 }); // standing
      expect(out.phase).toBe('standing');
      expect(out.reps).toBe(0);
      expect(out.isBounce).toBe(true);
      expect(out.completedRep).toBeNull();

      // Bounce B: 700ms duration
      tStart = 2000;
      counter.update({ timestamp: tStart, kneeDeg: 145, depthRatio: 0.30, visibility: 1.0 });
      counter.update({ timestamp: tStart + 250, kneeDeg: 80, depthRatio: 1.00, visibility: 1.0 });
      counter.update({ timestamp: tStart + 500, kneeDeg: 115, depthRatio: 0.50, visibility: 1.0 });
      out = counter.update({ timestamp: tStart + 700, kneeDeg: 165, depthRatio: 0.10, visibility: 1.0 });
      expect(out.phase).toBe('standing');
      expect(out.reps).toBe(0);
      expect(out.isBounce).toBe(true);
      expect(out.completedRep).toBeNull();

      // Bounce C: 799ms duration (strictly < 800ms threshold)
      tStart = 3000;
      counter.update({ timestamp: tStart, kneeDeg: 145, depthRatio: 0.30, visibility: 1.0 });
      counter.update({ timestamp: tStart + 300, kneeDeg: 80, depthRatio: 1.00, visibility: 1.0 });
      counter.update({ timestamp: tStart + 600, kneeDeg: 115, depthRatio: 0.50, visibility: 1.0 });
      out = counter.update({ timestamp: tStart + 799, kneeDeg: 165, depthRatio: 0.10, visibility: 1.0 });
      expect(out.phase).toBe('standing');
      expect(out.reps).toBe(0);
      expect(out.isBounce).toBe(true);
      expect(out.completedRep).toBeNull();

      // Valid D: 801ms duration (>= 800ms threshold)
      tStart = 4000;
      counter.update({ timestamp: tStart, kneeDeg: 145, depthRatio: 0.30, visibility: 1.0 });
      counter.update({ timestamp: tStart + 300, kneeDeg: 80, depthRatio: 1.00, visibility: 1.0 });
      counter.update({ timestamp: tStart + 600, kneeDeg: 115, depthRatio: 0.50, visibility: 1.0 });
      out = counter.update({ timestamp: tStart + 801, kneeDeg: 165, depthRatio: 0.10, visibility: 1.0 });
      expect(out.phase).toBe('standing');
      expect(out.reps).toBe(1);
      expect(out.isBounce).toBe(false);
      expect(out.completedRep).not.toBeNull();
      expect(out.completedRep?.durMs).toBe(801);
      expect(out.completedRep?.tempo).toBe('fast'); // 801 < 1200ms -> fast
    });
  });

  describe('4. Valgus Alert Cooldown Boundary Verification', () => {
    it('fires Left alert at t=0, suppresses at t=2000 and t=3999, and fires again at t=4001', () => {
      // Enter descending
      counter.update({ timestamp: -100, kneeDeg: 145, depthRatio: 0.30, visibility: 1.0 });

      // Frame 1 & 2 leading up to t=0
      counter.update({ timestamp: -66, kneeDeg: 130, depthRatio: 0.50, valgusDevPctL: 12.0, visibility: 1.0 });
      counter.update({ timestamp: -33, kneeDeg: 125, depthRatio: 0.55, valgusDevPctL: 12.0, visibility: 1.0 });

      // Frame 3 at t=0: exactly 3 consecutive frames with > 8.0% deviation -> FIRES!
      let out = counter.update({ timestamp: 0, kneeDeg: 120, depthRatio: 0.60, valgusDevPctL: 12.0, visibility: 1.0 });
      expect(out.alerts.length).toBe(1);
      expect(out.alerts[0].side).toBe('L');
      expect(out.alerts[0].t).toBe(0);

      // Test at t=2000ms: continuous valgus deviation -> must be SUPPRESSED by 4000ms cooldown
      out = counter.update({ timestamp: 2000, kneeDeg: 115, depthRatio: 0.65, valgusDevPctL: 12.0, visibility: 1.0 });
      expect(out.alerts.length).toBe(0);

      // Test at t=3999ms: 3999ms < 4000ms cooldown -> must be SUPPRESSED
      out = counter.update({ timestamp: 3999, kneeDeg: 110, depthRatio: 0.70, valgusDevPctL: 12.0, visibility: 1.0 });
      expect(out.alerts.length).toBe(0);

      // Test at t=4001ms: 4001ms >= 4000ms cooldown -> FIRES!
      out = counter.update({ timestamp: 4001, kneeDeg: 105, depthRatio: 0.75, valgusDevPctL: 12.0, visibility: 1.0 });
      expect(out.alerts.length).toBe(1);
      expect(out.alerts[0].side).toBe('L');
      expect(out.alerts[0].t).toBe(4001);
      expect(out.alerts[0].value).toBe(12.0);
    });
  });

  describe('5. Bilateral Alert Independence', () => {
    it('fires Right alert at t=500ms even though Left alert is on cooldown from t=0ms', () => {
      counter.update({ timestamp: -100, kneeDeg: 145, depthRatio: 0.30, visibility: 1.0 });

      // Trigger Left alert at t=0 (frames at -60, -30, 0)
      counter.update({ timestamp: -60, kneeDeg: 130, depthRatio: 0.50, valgusDevPctL: 10.0, visibility: 1.0 });
      counter.update({ timestamp: -30, kneeDeg: 125, depthRatio: 0.55, valgusDevPctL: 10.0, visibility: 1.0 });
      let out = counter.update({ timestamp: 0, kneeDeg: 120, depthRatio: 0.60, valgusDevPctL: 10.0, visibility: 1.0 });
      expect(out.alerts.length).toBe(1);
      expect(out.alerts[0].side).toBe('L');

      // Build 3 consecutive Right valgus frames at t=440, 470, 500
      counter.update({ timestamp: 440, kneeDeg: 115, depthRatio: 0.65, valgusDevPctR: 11.5, visibility: 1.0 });
      counter.update({ timestamp: 470, kneeDeg: 110, depthRatio: 0.70, valgusDevPctR: 11.5, visibility: 1.0 });

      // Frame at t=500ms: Right leg meets criteria; Left leg is also given high valgus (should be blocked)
      out = counter.update({
        timestamp: 500,
        kneeDeg: 105,
        depthRatio: 0.75,
        valgusDevPctL: 15.0,
        valgusDevPctR: 11.5,
        visibility: 1.0,
      });

      // Right alert MUST fire, Left alert MUST NOT fire
      expect(out.alerts.length).toBe(1);
      expect(out.alerts[0].side).toBe('R');
      expect(out.alerts[0].t).toBe(500);
      expect(out.alerts[0].value).toBe(11.5);
    });
  });

  describe('6. Valgus Phase Suppression (Standing & Ascending)', () => {
    it('strictly suppresses valgus alerts during standing phase even if deviation is extreme (> 8%)', () => {
      // 10 consecutive frames in standing with valgus = 25%
      for (let t = 100; t <= 400; t += 33) {
        const out = counter.update({
          timestamp: t,
          kneeDeg: 170,
          depthRatio: 0.05,
          valgusDevPctL: 25.0,
          valgusDevPctR: 25.0,
          visibility: 1.0,
        });
        expect(out.phase).toBe('standing');
        expect(out.alerts.length).toBe(0);
      }
    });

    it('strictly suppresses valgus alerts during ascending phase even if deviation is extreme (> 8%)', () => {
      let t = 1000;
      // Normal descent to bottom
      counter.update({ timestamp: t, kneeDeg: 145, depthRatio: 0.30, visibility: 1.0 });
      t += 100;
      counter.update({ timestamp: t, kneeDeg: 95, depthRatio: 0.90, visibility: 1.0 }); // bottom
      expect(counter.phase).toBe('bottom');

      // Transition to ascending
      t += 50;
      let out = counter.update({ timestamp: t, kneeDeg: 115, depthRatio: 0.60, visibility: 1.0 });
      expect(out.phase).toBe('ascending');

      // 10 consecutive ascending frames with extreme valgus (25%)
      const ascendingAngles = [120, 125, 130, 135, 140, 145, 150, 155];
      for (const angle of ascendingAngles) {
        t += 33;
        out = counter.update({
          timestamp: t,
          kneeDeg: angle,
          depthRatio: 0.40,
          valgusDevPctL: 25.0,
          valgusDevPctR: 25.0,
          visibility: 1.0,
        });
        expect(out.phase).toBe('ascending');
        expect(out.alerts.length).toBe(0);
      }
    });
  });

  describe('7. Tracking Dropout Handling (500ms Resume vs 1200ms Reset)', () => {
    it('resumes repetition after transient dropout (500ms < 1000ms threshold)', () => {
      let t = 1000;
      // Descending at t=1000
      counter.update({ timestamp: t, kneeDeg: 140, depthRatio: 0.40, visibility: 1.0 });
      expect(counter.phase).toBe('descending');

      // Tracking dropout begins at t=1100
      t = 1100;
      let out = counter.update({ timestamp: t, visibility: 0.30 });
      expect(out.phase).toBe('lost');

      // Dropout persists until t=1600 (500ms duration)
      for (let dt = 1200; dt < 1600; dt += 100) {
        out = counter.update({ timestamp: dt, visibility: 0.20 });
        expect(out.phase).toBe('lost');
      }

      // Tracking restored at t=1600 with user still bent at 125°
      t = 1600;
      out = counter.update({ timestamp: t, kneeDeg: 125, depthRatio: 0.55, visibility: 1.0 });
      expect(out.phase).toBe('descending'); // Cleanly resumed!

      // Complete rep: bottom -> ascending -> standing
      t += 200;
      counter.update({ timestamp: t, kneeDeg: 80, depthRatio: 1.00, visibility: 1.0 });
      t += 200;
      counter.update({ timestamp: t, kneeDeg: 115, depthRatio: 0.50, visibility: 1.0 });
      t += 300;
      out = counter.update({ timestamp: t, kneeDeg: 165, depthRatio: 0.10, visibility: 1.0 });
      expect(out.phase).toBe('standing');
      expect(out.reps).toBe(1);
    });

    it('resets repetition to standing after extended dropout (1200ms >= 1000ms threshold) and requires upright before next descent', () => {
      let t = 1000;
      counter.update({ timestamp: t, kneeDeg: 140, depthRatio: 0.40, visibility: 1.0 });
      expect(counter.phase).toBe('descending');

      // Tracking dropout begins at t=1100
      t = 1100;
      let out = counter.update({ timestamp: t, visibility: 0.20 });
      expect(out.phase).toBe('lost');

      // Extended dropout until t=2300 (1200ms duration)
      t = 2300;
      out = counter.update({ timestamp: t, kneeDeg: 125, depthRatio: 0.55, visibility: 1.0 });
      // Reset to standing because dropout was >= 1000ms
      expect(out.phase).toBe('standing');
      expect(out.reps).toBe(0);

      // Since user is still bent (125°), FSM must require upright standing before initiating new descent
      t += 50;
      out = counter.update({ timestamp: t, kneeDeg: 120, depthRatio: 0.60, visibility: 1.0 });
      expect(out.phase).toBe('standing'); // Does NOT re-enter descending while bent

      // User returns to upright posture (165°, depthRatio 0.10)
      t += 100;
      out = counter.update({ timestamp: t, kneeDeg: 165, depthRatio: 0.10, visibility: 1.0 });
      expect(out.phase).toBe('standing');

      // Now user starts a fresh new valid rep
      t += 100;
      counter.update({ timestamp: t, kneeDeg: 140, depthRatio: 0.35, visibility: 1.0 });
      expect(counter.phase).toBe('descending');
      t += 300;
      counter.update({ timestamp: t, kneeDeg: 80, depthRatio: 1.00, visibility: 1.0 });
      expect(counter.phase).toBe('bottom');
      t += 300;
      counter.update({ timestamp: t, kneeDeg: 115, depthRatio: 0.50, visibility: 1.0 });
      expect(counter.phase).toBe('ascending');
      t += 300;
      out = counter.update({ timestamp: t, kneeDeg: 165, depthRatio: 0.10, visibility: 1.0 });
      expect(out.phase).toBe('standing');
      expect(out.reps).toBe(1);
    });
  });

  describe('8. Degenerate Inputs & Boundary Defense Stress Tests', () => {
    it('rejects varus (negative deviation) and never fires false valgus alerts', () => {
      counter.update({ timestamp: 1000, kneeDeg: 140, depthRatio: 0.40, visibility: 1.0 });
      // 5 consecutive frames with extreme negative valgus (-25% bow-leg)
      for (let t = 1050; t <= 1250; t += 50) {
        const out = counter.update({
          timestamp: t,
          kneeDeg: 120,
          depthRatio: 0.60,
          valgusDevPctL: -25.0,
          valgusDevPctR: -30.0,
          visibility: 1.0,
        });
        expect(out.alerts.length).toBe(0);
      }
    });

    it('gracefully handles non-finite inputs (NaN, Infinity) without throwing or crashing', () => {
      // Feed NaN knee angle
      let out = counter.update({ timestamp: 1000, kneeDeg: NaN, depthRatio: NaN, visibility: 1.0 });
      // NaN angle leads to null extraction -> enters lost
      expect(out.phase).toBe('lost');
      expect(out.alerts.length).toBe(0);

      // Feed non-finite valgus deviation
      out = counter.update({
        timestamp: 1100,
        kneeDeg: 130,
        depthRatio: 0.50,
        valgusDevPctL: Infinity,
        valgusDevPctR: -Infinity,
        visibility: 1.0,
      });
      // Should not trigger alerts or throw
      expect(out.alerts.length).toBe(0);
    });

    it('gracefully handles empty or truncated landmark arrays', () => {
      // Array shorter than 29 BlazePose keypoints
      const truncated = [{ x: 0.5, y: 0.5, z: 0.0, visibility: 0.9 }];
      const out = counter.update({
        timestamp: 1000,
        landmarks2D: truncated,
        worldLandmarks3D: truncated,
      });
      // Landmark extraction returns null/0 vis -> enters lost safely
      expect(out.phase).toBe('lost');
      expect(out.alerts.length).toBe(0);
    });
  });
});

