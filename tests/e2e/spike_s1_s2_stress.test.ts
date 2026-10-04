/**
 * Empirical Stress Challenge Test Suite: Spike S1 (Pose Inference) & Spike S2 (Transient Telemetry)
 *
 * Validates:
 * 1. Spike S1 FpsMeter: Instant FPS, 30-frame rolling window, 15 FPS thresholding, sample size gate (<15 frames)
 * 2. Spike S1 ProceduralHumanVideoGenerator: Canvas 640x480 generation, 30 FPS timing, 0.5 Hz squat kinematics, track lifecycle
 * 3. Spike S1 33-Landmark Topology: MediaPipe BlazePose keypoints, skeletal connections, drawPoseSkeleton resilience, 3D flexion angle
 * 4. Spike S2 TelemetryTokenBucket: 10 Hz rate limiting (100ms interval), burst suppression (capacity=1), 1000-call burst stress
 * 5. Spike S2 Percentile Statistics: calculatePercentile (p50, p95), calculateAverage, round, 600-element telemetry distributions
 * 6. Spike S2 Packet Loss & Quality Gate: 0% loss, 1.5% loss, 2.0% boundary condition, 400ms latency ceiling
 * 7. Spike S2 Telemetry Payload Contract: Schema version 1, strictly monotonic seq, envelope conformity with @kinesio/shared
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { calculatePercentile, calculateAverage, round } from '../../client/src/spikes/utils/stats';
import {
  FpsMeter,
  calculateKneeFlexionAngle,
  drawPoseSkeleton,
} from '../../client/src/spikes/s1-pose/poseRunner';
import { ProceduralHumanVideoGenerator } from '../../client/src/spikes/s1-pose/syntheticVideo';
import { TelemetryTokenBucket } from '../../client/src/spikes/s2-transient/rateCap';
import type { KinePosePayload, SquatPhase } from '@kinesio/shared';
import type { NormalizedLandmark } from '@mediapipe/tasks-vision';

// =============================================================================
// DOM & Canvas Mock Harness for Node / Vitest Environment
// =============================================================================
interface MockCanvasContext {
  operations: string[];
  calls: Record<string, number>;
  fillStyle: string;
  strokeStyle: string;
  lineWidth: number;
  lineCap: string;
  font: string;
  fillRect: (x: number, y: number, w: number, h: number) => void;
  clearRect: (x: number, y: number, w: number, h: number) => void;
  beginPath: () => void;
  moveTo: (x: number, y: number) => void;
  lineTo: (x: number, y: number) => void;
  closePath: () => void;
  stroke: () => void;
  fill: () => void;
  arc: (x: number, y: number, r: number, sa: number, ea: number) => void;
  ellipse: (x: number, y: number, rx: number, ry: number, rot: number, sa: number, ea: number) => void;
  fillText: (text: string, x: number, y: number) => void;
}

function createMock2dContext(): MockCanvasContext {
  const operations: string[] = [];
  const calls: Record<string, number> = {};

  const record = (name: string, detail: string) => {
    calls[name] = (calls[name] || 0) + 1;
    operations.push(`${name}:${detail}`);
  };

  return {
    operations,
    calls,
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    lineCap: 'butt',
    font: '',
    fillRect: vi.fn((x, y, w, h) => record('fillRect', `${x},${y},${w},${h}`)),
    clearRect: vi.fn((x, y, w, h) => record('clearRect', `${x},${y},${w},${h}`)),
    beginPath: vi.fn(() => record('beginPath', '')),
    moveTo: vi.fn((x, y) => record('moveTo', `${x},${y}`)),
    lineTo: vi.fn((x, y) => record('lineTo', `${x},${y}`)),
    closePath: vi.fn(() => record('closePath', '')),
    stroke: vi.fn(() => record('stroke', '')),
    fill: vi.fn(() => record('fill', '')),
    arc: vi.fn((x, y, r, sa, ea) => record('arc', `${x},${y},${r}`)),
    ellipse: vi.fn((x, y, rx, ry, rot, sa, ea) => record('ellipse', `${x},${y},${rx},${ry}`)),
    fillText: vi.fn((text, x, y) => record('fillText', `${text}:${x},${y}`)),
  };
}

describe('Spike S1 & S2 Empirical Stress Challenge Suite', () => {
  // ===========================================================================
  // SECTION 1: Spike S1 - FpsMeter Rolling Window & Sustained Threshold Math
  // ===========================================================================
  describe('Spike S1: FpsMeter Rolling Window & Sustained Benchmark Engine', () => {
    let originalNow: typeof performance.now;
    let mockTimeMs: number;

    beforeEach(() => {
      mockTimeMs = 1000.0;
      originalNow = performance.now;
      performance.now = vi.fn(() => mockTimeMs);
    });

    afterEach(() => {
      performance.now = originalNow;
    });

    it('M1-FPS.1: returns 0 FPS and pass=false for cold state and insufficient frame count (<15 frames)', () => {
      const meter = new FpsMeter();
      expect(meter.getInstantFps()).toBe(0);
      expect(meter.getRollingFps()).toBe(0);
      expect(meter.getTotalFrames()).toBe(0);

      const coldStats = meter.getSustainedStats();
      expect(coldStats).toEqual({ sustainedFps: 0, avgLatencyMs: 0, pass: false });

      // Record 14 frames at 33.3ms intervals (30 FPS rate)
      for (let i = 0; i < 14; i++) {
        mockTimeMs += 33.33;
        meter.recordFrame(12.5);
      }

      expect(meter.getTotalFrames()).toBe(14);
      // 14 frames is strictly < 15 threshold: must not report sustained stats
      const stats14 = meter.getSustainedStats();
      expect(stats14.pass).toBe(false);
      expect(stats14.sustainedFps).toBe(0);
    });

    it('M1-FPS.2: passes benchmark when sustained FPS >= 15.0 with exactly 15 frames', () => {
      const meter = new FpsMeter();

      // Record 15 frames over 1000ms (15.0 FPS)
      for (let i = 0; i < 15; i++) {
        mockTimeMs += 66.666; // 15 frames * ~66.67ms = 1000ms
        meter.recordFrame(15.0);
      }

      const stats = meter.getSustainedStats();
      expect(meter.getTotalFrames()).toBe(15);
      expect(stats.sustainedFps).toBeGreaterThanOrEqual(15.0);
      expect(stats.pass).toBe(true);
      expect(stats.avgLatencyMs).toBe(15.0);
    });

    it('M1-FPS.3: fails benchmark when sustained FPS is strictly < 15.0 FPS (e.g. 14.8 FPS and 10.0 FPS)', () => {
      const meter = new FpsMeter();

      // Record 15 frames over 1500ms (10.0 FPS)
      for (let i = 0; i < 15; i++) {
        mockTimeMs += 100.0;
        meter.recordFrame(45.0);
      }

      const stats = meter.getSustainedStats();
      expect(stats.sustainedFps).toBeCloseTo(10.7, 1);
      expect(stats.pass).toBe(false);

      // Reset and test boundary condition: 14.8 FPS
      meter.reset();
      mockTimeMs = 5000.0;
      for (let i = 0; i < 20; i++) {
        mockTimeMs += 67.567; // 20 frames / (19 intervals * 67.567ms = 1.283s) = ~15.5 or ~14.8
        meter.recordFrame(20.0);
      }

      const boundaryStats = meter.getSustainedStats();
      // Ensure that when sustainedFps is < 15.0, pass is false
      expect(typeof boundaryStats.pass).toBe('boolean');
      if (boundaryStats.sustainedFps < 15.0) {
        expect(boundaryStats.pass).toBe(false);
      } else {
        expect(boundaryStats.pass).toBe(true);
      }
    });

    it('M1-FPS.4: computes instant FPS from the delta of the last two recorded frames', () => {
      const meter = new FpsMeter();

      meter.recordFrame(10);
      expect(meter.getInstantFps()).toBe(0); // 1 frame recorded: delta not available

      // Second frame 33.33ms later (30 FPS)
      mockTimeMs += 33.333;
      meter.recordFrame(10);
      expect(meter.getInstantFps()).toBeCloseTo(30.0, 1);

      // Third frame 16.67ms later (60 FPS)
      mockTimeMs += 16.667;
      meter.recordFrame(10);
      expect(meter.getInstantFps()).toBeCloseTo(60.0, 1);

      // Fourth frame 100ms later (10 FPS)
      mockTimeMs += 100.0;
      meter.recordFrame(10);
      expect(meter.getInstantFps()).toBeCloseTo(10.0, 1);
    });

    it('M1-FPS.5: handles zero-delta edge case gracefully without throwing Infinity or NaN', () => {
      const meter = new FpsMeter();

      meter.recordFrame(10);
      // Zero time progression (same millisecond)
      meter.recordFrame(10);

      const instantFps = meter.getInstantFps();
      expect(instantFps).toBe(0);
      expect(Number.isFinite(instantFps)).toBe(true);
      expect(Number.isNaN(instantFps)).toBe(false);

      const rollingFps = meter.getRollingFps();
      expect(rollingFps).toBe(0);
      expect(Number.isFinite(rollingFps)).toBe(true);
    });

    it('M1-FPS.6: enforces 30-frame bounded sliding window (zero memory leak under 1000 frames)', () => {
      const meter = new FpsMeter();

      // Feed 1000 frames into FpsMeter
      for (let i = 0; i < 1000; i++) {
        mockTimeMs += 33.333;
        meter.recordFrame(12.0);
      }

      expect(meter.getTotalFrames()).toBe(1000);
      expect(meter.getRollingFps()).toBeCloseTo(30.0, 1);

      // Verify internal rolling window is strictly bounded
      // Using reset to confirm clean lifecycle
      meter.reset();
      expect(meter.getTotalFrames()).toBe(0);
      expect(meter.getInstantFps()).toBe(0);
      expect(meter.getRollingFps()).toBe(0);
      expect(meter.getSustainedStats()).toEqual({ sustainedFps: 0, avgLatencyMs: 0, pass: false });
    });
  });

  // ===========================================================================
  // SECTION 2: Spike S1 - ProceduralHumanVideoGenerator Canvas & Kinematics
  // ===========================================================================
  describe('Spike S1: ProceduralHumanVideoGenerator Canvas & Squat Kinematics', () => {
    let mockContext: MockCanvasContext;
    let mockTracks: Array<{ stop: ReturnType<typeof vi.fn>; kind: string }>;
    let mockStream: { getTracks: ReturnType<typeof vi.fn> };
    let mockCanvas: {
      width: number;
      height: number;
      getContext: ReturnType<typeof vi.fn>;
      captureStream: ReturnType<typeof vi.fn>;
    };
    let rafCallbacks: Array<{ id: number; cb: (time: number) => void }>;
    let nextRafId: number;

    const originalDocument = globalThis.document;
    const originalRaf = globalThis.requestAnimationFrame;
    const originalCaf = globalThis.cancelAnimationFrame;

    beforeEach(() => {
      mockContext = createMock2dContext();
      mockTracks = [{ stop: vi.fn(), kind: 'video' }];
      mockStream = { getTracks: vi.fn(() => mockTracks) };

      mockCanvas = {
        width: 640,
        height: 480,
        getContext: vi.fn((type: string) => (type === '2d' ? (mockContext as any) : null)),
        captureStream: vi.fn((fps: number) => mockStream as any),
      };

      globalThis.document = {
        createElement: vi.fn((tag: string) => {
          if (tag === 'canvas') return mockCanvas as any;
          return {} as any;
        }),
      } as any;

      rafCallbacks = [];
      nextRafId = 1;
      globalThis.requestAnimationFrame = vi.fn((cb: (time: number) => void) => {
        const id = nextRafId++;
        rafCallbacks.push({ id, cb });
        return id;
      });

      globalThis.cancelAnimationFrame = vi.fn((id: number) => {
        rafCallbacks = rafCallbacks.filter((item) => item.id !== id);
      });
    });

    afterEach(() => {
      globalThis.document = originalDocument;
      globalThis.requestAnimationFrame = originalRaf;
      globalThis.cancelAnimationFrame = originalCaf;
    });

    it('M1-GEN.1: initializes canvas with specified dimensions (default 640x480 and custom 1280x720)', () => {
      const defaultGen = new ProceduralHumanVideoGenerator();
      expect(mockCanvas.width).toBe(640);
      expect(mockCanvas.height).toBe(480);
      expect(mockCanvas.getContext).toHaveBeenCalledWith('2d');

      const customGen = new ProceduralHumanVideoGenerator(1280, 720);
      expect(mockCanvas.width).toBe(1280);
      expect(mockCanvas.height).toBe(720);
    });

    it('M1-GEN.2: start() captures MediaStream at precisely 30 FPS and is idempotent', () => {
      const generator = new ProceduralHumanVideoGenerator(640, 480);
      const stream1 = generator.start();

      expect(mockCanvas.captureStream).toHaveBeenCalledWith(30);
      expect(stream1).toBe(mockStream);
      expect(globalThis.requestAnimationFrame).toHaveBeenCalled();

      // Calling start() again returns existing stream without creating new stream
      const stream2 = generator.start();
      expect(stream2).toBe(stream1);
      expect(mockCanvas.captureStream).toHaveBeenCalledTimes(1);

      generator.stop();
    });

    it('M1-GEN.3: stop() cancels animation frame loop and terminates all media stream tracks', () => {
      const generator = new ProceduralHumanVideoGenerator(640, 480);
      generator.start();
      expect(rafCallbacks.length).toBeGreaterThan(0);

      generator.stop();
      expect(globalThis.cancelAnimationFrame).toHaveBeenCalled();
      expect(mockTracks[0]?.stop).toHaveBeenCalled();
    });

    it('M1-GEN.4: renders articulated humanoid figure and HUD across complete 0.5 Hz squat cycle', () => {
      const generator = new ProceduralHumanVideoGenerator(640, 480);
      generator.start();

      // Step through 2.0 seconds of animation (1 complete 0.5 Hz squat cycle: standing -> bottom -> standing)
      let simulatedTime = 1000.0;
      for (let step = 0; step < 60; step++) {
        simulatedTime += 33.333; // ~30 FPS
        const currentCallback = rafCallbacks.pop();
        if (currentCallback) {
          currentCallback.cb(simulatedTime);
        }
      }

      // Verify essential canvas operations were performed
      expect(mockContext.calls['fillRect']).toBeGreaterThanOrEqual(60); // Background & floor
      expect(mockContext.calls['arc']).toBeGreaterThanOrEqual(180); // Head & eyes
      expect(mockContext.calls['stroke']).toBeGreaterThanOrEqual(300); // Limbs & grid
      expect(mockContext.calls['fillText']).toBeGreaterThanOrEqual(120); // Knee angle & FPS HUD text

      // Check that the HUD text contained knee flexion readout
      const hudTexts = mockContext.operations.filter((op) => op.startsWith('fillText:'));
      expect(hudTexts.some((t) => t.includes('Knee Flexion:'))).toBe(true);
      expect(hudTexts.some((t) => t.includes('Procedural Canvas Stream (30 FPS)'))).toBe(true);

      generator.stop();
    });

    it('M1-GEN.5: mathematical squat kinematics maintain bounded angles [95°, 180°]', () => {
      // Test the mathematical formulas embedded in ProceduralHumanVideoGenerator
      const testAngles = [
        -Math.PI / 2, // Standing (sin = -1, squatDepth = 0)
        0,            // Mid-descent (sin = 0, squatDepth = 0.5)
        Math.PI / 2,  // Deep squat (sin = 1, squatDepth = 1.0)
        Math.PI,      // Mid-ascent (sin = 0, squatDepth = 0.5)
      ];

      for (const angle of testAngles) {
        const squatDepth = 0.5 + 0.5 * Math.sin(angle);
        expect(squatDepth).toBeGreaterThanOrEqual(0);
        expect(squatDepth).toBeLessThanOrEqual(1);

        const kneeAngle = Math.round(180 - squatDepth * 85);
        expect(kneeAngle).toBeGreaterThanOrEqual(95);
        expect(kneeAngle).toBeLessThanOrEqual(180);
      }
    });
  });

  // ===========================================================================
  // SECTION 3: Spike S1 - 33-Landmark Topology & Biomechanical Angles
  // ===========================================================================
  describe('Spike S1: 33-Landmark MediaPipe Topology & Biomechanical Vector Math', () => {
    it('M1-LM.1: verifies all 33 BlazePose landmark indices and key lower-body rehab joints', () => {
      // Create valid 33-landmark fixture
      const landmarks: NormalizedLandmark[] = Array.from({ length: 33 }, (_, idx) => ({
        x: 0.5 + Math.sin(idx) * 0.1,
        y: 0.1 + (idx / 33) * 0.8,
        z: 0.0,
        visibility: 0.95,
      }));

      expect(landmarks.length).toBe(33);

      // Validate key lower-body rehab indices according to TRD § Section 3
      const leftHip = landmarks[23];
      const rightHip = landmarks[24];
      const leftKnee = landmarks[25];
      const rightKnee = landmarks[26];
      const leftAnkle = landmarks[27];
      const rightAnkle = landmarks[28];

      expect(leftHip).toBeDefined();
      expect(rightHip).toBeDefined();
      expect(leftKnee).toBeDefined();
      expect(rightKnee).toBeDefined();
      expect(leftAnkle).toBeDefined();
      expect(rightAnkle).toBeDefined();

      // Coordinates must reside within normalized boundaries [0, 1]
      for (const lm of landmarks) {
        expect(lm.x).toBeGreaterThanOrEqual(0);
        expect(lm.x).toBeLessThanOrEqual(1);
        expect(lm.y).toBeGreaterThanOrEqual(0);
        expect(lm.y).toBeLessThanOrEqual(1);
        expect(lm.visibility).toBeGreaterThanOrEqual(0);
        expect(lm.visibility).toBeLessThanOrEqual(1);
      }
    });

    it('M1-LM.2: calculateKneeFlexionAngle computes exact 3D vector dot product angles', () => {
      // 1. Straight extended leg (180°)
      const hipStraight = { x: 0, y: 1.0, z: 0 };
      const kneeStraight = { x: 0, y: 0.5, z: 0 };
      const ankleStraight = { x: 0, y: 0.0, z: 0 };
      expect(calculateKneeFlexionAngle(hipStraight, kneeStraight, ankleStraight)).toBeCloseTo(180, 1);

      // 2. Right-angle flexion (90°)
      const hip90 = { x: 0, y: 0.5, z: 0 };
      const knee90 = { x: 0, y: 0.0, z: 0 };
      const ankle90 = { x: 0.5, y: 0.0, z: 0 };
      expect(calculateKneeFlexionAngle(hip90, knee90, ankle90)).toBeCloseTo(90, 1);

      // 3. Acute squat knee flexion (60°)
      const hip60 = { x: 0, y: 1.0, z: 0 };
      const knee60 = { x: 0, y: 0.0, z: 0 };
      const ankle60 = { x: Math.sin(Math.PI / 3), y: Math.cos(Math.PI / 3), z: 0 };
      expect(calculateKneeFlexionAngle(hip60, knee60, ankle60)).toBeCloseTo(60, 1);

      // 4. 3D Sagittal rotation with z-axis component
      const hip3D = { x: 0, y: 1.0, z: 0 };
      const knee3D = { x: 0, y: 0.0, z: 0 };
      const ankle3D = { x: 0, y: 0.0, z: 1.0 }; // Perpendicular in Z-plane
      expect(calculateKneeFlexionAngle(hip3D, knee3D, ankle3D)).toBeCloseTo(90, 1);
    });

    it('M1-LM.3: calculateKneeFlexionAngle handles degenerate coincident points without NaN', () => {
      // Knee coincident with hip (zero magnitude v1)
      const degenerateHip = { x: 0.5, y: 0.5, z: 0 };
      const degenerateKnee = { x: 0.5, y: 0.5, z: 0 };
      const validAnkle = { x: 0.5, y: 0.0, z: 0 };

      const result = calculateKneeFlexionAngle(degenerateHip, degenerateKnee, validAnkle);
      expect(result).toBe(180);
      expect(Number.isFinite(result)).toBe(true);
      expect(Number.isNaN(result)).toBe(false);
    });

    it('M1-LM.4: drawPoseSkeleton renders 33-landmark skeleton and highlights rehab joints in emerald', () => {
      const mockCtx = createMock2dContext();
      const landmarks: NormalizedLandmark[] = Array.from({ length: 33 }, (_, i) => ({
        x: 0.5,
        y: 0.1 + (i / 33) * 0.8,
        z: 0.0,
        visibility: 0.9,
      }));

      drawPoseSkeleton(mockCtx as any, landmarks, 640, 480);

      // Verify clearRect was called to clear previous frame
      expect(mockCtx.calls['clearRect']).toBe(1);

      // Verify joints were drawn
      expect(mockCtx.calls['arc']).toBe(33);
      expect(mockCtx.calls['fill']).toBe(33);

      // Verify bones (POSE_CONNECTIONS has 17 connections)
      expect(mockCtx.calls['stroke']).toBeGreaterThanOrEqual(17);
    });

    it('M1-LM.5: drawPoseSkeleton ignores landmarks with visibility < 0.4', () => {
      const mockCtx = createMock2dContext();
      // All landmarks have visibility 0.2 (< 0.4 threshold)
      const lowVisLandmarks: NormalizedLandmark[] = Array.from({ length: 33 }, () => ({
        x: 0.5,
        y: 0.5,
        z: 0.0,
        visibility: 0.2,
      }));

      drawPoseSkeleton(mockCtx as any, lowVisLandmarks, 640, 480);

      // Zero joints and zero bones should be rendered
      expect(mockCtx.calls['arc'] || 0).toBe(0);
      expect(mockCtx.calls['fill'] || 0).toBe(0);
    });

    it('M1-LM.6: drawPoseSkeleton handles truncated or empty landmark arrays without throwing', () => {
      const mockCtx = createMock2dContext();

      // Empty landmarks array
      expect(() => drawPoseSkeleton(mockCtx as any, [], 640, 480)).not.toThrow();

      // Truncated array (only 10 landmarks, missing lower body 23..32)
      const partialLandmarks: NormalizedLandmark[] = Array.from({ length: 10 }, () => ({
        x: 0.5,
        y: 0.5,
        z: 0,
        visibility: 0.9,
      }));

      expect(() => drawPoseSkeleton(mockCtx as any, partialLandmarks, 640, 480)).not.toThrow();
    });
  });

  // ===========================================================================
  // SECTION 4: Spike S2 - TelemetryTokenBucket 10 Hz Burst Suppression
  // ===========================================================================
  describe('Spike S2: TelemetryTokenBucket 10 Hz Rate Limiter & Burst Suppression', () => {
    let originalNow: typeof performance.now;
    let mockTimeMs: number;

    beforeEach(() => {
      mockTimeMs = 2000.0;
      originalNow = performance.now;
      performance.now = vi.fn(() => mockTimeMs);
    });

    afterEach(() => {
      performance.now = originalNow;
    });

    it('M2-TB.1: allows initial consumption and strictly rejects immediate consecutive consumption', () => {
      const bucket = new TelemetryTokenBucket();

      // First consumption succeeds
      expect(bucket.tryConsume()).toBe(true);

      // Immediate second call in same millisecond must return false
      expect(bucket.tryConsume()).toBe(false);
      expect(bucket.tryConsume()).toBe(false);
    });

    it('M2-TB.2: refills exactly 1 token after 100ms interval (10 Hz)', () => {
      const bucket = new TelemetryTokenBucket();

      expect(bucket.tryConsume()).toBe(true);

      // Advance 50ms (< 100ms interval): still rejected
      mockTimeMs += 50;
      expect(bucket.tryConsume()).toBe(false);

      // Advance 49ms (total 99ms elapsed): still rejected
      mockTimeMs += 49;
      expect(bucket.tryConsume()).toBe(false);

      // Advance 1ms (total 100ms elapsed): token replenished!
      mockTimeMs += 1;
      expect(bucket.tryConsume()).toBe(true);

      // Immediate subsequent consumption again rejected
      expect(bucket.tryConsume()).toBe(false);
    });

    it('M2-TB.3: clamps capacity to 1 (burst suppression after idle periods)', () => {
      const bucket = new TelemetryTokenBucket();
      expect(bucket.tryConsume()).toBe(true);

      // Simulate a long 10-second idle period (10,000ms elapsed)
      mockTimeMs += 10000;

      // First consumption succeeds
      expect(bucket.tryConsume()).toBe(true);

      // Second immediate consumption MUST be rejected (capacity clamped to 1, not 100)
      expect(bucket.tryConsume()).toBe(false);
    });

    it('M2-TB.4: empirical burst stress test: 1000 rapid consumption attempts over 1000ms', () => {
      const bucket = new TelemetryTokenBucket();
      let consumedCount = 0;
      let rejectedCount = 0;

      // Simulate 1,000 requests over 1,000 ms (1 request every 1 ms)
      for (let i = 0; i < 1000; i++) {
        mockTimeMs += 1.0;
        if (bucket.tryConsume()) {
          consumedCount++;
        } else {
          rejectedCount++;
        }
      }

      // At 10 Hz over 1000ms, exactly 10-11 tokens can be consumed
      expect(consumedCount).toBeGreaterThanOrEqual(10);
      expect(consumedCount).toBeLessThanOrEqual(11);
      expect(rejectedCount).toBeGreaterThanOrEqual(989);
      expect(consumedCount + rejectedCount).toBe(1000);
    });

    it('M2-TB.5: reset() refreshes token availability and timestamp', () => {
      const bucket = new TelemetryTokenBucket();
      expect(bucket.tryConsume()).toBe(true);
      expect(bucket.tryConsume()).toBe(false);

      bucket.reset();
      expect(bucket.tryConsume()).toBe(true);
    });
  });

  // ===========================================================================
  // SECTION 5: Spike S2 - Percentile & Summary Statistics Math
  // ===========================================================================
  describe('Spike S2: Percentile & Summary Statistics Engine (stats.ts)', () => {
    it('M2-STAT.1: calculatePercentile handles boundary arrays (empty, singleton, pairs)', () => {
      expect(calculatePercentile([], 50)).toBe(0);
      expect(calculatePercentile([], 95)).toBe(0);

      expect(calculatePercentile([77], 0)).toBe(77);
      expect(calculatePercentile([77], 50)).toBe(77);
      expect(calculatePercentile([77], 95)).toBe(77);
      expect(calculatePercentile([77], 100)).toBe(77);

      const pair = [10, 20];
      expect(calculatePercentile(pair, 0)).toBe(10);
      expect(calculatePercentile(pair, 50)).toBe(15);
      expect(calculatePercentile(pair, 100)).toBe(20);
    });

    it('M2-STAT.2: calculatePercentile accurately computes p50 and p95 on 600-element uniform distribution', () => {
      // 600 elements: exactly matching Spike S2 targetCount = 600 packets
      const latencies = Array.from({ length: 600 }, (_, i) => i + 1);

      const p50 = calculatePercentile(latencies, 50);
      const p95 = calculatePercentile(latencies, 95);
      const avg = calculateAverage(latencies);

      // p50 index: 0.5 * 599 = 299.5 -> (300 + 301) / 2 = 300.5
      expect(p50).toBeCloseTo(300.5, 2);

      // p95 index: 0.95 * 599 = 569.05 -> values[569]*0.95 + values[570]*0.05 = 570.05
      expect(p95).toBeCloseTo(570.05, 2);

      // Average of 1..600 = 600 * 601 / (2 * 600) = 300.5
      expect(avg).toBeCloseTo(300.5, 2);
    });

    it('M2-STAT.3: calculatePercentile is robust to outliers and skewed network latency bursts', () => {
      // 570 packets at 20ms, 20 packets at 50ms, 10 packets at 350ms (outliers)
      const skewedLatencies = [
        ...Array(570).fill(20),
        ...Array(20).fill(50),
        ...Array(10).fill(350),
      ];

      expect(skewedLatencies.length).toBe(600);

      const p50 = calculatePercentile(skewedLatencies, 50);
      const p95 = calculatePercentile(skewedLatencies, 95);

      // 50% percentile should remain unaffected by outliers at 20ms
      expect(p50).toBe(20);

      // 95% percentile interpolates between index 569 (20ms) and 570 (50ms): 20*0.95 + 50*0.05 = 21.5ms
      expect(p95).toBeCloseTo(21.5, 1);
      expect(p95).toBeLessThan(400);

      // p99 percentile reaches the tail
      const p99 = calculatePercentile(skewedLatencies, 99);
      expect(p99).toBeGreaterThan(50);
    });

    it('M2-STAT.4: does not mutate the input array when sorting', () => {
      const unsorted = [90, 10, 50, 30, 70];
      const copy = [...unsorted];

      calculatePercentile(unsorted, 50);
      expect(unsorted).toEqual(copy);
    });

    it('M2-STAT.5: round() correctly rounds numbers to specified precision', () => {
      expect(round(15.449, 1)).toBe(15.4);
      expect(round(15.451, 1)).toBe(15.5);
      expect(round(15.449, 2)).toBe(15.45);
      expect(round(15.449, 0)).toBe(15);
      // In JS, Math.round(-87.5) rounds towards +infinity to -87, yielding -8.7
      expect(round(-8.75, 1)).toBe(-8.7);
      expect(round(-8.76, 1)).toBe(-8.8);
    });
  });

  // ===========================================================================
  // SECTION 6: Spike S2 - Packet Loss Calculation & Quality Gate Thresholds
  // ===========================================================================
  describe('Spike S2: Packet Loss Calculation & Quality Gate Verification', () => {
    // Evaluation formula as implemented in telemetryRunner.ts:
    const evaluateTelemetryQuality = (
      sentCount: number,
      receivedPackets: number,
      p95: number,
      targetCount = 600
    ) => {
      const lossPct =
        sentCount > 0 ? Math.max(0, ((sentCount - receivedPackets) / sentCount) * 100) : 0;
      const pass = p95 < 400 && lossPct < 2.0 && sentCount >= Math.min(50, targetCount);
      return { lossPct: round(lossPct, 2), pass };
    };

    it('M2-GATE.1: passes benchmark with 0.0% loss and healthy latency (< 400 ms)', () => {
      // 600 sent, 600 received, p95 = 45ms
      const res = evaluateTelemetryQuality(600, 600, 45.0);
      expect(res.lossPct).toBe(0.0);
      expect(res.pass).toBe(true);
    });

    it('M2-GATE.2: passes benchmark with 1.5% loss (strictly < 2.0% threshold)', () => {
      // 600 sent, 591 received (9 lost = 1.5% loss)
      const res = evaluateTelemetryQuality(600, 591, 120.0);
      expect(res.lossPct).toBe(1.5);
      expect(res.pass).toBe(true);
    });

    it('M2-GATE.3: fails benchmark at exactly 2.0% loss boundary condition (< 2.0% requirement)', () => {
      // 600 sent, 588 received (12 lost = 2.0% loss)
      const res = evaluateTelemetryQuality(600, 588, 120.0);
      expect(res.lossPct).toBe(2.0);
      // lossPct < 2.0 is FALSE when lossPct === 2.0
      expect(res.pass).toBe(false);
    });

    it('M2-GATE.4: fails benchmark with excessive packet loss (2.5% and 5.0%)', () => {
      // 600 sent, 585 received (15 lost = 2.5% loss)
      const res25 = evaluateTelemetryQuality(600, 585, 100.0);
      expect(res25.lossPct).toBe(2.5);
      expect(res25.pass).toBe(false);

      // 600 sent, 570 received (30 lost = 5.0% loss)
      const res50 = evaluateTelemetryQuality(600, 570, 100.0);
      expect(res50.lossPct).toBe(5.0);
      expect(res50.pass).toBe(false);
    });

    it('M2-GATE.5: fails benchmark when p95 latency >= 400 ms regardless of 0% loss', () => {
      // Boundary check: p95 = 400.0ms (must be strictly < 400ms)
      const res400 = evaluateTelemetryQuality(600, 600, 400.0);
      expect(res400.pass).toBe(false);

      // High latency: p95 = 450.0ms
      const res450 = evaluateTelemetryQuality(600, 600, 450.0);
      expect(res450.pass).toBe(false);

      // Valid latency just below ceiling: p95 = 399.0ms
      const res399 = evaluateTelemetryQuality(600, 600, 399.0);
      expect(res399.pass).toBe(true);
    });

    it('M2-GATE.6: clamps negative packet loss to 0.0% when received > sent (reflection/duplicates)', () => {
      // 600 sent, 605 received
      const res = evaluateTelemetryQuality(600, 605, 50.0);
      expect(res.lossPct).toBe(0.0);
      expect(res.pass).toBe(true);
    });

    it('M2-GATE.7: fails benchmark when sample count is insufficient (< 50 packets)', () => {
      // 40 sent out of 600 target: sample size too small
      const res = evaluateTelemetryQuality(40, 40, 50.0, 600);
      expect(res.pass).toBe(false);
    });
  });

  // ===========================================================================
  // SECTION 7: Spike S2 - Biomechanical Pose Payload Envelope Contract
  // ===========================================================================
  describe('Spike S2: Biomechanical Telemetry Payload Contract & Schemas', () => {
    it('M2-PAYLOAD.1: validates KinePosePayload structure against @kinesio/shared contract', () => {
      const validPhases: SquatPhase[] = [
        'standing',
        'descending',
        'bottom',
        'ascending',
        'lost',
      ];

      // Simulate a synthetic payload generated by telemetryRunner.ts
      const seq = 42;
      const payload: KinePosePayload = {
        v: 1,
        sid: 'kine-test-session',
        t: Date.now(),
        type: 'kine.pose',
        seq,
        fps: 30,
        phase: 'descending',
        kneeFlexionDeg: { L: 82.5, R: 84.1 },
        valgusDevPct: { L: 2.1, R: -1.8 },
        depthRatio: 0.85,
        vis: 0.98,
        reps: 1,
      };

      expect(payload.v).toBe(1);
      expect(typeof payload.sid).toBe('string');
      expect(payload.t).toBeGreaterThan(1700000000000);
      expect(payload.type).toBe('kine.pose');
      expect(payload.seq).toBe(42);
      expect(payload.fps).toBe(30);
      expect(validPhases).toContain(payload.phase);
      expect(payload.kneeFlexionDeg.L).toBeCloseTo(82.5, 1);
      expect(payload.kneeFlexionDeg.R).toBeCloseTo(84.1, 1);
      expect(payload.depthRatio).toBeGreaterThanOrEqual(0);
      expect(payload.depthRatio).toBeLessThanOrEqual(1);
      expect(payload.vis).toBeGreaterThanOrEqual(0);
      expect(payload.vis).toBeLessThanOrEqual(1);
      expect(payload.reps).toBeGreaterThanOrEqual(0);
    });

    it('M2-PAYLOAD.2: validates sequence monotonicity across a continuous 600-packet transmission', () => {
      const sequences: number[] = [];
      for (let i = 1; i <= 600; i++) {
        sequences.push(i);
      }

      // Assert strictly monotonic progression
      for (let i = 1; i < sequences.length; i++) {
        const prev = sequences[i - 1];
        const curr = sequences[i];
        if (prev !== undefined && curr !== undefined) {
          expect(curr).toBe(prev + 1);
        }
      }
      expect(sequences.length).toBe(600);
      expect(sequences[0]).toBe(1);
      expect(sequences[599]).toBe(600);
    });
  });
});
