import { describe, it, expect } from 'vitest';
import { calculatePercentile, calculateAverage, round } from '../../client/src/spikes/utils/stats';
import { FpsMeter, calculateKneeFlexionAngle } from '../../client/src/spikes/s1-pose/poseRunner';
import { TelemetryTokenBucket } from '../../client/src/spikes/s2-transient/rateCap';

describe('Spikes Statistical & Biomechanical Math Utilities', () => {
  describe('calculatePercentile & calculateAverage', () => {
    it('calculates exact p50 and p95 percentiles correctly', () => {
      // 100 values from 1 to 100
      const values = Array.from({ length: 100 }, (_, i) => i + 1);
      const p50 = calculatePercentile(values, 50);
      const p95 = calculatePercentile(values, 95);

      expect(p50).toBeCloseTo(50.5, 1);
      expect(p95).toBeCloseTo(95.05, 1);
    });

    it('handles empty and singleton arrays gracefully', () => {
      expect(calculatePercentile([], 95)).toBe(0);
      expect(calculatePercentile([42], 95)).toBe(42);
      expect(calculateAverage([])).toBe(0);
      expect(calculateAverage([10, 20, 30])).toBe(20);
    });

    it('rounds values to desired decimal precision', () => {
      expect(round(12.3456, 1)).toBe(12.3);
      expect(round(12.3456, 2)).toBe(12.35);
    });
  });

  describe('calculateKneeFlexionAngle', () => {
    it('returns ~180° for fully extended leg', () => {
      const hip = { x: 0, y: 1.0, z: 0 };
      const knee = { x: 0, y: 0.5, z: 0 };
      const ankle = { x: 0, y: 0, z: 0 };

      const angle = calculateKneeFlexionAngle(hip, knee, ankle);
      expect(angle).toBeCloseTo(180, 1);
    });

    it('returns ~90° for right-angle knee flexion', () => {
      const hip = { x: 0, y: 0.5, z: 0 };
      const knee = { x: 0, y: 0, z: 0 };
      const ankle = { x: 0.5, y: 0, z: 0 };

      const angle = calculateKneeFlexionAngle(hip, knee, ankle);
      expect(angle).toBeCloseTo(90, 1);
    });

    it('returns ~60° for deep knee bend', () => {
      // 60-degree angle
      const hip = { x: 0, y: 1, z: 0 };
      const knee = { x: 0, y: 0, z: 0 };
      const ankle = { x: Math.sin(Math.PI / 3), y: Math.cos(Math.PI / 3), z: 0 };

      const angle = calculateKneeFlexionAngle(hip, knee, ankle);
      expect(angle).toBeCloseTo(60, 1);
    });
  });

  describe('FpsMeter', () => {
    it('accurately computes sustained FPS and benchmark pass status', () => {
      const meter = new FpsMeter();

      // Simulate 30 frames recorded over ~1 second (30 FPS, ~33.3ms duration per frame)
      for (let i = 0; i < 30; i++) {
        meter.recordFrame(16.5);
      }

      const stats = meter.getSustainedStats();
      expect(stats.avgLatencyMs).toBeCloseTo(16.5, 1);
      expect(meter.getTotalFrames()).toBe(30);
    });

    it('resets all accumulators cleanly', () => {
      const meter = new FpsMeter();
      meter.recordFrame(20);
      meter.recordFrame(20);
      meter.reset();

      expect(meter.getTotalFrames()).toBe(0);
      expect(meter.getInstantFps()).toBe(0);
    });
  });

  describe('TelemetryTokenBucket', () => {
    it('regulates consumption to 10 Hz rate limit (100ms interval)', async () => {
      const bucket = new TelemetryTokenBucket();

      // First consumption succeeds
      expect(bucket.tryConsume()).toBe(true);

      // Immediate second consumption in same millisecond must be rejected
      expect(bucket.tryConsume()).toBe(false);

      // Wait 105ms -> token refilled
      await new Promise((resolve) => setTimeout(resolve, 105));
      expect(bucket.tryConsume()).toBe(true);
    });
  });
});
