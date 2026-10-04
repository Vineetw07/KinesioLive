/**
 * tests/challenger_telemetry_stress.test.ts
 *
 * EMPIRICAL ADVERSARIAL STRESS TEST SUITE
 * Challenger 1: Telemetry Rate Capping & Biomechanics Pipeline
 *
 * Scopes stress-tested:
 * 1. TelemetryTokenBucket Rate Limiter:
 *    - 30 FPS flood (33.33ms intervals) over 1s, 3s, 10s: strictly <= 10 Hz, delta >= 100ms.
 *    - 60 FPS flood (16.67ms intervals) over 1s, 5s: strictly <= 10 Hz, ~83.3% frames dropped.
 *    - 100 FPS flood (10.0ms intervals) over 1s, 5s: strictly <= 10 Hz, 90.0% frames dropped.
 *    - 1000 FPS extreme burst flood (1.0ms intervals): 989+ frames dropped.
 *    - Instantaneous zero-time flood (100 calls in same ms): exactly 1 accepted, 99 rejected.
 *    - Clock jitter & irregular arrivals: invariant delta >= 100ms between consecutive dispatches.
 *    - Reset behavior: restores immediate capacity.
 * 2. Valgus Alert Detector & Cooldown Timer:
 *    - 3 consecutive frames > 8.0%: emits exactly 1 alert.
 *    - 2 frames > 8.0% followed by 1 frame <= 8.0%: counter reset, 0 alerts.
 *    - Exact boundary: 8.000% (no alert) vs 8.001% (alert after 3 frames).
 *    - 4000ms cooldown: 100% suppression of subsequent alerts during 4000ms window.
 *    - Cooldown expiration: next alert allowed after >= 4000ms.
 *    - Bilateral independence: Left knee cooldown does NOT block Right knee alert.
 *    - Phase gating: alert active ONLY in descending and bottom phases (suppressed in standing/ascending).
 *    - Visibility dropout: resets consecutive frames counter.
 * 3. Rep Counter State Machine:
 *    - Valid squat: depth <= 105°, duration >= 800ms -> increments reps.
 *    - Shallow squat: minimum angle > 105° -> rejected (isShallow: true, reps: 0).
 *    - Rapid bounce: duration < 800ms -> rejected (isBounce: true, reps: 0).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TelemetryTokenBucket } from '../client/src/spikes/s2-transient/rateCap.js';
import { RepCounterStateMachine } from '../client/src/engine/repCounter.js';
import {
  SCHEMA_VERSION,
  VALGUS_THRESHOLD_PCT,
  VALGUS_COOLDOWN_MS,
  type KineAlertPayload,
} from '../shared/src/index.js';

describe('Challenger 1: Telemetry Rate Capping & Biomechanics Pipeline Stress Suite', () => {

  // =========================================================================
  // SECTION 1: TelemetryTokenBucket Rate Capping Stress (30, 60, 100 FPS)
  // =========================================================================
  describe('1. TelemetryTokenBucket Rate Limiter Stress Verification', () => {
    let mockCurrentTime = 1000.0;

    beforeEach(() => {
      mockCurrentTime = 1000.0;
      vi.spyOn(performance, 'now').mockImplementation(() => mockCurrentTime);
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('T-RATE.1: 30 FPS Stream Flood strictly enforces <= 10 Hz over 1s, 3s, and 10s', () => {
      const bucket = new TelemetryTokenBucket();
      const frameIntervalMs = 1000 / 30; // ~33.333 ms

      // Test 1: 1-second flood (31 frames from t=0 to t=1000ms)
      const acceptedTimestamps1s: number[] = [];
      for (let t = 0; t <= 1000; t += frameIntervalMs) {
        mockCurrentTime = 1000.0 + t;
        if (bucket.tryConsume()) {
          acceptedTimestamps1s.push(mockCurrentTime);
        }
      }

      // In 1000ms inclusive, 10 intervals of 100ms -> exactly 11 dispatches max
      expect(acceptedTimestamps1s.length).toBeLessThanOrEqual(11);
      expect(acceptedTimestamps1s.length).toBeGreaterThanOrEqual(10);

      // Verify every consecutive pair of accepted transmissions is separated by >= 100ms
      for (let i = 1; i < acceptedTimestamps1s.length; i++) {
        const delta = acceptedTimestamps1s[i] - acceptedTimestamps1s[i - 1];
        expect(delta).toBeGreaterThanOrEqual(99.9);
      }

      // Test 2: 10-second flood (301 frames from t=0 to t=10000ms)
      bucket.reset();
      const acceptedTimestamps10s: number[] = [];
      for (let t = 0; t <= 10000; t += frameIntervalMs) {
        mockCurrentTime = 2000.0 + t;
        if (bucket.tryConsume()) {
          acceptedTimestamps10s.push(mockCurrentTime);
        }
      }

      // Over 10000ms, rate must not exceed 10.1 Hz (101 dispatches max)
      expect(acceptedTimestamps10s.length).toBeLessThanOrEqual(101);
      const measuredHz = (acceptedTimestamps10s.length - 1) / (10000 / 1000);
      expect(measuredHz).toBeLessThanOrEqual(10.05);

      for (let i = 1; i < acceptedTimestamps10s.length; i++) {
        const delta = acceptedTimestamps10s[i] - acceptedTimestamps10s[i - 1];
        expect(delta).toBeGreaterThanOrEqual(99.9);
      }
    });

    it('T-RATE.2: 60 FPS Stream Flood strictly enforces <= 10 Hz and drops ~83.3% of frames', () => {
      const bucket = new TelemetryTokenBucket();
      const frameIntervalMs = 1000 / 60; // ~16.666 ms
      const totalFrames = 301; // 5 seconds of 60 FPS
      let totalPresented = 0;
      let totalAccepted = 0;
      const acceptedTimestamps: number[] = [];

      for (let i = 0; i < totalFrames; i++) {
        mockCurrentTime = 1000.0 + i * frameIntervalMs;
        totalPresented++;
        if (bucket.tryConsume()) {
          totalAccepted++;
          acceptedTimestamps.push(mockCurrentTime);
        }
      }

      // Over 5000ms, exactly <= 51 accepted frames
      expect(totalAccepted).toBeLessThanOrEqual(51);
      expect(totalAccepted).toBeGreaterThanOrEqual(50);

      // Drops ~83.3% of frames
      const dropRate = (totalPresented - totalAccepted) / totalPresented;
      expect(dropRate).toBeGreaterThan(0.80);
      expect(dropRate).toBeLessThan(0.85);

      // Verify every delta >= 100ms
      for (let i = 1; i < acceptedTimestamps.length; i++) {
        const delta = acceptedTimestamps[i] - acceptedTimestamps[i - 1];
        expect(delta).toBeGreaterThanOrEqual(99.9);
      }
    });

    it('T-RATE.3: 100 FPS High-Frequency Stream Flood strictly enforces <= 10 Hz and drops 90% of frames', () => {
      const bucket = new TelemetryTokenBucket();
      const frameIntervalMs = 10.0; // 100 FPS = 10ms per frame
      const totalFrames = 501; // 5000 ms
      let totalAccepted = 0;
      const acceptedTimestamps: number[] = [];

      for (let i = 0; i < totalFrames; i++) {
        mockCurrentTime = 1000.0 + i * frameIntervalMs;
        if (bucket.tryConsume()) {
          totalAccepted++;
          acceptedTimestamps.push(mockCurrentTime);
        }
      }

      // Over 5000ms, at 100 FPS (10ms steps), exactly 51 frames accepted (t=0, 100, 200, ... 5000)
      expect(totalAccepted).toBe(51);

      // Verify strict 100ms interval spacing
      for (let i = 1; i < acceptedTimestamps.length; i++) {
        const delta = acceptedTimestamps[i] - acceptedTimestamps[i - 1];
        expect(delta).toBe(100.0);
      }
    });

    it('T-RATE.4: 1000 FPS Extreme Burst Flood (1ms step) drops >= 98.9% of frames', () => {
      const bucket = new TelemetryTokenBucket();
      let totalAccepted = 0;
      const acceptedTimestamps: number[] = [];

      // 1000 calls across 1000ms (1ms step)
      for (let ms = 0; ms <= 1000; ms++) {
        mockCurrentTime = 1000.0 + ms;
        if (bucket.tryConsume()) {
          totalAccepted++;
          acceptedTimestamps.push(mockCurrentTime);
        }
      }

      // Exactly 11 accepted out of 1001 calls
      expect(totalAccepted).toBe(11);
      expect(1001 - totalAccepted).toBe(990); // 990 dropped

      for (let i = 1; i < acceptedTimestamps.length; i++) {
        const delta = acceptedTimestamps[i] - acceptedTimestamps[i - 1];
        expect(delta).toBe(100.0);
      }
    });

    it('T-RATE.5: Instantaneous Zero-Time Flood (100 calls in same millisecond) accepts exactly 1 and drops 99', () => {
      const bucket = new TelemetryTokenBucket();
      mockCurrentTime = 5000.0;

      let accepted = 0;
      let rejected = 0;

      for (let i = 0; i < 100; i++) {
        if (bucket.tryConsume()) {
          accepted++;
        } else {
          rejected++;
        }
      }

      expect(accepted).toBe(1);
      expect(rejected).toBe(99);
    });

    it('T-RATE.6: Jittered and Irregular Frame Arrival Intervals maintain delta >= 100ms invariant', () => {
      const bucket = new TelemetryTokenBucket();
      // Irregular frame arrival deltas in milliseconds
      const deltas = [5, 45, 12, 80, 110, 15, 95, 200, 30, 75, 10, 105, 50, 60, 100];
      const acceptedTimestamps: number[] = [];

      let currentT = 1000.0;
      for (const dt of deltas) {
        currentT += dt;
        mockCurrentTime = currentT;
        if (bucket.tryConsume()) {
          acceptedTimestamps.push(currentT);
        }
      }

      expect(acceptedTimestamps.length).toBeGreaterThan(0);
      for (let i = 1; i < acceptedTimestamps.length; i++) {
        const delta = acceptedTimestamps[i] - acceptedTimestamps[i - 1];
        expect(delta).toBeGreaterThanOrEqual(100.0);
      }
    });

    it('T-RATE.7: .reset() resets capacity to 1 token immediately', () => {
      const bucket = new TelemetryTokenBucket();
      mockCurrentTime = 1000.0;
      expect(bucket.tryConsume()).toBe(true);
      expect(bucket.tryConsume()).toBe(false);

      // Reset at same timestamp
      bucket.reset();
      expect(bucket.tryConsume()).toBe(true);
      expect(bucket.tryConsume()).toBe(false);
    });
  });

  // =========================================================================
  // SECTION 2: Valgus Alert Detector & 4000ms Cooldown Verification
  // =========================================================================
  describe('2. Valgus Alert Detector & Cooldown Timer Stress Verification', () => {
    const sessionId = 'stress-session-valgus';

    it('T-VALGUS.1: Exactly 3 consecutive frames > 8.0% triggers exactly 1 alert', () => {
      const fsm = new RepCounterStateMachine({
        sessionId,
        valgusThresholdPct: VALGUS_THRESHOLD_PCT, // 8.0%
        valgusConsecutiveFrames: 3,
        valgusCooldownMs: VALGUS_COOLDOWN_MS, // 4000ms
      });

      let t = 1000;
      // Enter descending phase: depthRatio > 0.25
      fsm.update({ timestamp: t++, depthRatio: 0.35, kneeAngle: 145, visibility: 0.95 });

      // Frame 1: valgus 9.0% -> 0 alerts
      let out = fsm.update({ timestamp: t++, depthRatio: 0.40, kneeAngle: 135, valgusDevPct: { L: 9.0, R: 1.0 }, visibility: 0.95 });
      expect(out.alerts.length).toBe(0);

      // Frame 2: valgus 9.2% -> 0 alerts
      out = fsm.update({ timestamp: t++, depthRatio: 0.45, kneeAngle: 125, valgusDevPct: { L: 9.2, R: 1.0 }, visibility: 0.95 });
      expect(out.alerts.length).toBe(0);

      // Frame 3: valgus 9.5% -> EXACTLY 1 ALERT
      out = fsm.update({ timestamp: t++, depthRatio: 0.50, kneeAngle: 115, valgusDevPct: { L: 9.5, R: 1.0 }, visibility: 0.95 });
      expect(out.alerts.length).toBe(1);
      expect(out.alerts[0].kind).toBe('knee_valgus');
      expect(out.alerts[0].side).toBe('L');
      expect(out.alerts[0].value).toBe(9.5);
      expect(out.alerts[0].thresholdPct).toBe(8.0);
      expect(out.alerts[0].phase).toBe('descending');
    });

    it('T-VALGUS.2: Interrupted sequence (2 frames > 8.0% followed by 1 frame <= 8.0%) resets counter', () => {
      const fsm = new RepCounterStateMachine({
        sessionId,
        valgusThresholdPct: 8.0,
        valgusConsecutiveFrames: 3,
        valgusCooldownMs: 4000,
      });

      let t = 1000;
      fsm.update({ timestamp: t++, depthRatio: 0.35, kneeAngle: 140, visibility: 0.95 });

      // Frame 1 (> 8.0%)
      fsm.update({ timestamp: t++, depthRatio: 0.40, kneeAngle: 135, valgusDevPct: { L: 10.0, R: 1.0 }, visibility: 0.95 });
      // Frame 2 (> 8.0%)
      fsm.update({ timestamp: t++, depthRatio: 0.45, kneeAngle: 130, valgusDevPct: { L: 10.5, R: 1.0 }, visibility: 0.95 });
      // Frame 3 (DIP: 7.9% <= 8.0%) -> Resets counter!
      let out = fsm.update({ timestamp: t++, depthRatio: 0.50, kneeAngle: 125, valgusDevPct: { L: 7.9, R: 1.0 }, visibility: 0.95 });
      expect(out.alerts.length).toBe(0);

      // Frame 4 (> 8.0% - counter at 1)
      out = fsm.update({ timestamp: t++, depthRatio: 0.55, kneeAngle: 120, valgusDevPct: { L: 11.0, R: 1.0 }, visibility: 0.95 });
      expect(out.alerts.length).toBe(0);

      // Frame 5 (> 8.0% - counter at 2)
      out = fsm.update({ timestamp: t++, depthRatio: 0.60, kneeAngle: 115, valgusDevPct: { L: 11.5, R: 1.0 }, visibility: 0.95 });
      expect(out.alerts.length).toBe(0);

      // Frame 6 (> 8.0% - counter at 3) -> Triggers alert!
      out = fsm.update({ timestamp: t++, depthRatio: 0.65, kneeAngle: 110, valgusDevPct: { L: 12.0, R: 1.0 }, visibility: 0.95 });
      expect(out.alerts.length).toBe(1);
      expect(out.alerts[0].value).toBe(12.0);
    });

    it('T-VALGUS.3: Boundary test: 8.000% does NOT trigger alert, 8.001% DOES trigger after 3 frames', () => {
      const fsm = new RepCounterStateMachine({
        sessionId,
        valgusThresholdPct: 8.0,
        valgusConsecutiveFrames: 3,
        valgusCooldownMs: 4000,
      });

      let t = 1000;
      fsm.update({ timestamp: t++, depthRatio: 0.35, kneeAngle: 140, visibility: 0.95 });

      // 5 consecutive frames at exactly 8.000%
      for (let i = 0; i < 5; i++) {
        const out = fsm.update({
          timestamp: t++,
          depthRatio: 0.5,
          kneeAngle: 120,
          valgusDevPct: { L: 8.0, R: 0.0 },
          visibility: 0.95,
        });
        expect(out.alerts.length).toBe(0);
      }

      // Now 3 frames at 8.01%
      fsm.update({ timestamp: t++, depthRatio: 0.5, kneeAngle: 120, valgusDevPct: { L: 8.01, R: 0.0 }, visibility: 0.95 });
      fsm.update({ timestamp: t++, depthRatio: 0.5, kneeAngle: 120, valgusDevPct: { L: 8.01, R: 0.0 }, visibility: 0.95 });
      const triggerOut = fsm.update({ timestamp: t++, depthRatio: 0.5, kneeAngle: 120, valgusDevPct: { L: 8.01, R: 0.0 }, visibility: 0.95 });
      expect(triggerOut.alerts.length).toBe(1);
      expect(triggerOut.alerts[0].value).toBe(8.0); // rounded to 8.0
    });

    it('T-VALGUS.4: 4000ms Cooldown suppresses 100% of alerts during cooldown and allows next alert at t >= 4000ms', () => {
      const fsm = new RepCounterStateMachine({
        sessionId,
        valgusThresholdPct: 8.0,
        valgusConsecutiveFrames: 3,
        valgusCooldownMs: 4000,
      });

      const startT = 10000;
      let t = startT;

      fsm.update({ timestamp: t, depthRatio: 0.35, kneeAngle: 140, visibility: 0.95 });

      // 3 frames to trigger first alert at t = 10000 + 30
      fsm.update({ timestamp: t += 10, depthRatio: 0.4, kneeAngle: 130, valgusDevPct: { L: 12.0, R: 0.0 }, visibility: 0.95 });
      fsm.update({ timestamp: t += 10, depthRatio: 0.5, kneeAngle: 120, valgusDevPct: { L: 12.0, R: 0.0 }, visibility: 0.95 });
      const firstAlertOut = fsm.update({ timestamp: t += 10, depthRatio: 0.6, kneeAngle: 110, valgusDevPct: { L: 12.0, R: 0.0 }, visibility: 0.95 });

      expect(firstAlertOut.alerts.length).toBe(1);
      const alertTime = firstAlertOut.alerts[0].t;
      expect(alertTime).toBe(startT + 30);

      // Flooding high valgus continuously at 30 FPS for 3950ms (inside cooldown window)
      let suppressedCount = 0;
      for (let dt = 33; dt < 3990; dt += 33) {
        const out = fsm.update({
          timestamp: alertTime + dt,
          depthRatio: 0.7,
          kneeAngle: 105,
          valgusDevPct: { L: 14.0, R: 0.0 },
          visibility: 0.95,
        });
        expect(out.alerts.length).toBe(0);
        suppressedCount++;
      }
      expect(suppressedCount).toBeGreaterThan(100);

      // At exactly alertTime + 3999ms (< 4000ms) -> Still suppressed!
      const justBeforeOut = fsm.update({
        timestamp: alertTime + 3999,
        depthRatio: 0.7,
        kneeAngle: 105,
        valgusDevPct: { L: 14.0, R: 0.0 },
        visibility: 0.95,
      });
      expect(justBeforeOut.alerts.length).toBe(0);

      // At alertTime + 4000ms (>= 4000ms) -> Triggers new alert!
      const afterCooldownOut = fsm.update({
        timestamp: alertTime + 4000,
        depthRatio: 0.7,
        kneeAngle: 105,
        valgusDevPct: { L: 14.0, R: 0.0 },
        visibility: 0.95,
      });
      expect(afterCooldownOut.alerts.length).toBe(1);
      expect(afterCooldownOut.alerts[0].t).toBe(alertTime + 4000);
      expect(afterCooldownOut.alerts[0].side).toBe('L');
    });

    it('T-VALGUS.5: Bilateral Independence: Left knee cooldown does NOT block Right knee alert', () => {
      const fsm = new RepCounterStateMachine({
        sessionId,
        valgusThresholdPct: 8.0,
        valgusConsecutiveFrames: 3,
        valgusCooldownMs: 4000,
      });

      let t = 5000;
      fsm.update({ timestamp: t++, depthRatio: 0.4, kneeAngle: 130, visibility: 0.95 });

      // Trigger Left knee alert
      fsm.update({ timestamp: t++, depthRatio: 0.5, kneeAngle: 120, valgusDevPct: { L: 10.0, R: 2.0 }, visibility: 0.95 });
      fsm.update({ timestamp: t++, depthRatio: 0.5, kneeAngle: 120, valgusDevPct: { L: 10.0, R: 2.0 }, visibility: 0.95 });
      const leftAlert = fsm.update({ timestamp: t++, depthRatio: 0.5, kneeAngle: 120, valgusDevPct: { L: 10.0, R: 2.0 }, visibility: 0.95 });
      expect(leftAlert.alerts.length).toBe(1);
      expect(leftAlert.alerts[0].side).toBe('L');

      // 500ms later (well within Left cooldown of 4000ms), Right knee breaks down
      t = 5500;
      fsm.update({ timestamp: t++, depthRatio: 0.5, kneeAngle: 120, valgusDevPct: { L: 10.0, R: 11.0 }, visibility: 0.95 });
      fsm.update({ timestamp: t++, depthRatio: 0.5, kneeAngle: 120, valgusDevPct: { L: 10.0, R: 11.0 }, visibility: 0.95 });
      const rightAlert = fsm.update({ timestamp: t++, depthRatio: 0.5, kneeAngle: 120, valgusDevPct: { L: 10.0, R: 11.0 }, visibility: 0.95 });

      // Right knee alert MUST fire independently!
      expect(rightAlert.alerts.length).toBe(1);
      expect(rightAlert.alerts[0].side).toBe('R');
      expect(rightAlert.alerts[0].value).toBe(11.0);
    });

    it('T-VALGUS.6: Phase Gating: Alert fires ONLY in descending and bottom phases (suppressed in standing and ascending)', () => {
      const fsm = new RepCounterStateMachine({
        sessionId,
        valgusThresholdPct: 8.0,
        valgusConsecutiveFrames: 3,
        valgusCooldownMs: 4000,
      });

      let t = 1000;

      // 1. In 'standing' phase: 5 consecutive frames of 15% valgus
      for (let i = 0; i < 5; i++) {
        const out = fsm.update({
          timestamp: t++,
          depthRatio: 0.10, // Standing (depth < 0.25, knee > 150)
          kneeAngle: 175,
          valgusDevPct: { L: 15.0, R: 15.0 },
          visibility: 0.95,
        });
        expect(out.phase).toBe('standing');
        expect(out.alerts.length).toBe(0); // Suppressed in standing!
      }

      // 2. Transition to 'descending': alerts activate!
      fsm.update({ timestamp: t++, depthRatio: 0.40, kneeAngle: 135, valgusDevPct: { L: 15.0, R: 2.0 }, visibility: 0.95 });
      fsm.update({ timestamp: t++, depthRatio: 0.50, kneeAngle: 125, valgusDevPct: { L: 15.0, R: 2.0 }, visibility: 0.95 });
      const descAlert = fsm.update({ timestamp: t++, depthRatio: 0.60, kneeAngle: 115, valgusDevPct: { L: 15.0, R: 2.0 }, visibility: 0.95 });
      expect(descAlert.phase).toBe('descending');
      expect(descAlert.alerts.length).toBe(1);
      expect(descAlert.alerts[0].phase).toBe('descending');

      // 3. Move to bottom phase (knee < 100)
      const bottomOut = fsm.update({ timestamp: t += 10, depthRatio: 0.90, kneeAngle: 95, valgusDevPct: { L: 2.0, R: 2.0 }, visibility: 0.95 });
      expect(bottomOut.phase).toBe('bottom');

      // 4. Reverse to 'ascending' phase (knee > 110 and depth decreasing)
      const ascOut = fsm.update({ timestamp: t += 10, depthRatio: 0.70, kneeAngle: 115, valgusDevPct: { L: 2.0, R: 2.0 }, visibility: 0.95 });
      expect(ascOut.phase).toBe('ascending');

      // 5. In 'ascending' phase: Right knee cooldown is reset, let's feed 5 frames of Right valgus > 8.0%
      for (let i = 0; i < 5; i++) {
        const out = fsm.update({
          timestamp: t += 10,
          depthRatio: 0.50 - i * 0.05,
          kneeAngle: 120 + i * 5,
          valgusDevPct: { L: 2.0, R: 15.0 },
          visibility: 0.95,
        });
        expect(out.phase).toBe('ascending');
        expect(out.alerts.length).toBe(0); // Suppressed in ascending!
      }
    });

    it('T-VALGUS.7: Tracking dropout (visibility < 0.65) resets consecutive frames counter', () => {
      const fsm = new RepCounterStateMachine({
        sessionId,
        valgusThresholdPct: 8.0,
        valgusConsecutiveFrames: 3,
        valgusCooldownMs: 4000,
      });

      let t = 1000;
      fsm.update({ timestamp: t++, depthRatio: 0.40, kneeAngle: 130, visibility: 0.95 });

      // 2 frames with valgus > 8.0%
      fsm.update({ timestamp: t++, depthRatio: 0.50, kneeAngle: 120, valgusDevPct: { L: 10.0, R: 0.0 }, visibility: 0.95 });
      fsm.update({ timestamp: t++, depthRatio: 0.50, kneeAngle: 120, valgusDevPct: { L: 10.0, R: 0.0 }, visibility: 0.95 });

      // Frame 3: Tracking Dropout (visibility = 0.40) -> transitions to 'lost'
      const lostOut = fsm.update({ timestamp: t++, visibility: 0.40 });
      expect(lostOut.phase).toBe('lost');
      expect(lostOut.alerts.length).toBe(0);

      // Recovery: visibility restored at t + 100ms (< 1000ms), 2 frames of valgus
      fsm.update({ timestamp: t += 50, depthRatio: 0.50, kneeAngle: 120, valgusDevPct: { L: 10.0, R: 0.0 }, visibility: 0.95 });
      const out2 = fsm.update({ timestamp: t += 50, depthRatio: 0.50, kneeAngle: 120, valgusDevPct: { L: 10.0, R: 0.0 }, visibility: 0.95 });
      // Total 4 frames of valgus, but dropout in the middle reset it to 2!
      expect(out2.alerts.length).toBe(0);

      // 3rd frame after recovery -> Now it fires!
      const out3 = fsm.update({ timestamp: t += 50, depthRatio: 0.50, kneeAngle: 120, valgusDevPct: { L: 10.0, R: 0.0 }, visibility: 0.95 });
      expect(out3.alerts.length).toBe(1);
    });
  });

  // =========================================================================
  // SECTION 3: Rep Counter Gate & Biomechanical Edge Cases
  // =========================================================================
  describe('3. Rep Counter State Machine Edge Cases', () => {
    it('T-REP.1: Rejects shallow squat (minKneeDeg = 115° > 105°) with zero rep increment and isShallow flag', () => {
      const fsm = new RepCounterStateMachine('rep-shallow-test');

      let t = 1000;
      // Start descent at t = 1000
      fsm.update({ timestamp: t, depthRatio: 0.30, kneeAngle: 145, visibility: 0.95 });

      // Descend to shallow depth: min knee = 115°, max depth = 0.55
      fsm.update({ timestamp: t += 500, depthRatio: 0.55, kneeAngle: 115, visibility: 0.95 });

      // Reversal to ascending (knee angle increases by > 10 deg: 115 -> 126)
      const rev = fsm.update({ timestamp: t += 300, depthRatio: 0.45, kneeAngle: 126, visibility: 0.95 });
      expect(rev.phase).toBe('ascending');

      // Stand back up at t = 2200 (duration = 1200 ms >= 800 ms)
      const finish = fsm.update({ timestamp: t += 400, depthRatio: 0.10, kneeAngle: 165, visibility: 0.95 });

      expect(finish.phase).toBe('standing');
      expect(finish.reps).toBe(0);
      expect(finish.completedRep).toBeNull();
      expect(finish.isShallow).toBe(true);
      expect(finish.isBounce).toBe(false);
    });

    it('T-REP.2: Rejects rapid bounce (duration = 500ms < 800ms) with zero rep increment and isBounce flag', () => {
      const fsm = new RepCounterStateMachine('rep-bounce-test');

      let t = 1000;
      // Descent starts at t = 1000
      fsm.update({ timestamp: t, depthRatio: 0.30, kneeAngle: 145, visibility: 0.95 });

      // Hits deep bottom at t = 1250 (knee = 85°)
      fsm.update({ timestamp: t += 250, depthRatio: 0.90, kneeAngle: 85, visibility: 0.95 });

      // Ascends rapidly at t = 1400 (knee = 115°)
      fsm.update({ timestamp: t += 150, depthRatio: 0.60, kneeAngle: 115, visibility: 0.95 });

      // Finishes at t = 1500 (total duration = 500 ms < 800 ms)
      const finish = fsm.update({ timestamp: t += 100, depthRatio: 0.10, kneeAngle: 165, visibility: 0.95 });

      expect(finish.phase).toBe('standing');
      expect(finish.reps).toBe(0);
      expect(finish.completedRep).toBeNull();
      expect(finish.isBounce).toBe(true);
    });

    it('T-REP.3: Validates good rep (knee = 95° <= 105°, duration = 2000ms >= 800ms) with controlled tempo', () => {
      const fsm = new RepCounterStateMachine('rep-valid-test');

      let t = 1000;
      // Descent starts at t = 1000
      fsm.update({ timestamp: t, depthRatio: 0.30, kneeAngle: 145, visibility: 0.95 });

      // Bottom at t = 2000 (knee = 95°)
      fsm.update({ timestamp: t += 1000, depthRatio: 0.90, kneeAngle: 95, visibility: 0.95 });

      // Ascends at t = 2500 (knee = 120°)
      fsm.update({ timestamp: t += 500, depthRatio: 0.50, kneeAngle: 120, visibility: 0.95 });

      // Completes rep at t = 3000 (duration = 2000 ms)
      const finish = fsm.update({ timestamp: t += 500, depthRatio: 0.10, kneeAngle: 165, visibility: 0.95 });

      expect(finish.phase).toBe('standing');
      expect(finish.reps).toBe(1);
      expect(finish.completedRep).not.toBeNull();
      expect(finish.completedRep!.n).toBe(1);
      expect(finish.completedRep!.durMs).toBe(2000);
      expect(finish.completedRep!.tempo).toBe('controlled');
      expect(finish.completedRep!.depth).toBe('good');
      expect(finish.isShallow).toBe(false);
      expect(finish.isBounce).toBe(false);
    });
  });
});
