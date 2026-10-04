/**
 * tests/fixtures/generate_fixtures.mjs
 *
 * Deterministic generator for the 5 realistic 30 FPS BlazePose squat fixture streams:
 * 1. normal_squat_5reps.json: 5 complete reps, theta_knee ~ 75°-85°, duration ~ 2.0s, valgus < 4%
 * 2. valgus_squat.json: Left knee valgus > +12% for >= 5 consecutive frames, recovery, cooldown test, independent Right alert
 * 3. shallow_squat.json: Reversal at theta_knee = 125°, depthRatio ~ 0.50, 0 reps
 * 4. fast_squat.json: 500 ms bounce, 0 reps
 * 5. occluded_jitter.json: 1-frame coordinate spike and 10-frame visibility dropout (< 0.50)
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SQUATS_DIR = path.resolve(__dirname, 'squats');

if (!fs.existsSync(SQUATS_DIR)) {
  fs.mkdirSync(SQUATS_DIR, { recursive: true });
}

const IMAGE_WIDTH = 640;
const IMAGE_HEIGHT = 480;
const FPS = 30;
const FRAME_INTERVAL_MS = 1000 / FPS; // 33.333333333333336 ms

/**
 * Creates 33 default BlazePose landmarks for standing neutral posture.
 */
function createDefaultLandmarks(hipY_px = 240, kneeY_px = 336, ankleY_px = 432, leftKneeX_px = 370, rightKneeX_px = 270, visibility = 0.99) {
  const landmarks = [];
  for (let i = 0; i < 33; i++) {
    landmarks.push({
      x: 0.5,
      y: 0.5,
      z: 0.0,
      visibility,
    });
  }

  // Head / Torso
  landmarks[0] = { x: 320 / IMAGE_WIDTH, y: 80 / IMAGE_HEIGHT, z: 0.0, visibility }; // nose
  landmarks[11] = { x: 370 / IMAGE_WIDTH, y: 150 / IMAGE_HEIGHT, z: 0.0, visibility }; // left shoulder
  landmarks[12] = { x: 270 / IMAGE_WIDTH, y: 150 / IMAGE_HEIGHT, z: 0.0, visibility }; // right shoulder

  // Lower body (unmirrored: Left is viewer's right X=370, Right is viewer's left X=270)
  landmarks[23] = { x: 370 / IMAGE_WIDTH, y: hipY_px / IMAGE_HEIGHT, z: 0.0, visibility }; // Left Hip
  landmarks[24] = { x: 270 / IMAGE_WIDTH, y: hipY_px / IMAGE_HEIGHT, z: 0.0, visibility }; // Right Hip
  landmarks[25] = { x: leftKneeX_px / IMAGE_WIDTH, y: kneeY_px / IMAGE_HEIGHT, z: 0.0, visibility }; // Left Knee
  landmarks[26] = { x: rightKneeX_px / IMAGE_WIDTH, y: kneeY_px / IMAGE_HEIGHT, z: 0.0, visibility }; // Right Knee
  landmarks[27] = { x: 370 / IMAGE_WIDTH, y: ankleY_px / IMAGE_HEIGHT, z: 0.0, visibility }; // Left Ankle
  landmarks[28] = { x: 270 / IMAGE_WIDTH, y: ankleY_px / IMAGE_HEIGHT, z: 0.0, visibility }; // Right Ankle

  // Feet
  landmarks[29] = { x: 370 / IMAGE_WIDTH, y: (ankleY_px + 10) / IMAGE_HEIGHT, z: 0.0, visibility };
  landmarks[30] = { x: 270 / IMAGE_WIDTH, y: (ankleY_px + 10) / IMAGE_HEIGHT, z: 0.0, visibility };
  landmarks[31] = { x: 370 / IMAGE_WIDTH, y: (ankleY_px + 15) / IMAGE_HEIGHT, z: 0.0, visibility };
  landmarks[32] = { x: 270 / IMAGE_WIDTH, y: (ankleY_px + 15) / IMAGE_HEIGHT, z: 0.0, visibility };

  return landmarks;
}

/**
 * Creates 33 metric world landmarks where knee angle equals thetaDeg.
 */
function createWorldLandmarks(thetaDegL = 180.0, thetaDegR = 180.0, visibility = 0.99) {
  const worldLandmarks = [];
  for (let i = 0; i < 33; i++) {
    worldLandmarks.push({
      x: 0.0,
      y: 0.0,
      z: 0.0,
      visibility,
    });
  }

  const radL = (thetaDegL * Math.PI) / 180.0;
  const radR = (thetaDegR * Math.PI) / 180.0;
  const legLen = 0.45; // meters

  // Left leg (indices 23, 25, 27)
  const leftKnee = { x: 0.15, y: 0.0, z: 0.0, visibility };
  const leftAnkle = { x: 0.15, y: -legLen, z: 0.0, visibility };
  const leftHip = {
    x: 0.15,
    y: -legLen * Math.cos(radL),
    z: legLen * Math.sin(radL),
    visibility,
  };

  // Right leg (indices 24, 26, 28)
  const rightKnee = { x: -0.15, y: 0.0, z: 0.0, visibility };
  const rightAnkle = { x: -0.15, y: -legLen, z: 0.0, visibility };
  const rightHip = {
    x: -0.15,
    y: -legLen * Math.cos(radR),
    z: legLen * Math.sin(radR),
    visibility,
  };

  worldLandmarks[23] = leftHip;
  worldLandmarks[24] = rightHip;
  worldLandmarks[25] = leftKnee;
  worldLandmarks[26] = rightKnee;
  worldLandmarks[27] = leftAnkle;
  worldLandmarks[28] = rightAnkle;

  return worldLandmarks;
}

/**
 * Generates normal_squat_5reps.json:
 * 5 complete, smooth reps with valid depth (theta ~ 75°-85°, duration ~ 2.0s per rep, valgus < 4%).
 */
function generateNormalSquat5Reps() {
  const frames = [];
  let frameIndex = 0;

  function addFrame(thetaDeg, depthRatio, leftKneeX = 370, rightKneeX = 270, vis = 0.99) {
    const hipY_px = 240 + depthRatio * 96;
    const kneeY_px = 336;
    const ankleY_px = 432;
    const timestampMs = Math.round(frameIndex * FRAME_INTERVAL_MS * 100) / 100;

    frames.push({
      frameIndex,
      timestampMs,
      landmarks: createDefaultLandmarks(hipY_px, kneeY_px, ankleY_px, leftKneeX, rightKneeX, vis),
      worldLandmarks: createWorldLandmarks(thetaDeg, thetaDeg, vis),
    });
    frameIndex++;
  }

  // 1. Initial standing calibration (30 frames = 1.0s)
  for (let i = 0; i < 30; i++) {
    addFrame(180.0, 0.0);
  }

  // 2. Generate 5 repetitions
  for (let rep = 1; rep <= 5; rep++) {
    // Descent: 30 frames (1.0s) from 180° -> 80°, depthRatio 0.0 -> 1.05
    for (let f = 0; f < 30; f++) {
      const progress = (f + 1) / 30;
      // Smooth sinusoidal easing
      const eased = 0.5 * (1 - Math.cos(progress * Math.PI));
      const theta = 180.0 - (180.0 - 80.0) * eased;
      const depth = 0.0 + 1.05 * eased;
      addFrame(theta, depth);
    }

    // Ascent: 30 frames (1.0s) from 80° -> 180°, depthRatio 1.05 -> 0.0
    for (let f = 0; f < 30; f++) {
      const progress = (f + 1) / 30;
      const eased = 0.5 * (1 - Math.cos(progress * Math.PI));
      const theta = 80.0 + (180.0 - 80.0) * eased;
      const depth = 1.05 - 1.05 * eased;
      addFrame(theta, depth);
    }

    // Rest at standing between reps (15 frames = 0.5s)
    for (let f = 0; f < 15; f++) {
      addFrame(180.0, 0.0);
    }
  }

  // Standing finish (15 frames)
  for (let f = 0; f < 15; f++) {
    addFrame(180.0, 0.0);
  }

  return {
    name: 'normal_squat_5reps',
    description: '5 complete, smooth repetitions with valid depth (theta_knee ~ 80°, dur ~ 2.0s per rep, valgus < 4%)',
    fps: FPS,
    frameIntervalMs: FRAME_INTERVAL_MS,
    totalFrames: frames.length,
    imageWidth: IMAGE_WIDTH,
    imageHeight: IMAGE_HEIGHT,
    frames,
  };
}

/**
 * Generates valgus_squat.json:
 * Squat repetition where Left knee medial deviation exceeds +12% for >= 5 consecutive frames during descent,
 * followed by recovery, cooldown test, and independent Right alert.
 */
function generateValgusSquat() {
  const frames = [];
  let frameIndex = 0;

  function addFrame(thetaDeg, depthRatio, leftKneeX = 370, rightKneeX = 270, vis = 0.99) {
    const hipY_px = 240 + depthRatio * 96;
    const kneeY_px = 336;
    const ankleY_px = 432;
    const timestampMs = Math.round(frameIndex * FRAME_INTERVAL_MS * 100) / 100;

    frames.push({
      frameIndex,
      timestampMs,
      landmarks: createDefaultLandmarks(hipY_px, kneeY_px, ankleY_px, leftKneeX, rightKneeX, vis),
      worldLandmarks: createWorldLandmarks(thetaDeg, thetaDeg, vis),
    });
    frameIndex++;
  }

  // Initial standing calibration (30 frames)
  for (let i = 0; i < 30; i++) {
    addFrame(180.0, 0.0);
  }

  // Descent: 35 frames (frames 30 to 64)
  // Left knee shifts medially at frames 42..46 (5 consecutive frames): X=344 (valgus +13.5%)
  // Re-triggers at frames 52..56 (5 consecutive frames): X=344 (within 2.0s -> cooldown active)
  // Right knee shifts medially at frames 58..62 (5 consecutive frames): X=296 (valgus +13.5% -> fires independently)
  for (let f = 0; f < 35; f++) {
    const currentFrame = 30 + f;
    const progress = (f + 1) / 35;
    const eased = 0.5 * (1 - Math.cos(progress * Math.PI));
    const theta = 180.0 - (180.0 - 80.0) * eased;
    const depth = 0.0 + 1.05 * eased;

    let lKneeX = 370;
    let rKneeX = 270;

    if (currentFrame >= 42 && currentFrame <= 46) {
      lKneeX = 344; // Left valgus +13.54% (> +12%)
    } else if (currentFrame >= 52 && currentFrame <= 56) {
      lKneeX = 344; // Left valgus re-trigger during cooldown
    }

    if (currentFrame >= 58 && currentFrame <= 62) {
      rKneeX = 296; // Right valgus +13.54% (> +12%)
    }

    addFrame(theta, depth, lKneeX, rKneeX);
  }

  // Bottom hold (5 frames: frames 65 to 69)
  for (let f = 0; f < 5; f++) {
    addFrame(80.0, 1.05);
  }

  // Ascent: 30 frames (frames 70 to 99)
  for (let f = 0; f < 30; f++) {
    const progress = (f + 1) / 30;
    const eased = 0.5 * (1 - Math.cos(progress * Math.PI));
    const theta = 80.0 + (180.0 - 80.0) * eased;
    const depth = 1.05 - 1.05 * eased;
    addFrame(theta, depth);
  }

  // Standing finish (20 frames)
  for (let f = 0; f < 20; f++) {
    addFrame(180.0, 0.0);
  }

  return {
    name: 'valgus_squat',
    description: 'Squat repetition where Left knee medial deviation exceeds +12% for >= 5 consecutive frames during descent, with cooldown and independent Right alert',
    fps: FPS,
    frameIntervalMs: FRAME_INTERVAL_MS,
    totalFrames: frames.length,
    imageWidth: IMAGE_WIDTH,
    imageHeight: IMAGE_HEIGHT,
    frames,
  };
}

/**
 * Generates shallow_squat.json:
 * Squat reversing at theta_knee = 125° (depthRatio ~ 0.50), yielding 0 reps.
 */
function generateShallowSquat() {
  const frames = [];
  let frameIndex = 0;

  function addFrame(thetaDeg, depthRatio, vis = 0.99) {
    const hipY_px = 240 + depthRatio * 96;
    const kneeY_px = 336;
    const ankleY_px = 432;
    const timestampMs = Math.round(frameIndex * FRAME_INTERVAL_MS * 100) / 100;

    frames.push({
      frameIndex,
      timestampMs,
      landmarks: createDefaultLandmarks(hipY_px, kneeY_px, ankleY_px, 370, 270, vis),
      worldLandmarks: createWorldLandmarks(thetaDeg, thetaDeg, vis),
    });
    frameIndex++;
  }

  // Standing calibration (30 frames)
  for (let i = 0; i < 30; i++) {
    addFrame(180.0, 0.0);
  }

  // Descent to shallow depth: 22 frames (frames 30 to 51)
  // Reaches min theta = 125°, max depthRatio = 0.50
  for (let f = 0; f < 22; f++) {
    const progress = (f + 1) / 22;
    const eased = 0.5 * (1 - Math.cos(progress * Math.PI));
    const theta = 180.0 - (180.0 - 125.0) * eased;
    const depth = 0.0 + 0.50 * eased;
    addFrame(theta, depth);
  }

  // Ascent back to standing: 25 frames (frames 52 to 76)
  // Triggers reversal (theta increases by > 10°, depth decreases)
  for (let f = 0; f < 25; f++) {
    const progress = (f + 1) / 25;
    const eased = 0.5 * (1 - Math.cos(progress * Math.PI));
    const theta = 125.0 + (180.0 - 125.0) * eased;
    const depth = 0.50 - 0.50 * eased;
    addFrame(theta, depth);
  }

  // Standing finish (20 frames)
  for (let f = 0; f < 20; f++) {
    addFrame(180.0, 0.0);
  }

  return {
    name: 'shallow_squat',
    description: 'Squat reversing at theta_knee = 125° (depthRatio ~ 0.50) without reaching bottom threshold, rejecting rep',
    fps: FPS,
    frameIntervalMs: FRAME_INTERVAL_MS,
    totalFrames: frames.length,
    imageWidth: IMAGE_WIDTH,
    imageHeight: IMAGE_HEIGHT,
    frames,
  };
}

/**
 * Generates fast_squat.json:
 * Rapid bouncing repetition completing in 500 ms (< 800 ms minimum duration), yielding 0 reps.
 */
function generateFastSquat() {
  const frames = [];
  let frameIndex = 0;

  function addFrame(thetaDeg, depthRatio, vis = 0.99) {
    const hipY_px = 240 + depthRatio * 96;
    const kneeY_px = 336;
    const ankleY_px = 432;
    const timestampMs = Math.round(frameIndex * FRAME_INTERVAL_MS * 100) / 100;

    frames.push({
      frameIndex,
      timestampMs,
      landmarks: createDefaultLandmarks(hipY_px, kneeY_px, ankleY_px, 370, 270, vis),
      worldLandmarks: createWorldLandmarks(thetaDeg, thetaDeg, vis),
    });
    frameIndex++;
  }

  // Standing calibration (21 frames = 700 ms, t = 0 to 666.67 ms)
  for (let i = 0; i < 21; i++) {
    addFrame(180.0, 0.0);
  }

  // Rapid bounce rep begins at frame 21 (t = 700 ms):
  // Rapid descent: 7 frames (~233 ms, frames 21 to 27) to theta = 80°, depthRatio = 1.05
  for (let f = 0; f < 7; f++) {
    const progress = (f + 1) / 7;
    const theta = 180.0 - (180.0 - 80.0) * progress;
    const depth = 0.0 + 1.05 * progress;
    addFrame(theta, depth);
  }

  // Rapid ascent: 8 frames (~267 ms, frames 28 to 35) back to theta = 175°, depthRatio = 0.05
  for (let f = 0; f < 8; f++) {
    const progress = (f + 1) / 8;
    const theta = 80.0 + (180.0 - 80.0) * progress;
    const depth = 1.05 - 1.05 * progress;
    addFrame(theta, depth);
  }

  // Re-enters standing at frame 36 (t = 1200 ms).
  // Total rep duration = 1200 - 700 = 500 ms (< 800 ms).
  // Standing finish (24 frames)
  for (let f = 0; f < 24; f++) {
    addFrame(180.0, 0.0);
  }

  return {
    name: 'fast_squat',
    description: 'Rapid bouncing repetition completing in 500 ms (< 800 ms minimum duration), rejecting rep',
    fps: FPS,
    frameIntervalMs: FRAME_INTERVAL_MS,
    totalFrames: frames.length,
    imageWidth: IMAGE_WIDTH,
    imageHeight: IMAGE_HEIGHT,
    frames,
  };
}

/**
 * Generates occluded_jitter.json:
 * Stream with 1-frame coordinate spikes (to verify median filter) and a 10-frame visibility dropout (< 0.50).
 */
function generateOccludedJitter() {
  const frames = [];
  let frameIndex = 0;

  function addFrame(thetaDeg, depthRatio, leftKneeX = 370, rightKneeX = 270, vis = 0.99) {
    const hipY_px = 240 + depthRatio * 96;
    const kneeY_px = 336;
    const ankleY_px = 432;
    const timestampMs = Math.round(frameIndex * FRAME_INTERVAL_MS * 100) / 100;

    frames.push({
      frameIndex,
      timestampMs,
      landmarks: createDefaultLandmarks(hipY_px, kneeY_px, ankleY_px, leftKneeX, rightKneeX, vis),
      worldLandmarks: createWorldLandmarks(thetaDeg, thetaDeg, vis),
    });
    frameIndex++;
  }

  // Standing calibration (25 frames)
  for (let i = 0; i < 25; i++) {
    addFrame(180.0, 0.0);
  }

  // Frame 25: 1-frame coordinate spike on Left knee (X spikes to 520, Y spikes to 180)
  // Followed by immediate return to 370 at frame 26
  addFrame(180.0, 0.0, 520, 270, 0.99);

  // Normal descent (frames 26 to 39)
  for (let f = 0; f < 14; f++) {
    const progress = (f + 1) / 25;
    const theta = 180.0 - (180.0 - 100.0) * progress;
    const depth = 0.0 + 0.80 * progress;
    addFrame(theta, depth);
  }

  // 10-frame visibility dropout (< 0.50): frames 40 to 49
  for (let f = 0; f < 10; f++) {
    addFrame(130.0, 0.50, 370, 270, 0.20);
  }

  // Visibility restored at frame 50: resume descent & bottom (frames 50 to 65)
  for (let f = 0; f < 16; f++) {
    const progress = (f + 1) / 16;
    const theta = 130.0 - (130.0 - 80.0) * progress;
    const depth = 0.50 + (1.05 - 0.50) * progress;
    addFrame(theta, depth, 370, 270, 0.99);
  }

  // Ascent back to standing (frames 66 to 90)
  for (let f = 0; f < 25; f++) {
    const progress = (f + 1) / 25;
    const theta = 80.0 + (180.0 - 80.0) * progress;
    const depth = 1.05 - 1.05 * progress;
    addFrame(theta, depth, 370, 270, 0.99);
  }

  // Standing finish (15 frames)
  for (let f = 0; f < 15; f++) {
    addFrame(180.0, 0.0);
  }

  return {
    name: 'occluded_jitter',
    description: 'Stream with 1-frame coordinate spikes (median filter verification) and 10-frame visibility dropout (lost phase and clean recovery)',
    fps: FPS,
    frameIntervalMs: FRAME_INTERVAL_MS,
    totalFrames: frames.length,
    imageWidth: IMAGE_WIDTH,
    imageHeight: IMAGE_HEIGHT,
    frames,
  };
}

// Generate and write all 5 fixture files
const fixtures = [
  generateNormalSquat5Reps(),
  generateValgusSquat(),
  generateShallowSquat(),
  generateFastSquat(),
  generateOccludedJitter(),
];

for (const fixture of fixtures) {
  const filePath = path.join(SQUATS_DIR, `${fixture.name}.json`);
  fs.writeFileSync(filePath, JSON.stringify(fixture, null, 2), 'utf-8');
  console.log(`Generated: ${filePath} (${fixture.totalFrames} frames)`);
}

console.log('All 5 fixtures successfully generated.');
