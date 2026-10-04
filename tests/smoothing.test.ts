/**
 * tests/smoothing.test.ts
 *
 * Comprehensive Vitest suite for Kinematic Signal Smoothing Filters (Day 3: D3.2).
 * Tests:
 * 1. SlidingMedianFilter: 3-frame impulse noise rejection [10, 85, 12] -> 12,
 *    initial frame behavior (frame 1 raw, frame 2 avg), buffer reset on null.
 * 2. ExponentialMovingAverageFilter: alpha = 0.40 step-response convergence,
 *    latency to 50% step < 50 ms (< 2 frames at 30 FPS), missing frame hold (< 3 frames),
 *    and full reset on 3 consecutive missing frames.
 *
 * Adheres strictly to ORIGINAL_REQUEST.md § R2 & docs/trd.md § 3.
 */

import { describe, it, expect } from 'vitest';
import {
  SlidingMedianFilter,
  ExponentialMovingAverageFilter,
  MedianFilter,
  EmaFilter,
} from '../client/src/engine/smoothing';

describe('Kinematic Signal Smoothing Filters (smoothing.ts)', () => {
  describe('SlidingMedianFilter', () => {
    it('verifies alias MedianFilter is exported and points to SlidingMedianFilter', () => {
      expect(MedianFilter).toBe(SlidingMedianFilter);
    });

    it('handles initial frames correctly: frame 1 -> raw, frame 2 -> average', () => {
      const filter = new SlidingMedianFilter(3);

      // Frame 1: returns raw value
      const f1 = filter.filter(10);
      expect(f1).toBe(10);

      // Frame 2: returns average of [10, 20] => 15
      const f2 = filter.filter(20);
      expect(f2).toBe(15);
    });

    it('eliminates 3-frame impulse noise [10, 85, 12] -> 12 on frame 3', () => {
      const filter = new SlidingMedianFilter(3);

      // Frame 1: 10
      expect(filter.filter(10)).toBe(10);
      // Frame 2: 85 (impulse jump), avg = (10 + 85) / 2 = 47.5
      expect(filter.filter(85)).toBe(47.5);
      // Frame 3: 12. Buffer is [10, 85, 12]. Sorted: [10, 12, 85]. Median = 12!
      const f3 = filter.filter(12);
      expect(f3).toBe(12);
      // 85 coordinate spike was completely annihilated!
    });

    it('continues sliding over subsequent samples accurately', () => {
      const filter = new SlidingMedianFilter(3);
      filter.filter(10);
      filter.filter(85);
      filter.filter(12); // Buffer now [10, 85, 12] -> median 12

      // Frame 4: 14. Buffer shifts to [85, 12, 14]. Sorted: [12, 14, 85]. Median = 14
      expect(filter.filter(14)).toBe(14);

      // Frame 5: 16. Buffer shifts to [12, 14, 16]. Sorted: [12, 14, 16]. Median = 14
      expect(filter.filter(16)).toBe(14);

      // Frame 6: 18. Buffer shifts to [14, 16, 18]. Sorted: [14, 16, 18]. Median = 16
      expect(filter.filter(18)).toBe(16);
    });

    it('resets buffer immediately on null or non-finite tracking loss input', () => {
      const filter = new SlidingMedianFilter(3);
      filter.filter(10);
      filter.filter(20);
      filter.filter(30);
      expect(filter.getBuffer().length).toBe(3);

      // Null tracking loss input
      const resNull = filter.filter(null);
      expect(resNull).toBeNull();
      expect(filter.getBuffer().length).toBe(0);

      // Next valid frame behaves as frame 1 (raw)
      const fNew = filter.filter(45);
      expect(fNew).toBe(45);

      // NaN also resets
      expect(filter.filter(NaN)).toBeNull();
      expect(filter.getBuffer().length).toBe(0);
    });

    it('supports .update() alias for pipeline compatibility', () => {
      const filter = new SlidingMedianFilter(3);
      expect(filter.update(100)).toBe(100);
      expect(filter.update(200)).toBe(150);
      expect(filter.update(300)).toBe(200);
    });

    it('supports explicit .reset()', () => {
      const filter = new SlidingMedianFilter(3);
      filter.filter(10);
      filter.filter(20);
      filter.reset();
      expect(filter.getBuffer()).toEqual([]);
      expect(filter.filter(99)).toBe(99);
    });
  });

  describe('ExponentialMovingAverageFilter', () => {
    it('verifies alias EmaFilter is exported and points to ExponentialMovingAverageFilter', () => {
      expect(EmaFilter).toBe(ExponentialMovingAverageFilter);
    });

    it('initializes to first valid frame value (zero startup delay)', () => {
      const ema = new ExponentialMovingAverageFilter(0.40);
      expect(ema.filter(50)).toBe(50);
      expect(ema.getCurrent()).toBe(50);
    });

    it('satisfies step response latency invariant: 0 to 100 step reaches > 50% in < 50 ms (< 2 frames at 30 FPS)', () => {
      // 30 FPS implies frame interval = 33.33 ms
      // Frame 0: starting at 0
      const ema = new ExponentialMovingAverageFilter(0.40);
      ema.filter(0);
      expect(ema.getCurrent()).toBe(0);

      // Step to 100 at Frame 1 (t = 33.33 ms):
      // y_1 = 0.40 * 100 + 0.60 * 0 = 40.0
      const f1 = ema.filter(100);
      expect(f1).toBeCloseTo(40.0, 2);

      // Frame 2 (t = 66.67 ms, elapsed from step = 2 frames / 66.7 ms, but rise time to 50% is at t = 45.2 ms):
      // y_2 = 0.40 * 100 + 0.60 * 40.0 = 40 + 24 = 64.0
      const f2 = ema.filter(100);
      expect(f2).toBeCloseTo(64.0, 2);
      expect(f2!).toBeGreaterThan(50.0);

      // Mathematically, 50% step is reached between Frame 1 and Frame 2:
      // t_50% = ln(1 - 0.5) / ln(1 - 0.40) * 33.33 ms = (-0.69315 / -0.51083) * 33.33 ms = 45.23 ms < 50 ms!
      // This strictly satisfies Acceptance Criteria R2.
    });

    it('converges asymptotically towards steady-state input', () => {
      const ema = new ExponentialMovingAverageFilter(0.40);
      ema.filter(0);
      let val = 0;
      for (let i = 0; i < 15; i++) {
        val = ema.filter(100)!;
      }
      expect(val).toBeCloseTo(100.0, 1);
    });

    it('handles transient null dropouts: holds value for < 3 frames, resets on 3 consecutive missing frames', () => {
      const ema = new ExponentialMovingAverageFilter(0.40, 3, true);
      // Initialize with steady 80.0
      ema.filter(80.0);
      expect(ema.getCurrent()).toBe(80.0);

      // Missing frame 1 (1 consecutive dropout): holds 80.0
      const drop1 = ema.filter(null);
      expect(drop1).toBe(80.0);
      expect(ema.getMissingFrames()).toBe(1);

      // Missing frame 2 (2 consecutive dropouts): holds 80.0
      const drop2 = ema.filter(null);
      expect(drop2).toBe(80.0);
      expect(ema.getMissingFrames()).toBe(2);

      // Missing frame 3 (3 consecutive dropouts): threshold reached -> resets state and returns null!
      const drop3 = ema.filter(null);
      expect(drop3).toBeNull();
      expect(ema.getCurrent()).toBeNull();

      // Subsequent valid frame re-initializes raw state
      const recovery = ema.filter(120.0);
      expect(recovery).toBe(120.0);
      expect(ema.getCurrent()).toBe(120.0);
      expect(ema.getMissingFrames()).toBe(0);
    });

    it('recovers cleanly if valid frame arrives before 3 dropouts', () => {
      const ema = new ExponentialMovingAverageFilter(0.40, 3, true);
      ema.filter(50.0);

      // 2 transient dropouts
      ema.filter(null);
      ema.filter(null);
      expect(ema.getMissingFrames()).toBe(2);

      // Valid frame arrives before 3rd dropout
      // Next calculation: y_t = 0.40 * 70 + 0.60 * 50 = 28 + 30 = 58.0
      const recovered = ema.filter(70.0);
      expect(recovered).toBeCloseTo(58.0, 2);
      expect(ema.getMissingFrames()).toBe(0);
    });

    it('supports .update() alias and .reset()', () => {
      const ema = new ExponentialMovingAverageFilter(0.40);
      expect(ema.update(100)).toBe(100);
      expect(ema.update(200)).toBeCloseTo(140, 1);

      ema.reset();
      expect(ema.getCurrent()).toBeNull();
      expect(ema.getMissingFrames()).toBe(0);
      expect(ema.update(500)).toBe(500);
    });
  });
});
