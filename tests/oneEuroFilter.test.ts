/**
 * tests/oneEuroFilter.test.ts
 *
 * Biomechanical Verification Test Suite for the 1€ (One-Euro) Adaptive Cutoff Filter
 * (Casiez, Roussel, Vogel, CHI 2012).
 *
 * Validates:
 * - Mathematical precision of the Casiez smoothing factor alpha formula: alpha = 1 / (1 + 1 / (2*pi*fc*T)).
 * - Adaptive cutoff expansion: fc = fc_min + beta * |dx_hat| under rapid joint motion.
 * - Jitter attenuation during static standing postures (fc -> fc_min).
 * - Phase lag elimination during rapid squat descents compared to fixed low-pass filter.
 * - Robust handling of tracking dropouts (null, non-finite inputs, resets).
 * - Multi-signature constructor ergonomics (positional vs options object).
 */

import { describe, it, expect } from 'vitest';
import { OneEuroFilter } from '../client/src/engine/smoothing';

describe('1€ (One-Euro) Adaptive Cutoff Filter', () => {
  // =========================================================================
  // 1. Mathematical Formula & Alpha Computation
  // =========================================================================
  describe('1. Mathematical Formula Invariants', () => {
    it('computes exact alpha matching Casiez 2012 equation: alpha = 1 / (1 + 1 / (2*pi*fc*T))', () => {
      const fc = 1.0; // 1 Hz
      const dt = 1.0 / 30.0; // 30 FPS (~0.0333 s)
      const expectedAlpha = 1.0 / (1.0 + 1.0 / (2.0 * Math.PI * fc * dt));

      const alpha = OneEuroFilter.computeAlpha(fc, dt);
      expect(alpha).toBeCloseTo(expectedAlpha, 6);
      expect(alpha).toBeGreaterThan(0.1);
      expect(alpha).toBeLessThan(0.3);
    });

    it('approaches alpha -> 1 as cutoff frequency fc increases to infinity', () => {
      const dt = 1.0 / 30.0;
      const alphaHighFc = OneEuroFilter.computeAlpha(1000.0, dt);
      expect(alphaHighFc).toBeGreaterThan(0.99);
      expect(alphaHighFc).toBeLessThanOrEqual(1.0);
    });

    it('approaches alpha -> 0 as cutoff frequency fc approaches zero', () => {
      const dt = 1.0 / 30.0;
      const alphaLowFc = OneEuroFilter.computeAlpha(0.001, dt);
      expect(alphaLowFc).toBeLessThan(0.001);
      expect(alphaLowFc).toBeGreaterThan(0);
    });

    it('safely handles non-positive or degenerate cutoff and dt', () => {
      expect(OneEuroFilter.computeAlpha(0, 0.033)).toBe(0);
      expect(OneEuroFilter.computeAlpha(-5, 0.033)).toBe(0);
      expect(OneEuroFilter.computeAlpha(1.0, 0)).toBe(0);
      expect(OneEuroFilter.computeAlpha(1.0, -0.01)).toBe(0);
    });
  });

  // =========================================================================
  // 2. Static Posture Jitter Attenuation (Low Velocity)
  // =========================================================================
  describe('2. Static Posture Jitter Attenuation', () => {
    it('relaxes cutoff to minCutoff when signal is static', () => {
      const filter = new OneEuroFilter(1.0, 0.007, 1.0);
      let t = 1000;
      const staticVal = 165.0; // 165 deg knee flexion standing

      for (let i = 0; i < 30; i++) {
        filter.filter(staticVal, t);
        t += 33; // ~30 fps
      }

      // In steady state, derivative should be 0 and fc should be equal to minCutoff (1.0 Hz)
      expect(filter.getDerivative()).toBeCloseTo(0, 4);
      expect(filter.getCutoff()).toBeCloseTo(1.0, 4);
    });

    it('attenuates high-frequency jitter on a stationary knee angle', () => {
      const filter = new OneEuroFilter(1.0, 0.005, 1.0);
      const trueAngle = 170.0;
      let t = 0;

      // Seed filter
      filter.filter(trueAngle, t);

      // Generate noisy stationary signal with alternating +/- 2.5 deg jitter
      const rawSamples: number[] = [];
      const filteredSamples: number[] = [];

      for (let i = 1; i <= 60; i++) {
        t += 33.33;
        // Deterministic high-frequency noise: +2.5, -2.5, +2.5, -2.5...
        const noise = (i % 2 === 0 ? 1 : -1) * 2.5;
        const noisyVal = trueAngle + noise;
        rawSamples.push(noisyVal);
        const out = filter.filter(noisyVal, t);
        if (out !== null) filteredSamples.push(out);
      }

      // Variance calculation
      const calcVariance = (arr: number[]) => {
        const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
        return arr.reduce((a, b) => a + (b - mean) ** 2, 0) / arr.length;
      };

      const rawVar = calcVariance(rawSamples);
      const filteredVar = calcVariance(filteredSamples);

      // The filtered variance must be significantly lower than raw noise variance
      expect(rawVar).toBeCloseTo(6.25, 1); // 2.5^2
      expect(filteredVar).toBeLessThan(rawVar * 0.40); // > 60% noise power reduction
    });
  });

  // =========================================================================
  // 3. Dynamic Cutoff Expansion & Phase Lag Elimination (High Velocity)
  // =========================================================================
  describe('3. Dynamic Cutoff Expansion & Rapid Squat Tracking', () => {
    it('expands cutoff frequency dynamically proportional to speed beta * |dx|', () => {
      const minCutoff = 1.0;
      const beta = 0.01;
      const filter = new OneEuroFilter(minCutoff, beta, 1.0);

      // Frame 1: 170 deg at t=0
      filter.filter(170.0, 0);

      // Rapid descent: moves from 170 to 140 deg in 100 ms (rate = -300 deg/s)
      filter.filter(140.0, 100);

      const derivative = filter.getDerivative();
      expect(Math.abs(derivative)).toBeGreaterThan(100);

      // Cutoff frequency must have expanded well above minCutoff
      const fc = filter.getCutoff();
      expect(fc).toBeGreaterThan(minCutoff + 1.0);
      expect(filter.getAlpha()).toBeGreaterThan(0.3); // higher responsiveness
    });

    it('demonstrates dramatically lower phase lag than fixed 1Hz filter during rapid squat descent', () => {
      // 1€ filter with adaptive beta
      const euroFilter = new OneEuroFilter(1.0, 0.02, 1.0);
      // Fixed filter with beta = 0 (constant 1.0 Hz cutoff)
      const fixedFilter = new OneEuroFilter(1.0, 0.0, 1.0);

      let t = 0;
      euroFilter.filter(170, t);
      fixedFilter.filter(170, t);

      // Rapid squat descent: 170 deg -> 80 deg over 500 ms (rate = 180 deg/s)
      let lastEuro = 170;
      let lastFixed = 170;
      const targetAngle = 80.0;

      for (let i = 1; i <= 15; i++) {
        t += 33.33;
        const currentTarget = 170 - (i / 15) * (170 - targetAngle);
        lastEuro = euroFilter.filter(currentTarget, t)!;
        lastFixed = fixedFilter.filter(currentTarget, t)!;
      }

      // At the end of the fast descent, 1€ filter must be significantly closer to target (80 deg)
      const lagEuro = Math.abs(lastEuro - targetAngle);
      const lagFixed = Math.abs(lastFixed - targetAngle);

      expect(lagEuro).toBeLessThan(lagFixed);
      expect(lagEuro).toBeLessThan(12.0); // Within 12 deg of target
      expect(lagFixed).toBeGreaterThan(20.0); // Fixed filter lags behind by > 20 deg
    });
  });

  // =========================================================================
  // 4. Tracking Loss, Dropout Recovery, and Resets
  // =========================================================================
  describe('4. Dropout Recovery & State Resets', () => {
    it('returns null and resets internal state on null or non-finite inputs', () => {
      const filter = new OneEuroFilter(1.0, 0.007, 1.0);
      expect(filter.filter(120, 100)).toBe(120);
      expect(filter.getCurrent()).toBe(120);

      // Tracking dropout
      expect(filter.filter(null, 133)).toBeNull();
      expect(filter.getCurrent()).toBeNull();

      // Immediate re-initialization on subsequent valid frame without ramp-up delay
      expect(filter.filter(95, 166)).toBe(95);
      expect(filter.getCurrent()).toBe(95);
    });

    it('handles explicit reset cleanly', () => {
      const filter = new OneEuroFilter(1.0, 0.007, 1.0);
      filter.filter(150, 0);
      filter.filter(140, 33);
      expect(filter.getCurrent()).not.toBeNull();

      filter.reset();
      expect(filter.getCurrent()).toBeNull();
      expect(filter.getDerivative()).toBe(0);

      // Re-seeds to new value
      expect(filter.filter(80, 100)).toBe(80);
    });
  });

  // =========================================================================
  // 5. Options Constructor & Defaults Ergonomics
  // =========================================================================
  describe('5. Constructor & Options Support', () => {
    it('instantiates with options object', () => {
      const filter = new OneEuroFilter({
        minCutoff: 1.5,
        beta: 0.015,
        dCutoff: 2.0,
      });

      expect(filter.minCutoff).toBe(1.5);
      expect(filter.beta).toBe(0.015);
      expect(filter.dCutoff).toBe(2.0);
    });

    it('uses correct clinical defaults when no parameters passed', () => {
      const filter = new OneEuroFilter();
      expect(filter.minCutoff).toBe(1.0);
      expect(filter.beta).toBe(0.007);
      expect(filter.dCutoff).toBe(1.0);
    });
  });
});
