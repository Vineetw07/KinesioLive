# Survey Report: Test Harness and Fixture Architecture (Day 3 Kinematics Engine)

**Surveyor:** explorer_d3_survey_3  
**Date:** 2026-10-04T05:20:00Z  
**Target Milestone:** Day 3 Kinematics Pose Engine & Biomechanics Testing (D3.1–D3.5)  
**Parent Conversation ID:** `b54e93f5-e470-4c09-928a-a4cf3197f4a3`

---

## 1. Observation

Direct observations from the workspace filesystem, configuration files, and tools:

### 1.1 Filesystem & Configuration Observations
- **Root `package.json` (`d:/TP/Hackathon/Cometchat/package.json`):**
  - Line 9: `"test": "vitest run"`
  - Line 13: `"vitest": "^3.2.7"`
- **Client `package.json` (`d:/TP/Hackathon/Cometchat/client/package.json`):**
  - Line 17: `"@mediapipe/tasks-vision": "^0.10.14"`
  - Line 16: `"@kinesio/shared": "workspace:*"`
  - Line 10: `"typecheck": "tsc --noEmit"`
- **Client `tsconfig.json` (`d:/TP/Hackathon/Cometchat/client/tsconfig.json`):**
  - Line 20: `"include": ["src"]`
  - Client TypeScript compiler only checks `client/src/`. No tests are located inside `client/`.
- **Root `vitest.config.ts` (`d:/TP/Hackathon/Cometchat/vitest.config.ts`):**
  - Line 4: `export default defineConfig({ test: { environment: 'node' }, resolve: { alias: ... } });`
  - Environment is set to `'node'`.
- **Existing `tests/` directory (`d:/TP/Hackathon/Cometchat/tests/`):**
  - Test folder resides at the monorepo root: `tests/e2e/`, `tests/mocks/`.
  - There is NO `client/tests/` directory in the repository.
- **Vitest Run Test:**
  - Running `pnpm vitest run tests/e2e/spikes_math.test.ts` exited with code 0 (`✓ tests/e2e/spikes_math.test.ts (9 tests) 120ms`).
  - Running `pnpm vitest run tests/geometry.test.ts tests/smoothing.test.ts tests/repCounter.test.ts` returned:
    ```
    No test files found, exiting with code 1
    filter: tests/geometry.test.ts, tests/smoothing.test.ts, tests/repCounter.test.ts
    ```
    This verifies Vitest evaluates filter paths relative to the monorepo root `tests/`.

### 1.2 BlazePose 33-Landmark Schema in `@mediapipe/tasks-vision`
Inspecting `client/node_modules/@mediapipe/tasks-vision/vision.d.ts`:
- **`NormalizedLandmark` (Lines 2298–2307):**
  ```typescript
  export declare interface NormalizedLandmark {
    x: number;          // Normalized [0, 1] across image width
    y: number;          // Normalized [0, 1] across image height
    z: number;          // Relative depth, roughly same scale as x
    visibility: number; // Visibility confidence [0, 1]
  }
  ```
- **`Landmark` (`worldLandmarks`, Lines 2014–2023):**
  ```typescript
  export declare interface Landmark {
    x: number;          // Metric coordinates in meters (origin: hip center)
    y: number;          // Metric coordinates in meters
    z: number;          // Metric coordinates in meters (negative = closer to camera)
    visibility: number; // Visibility confidence [0, 1]
  }
  ```
- **`PoseLandmarkerResult` (Lines 2592–2607):**
  ```typescript
  export declare class PoseLandmarkerResult {
    readonly landmarks: NormalizedLandmark[][]; // Array of detected poses; pose 0 has 33 landmarks
    readonly worldLandmarks: Landmark[][];      // Array of detected poses; pose 0 has 33 metric landmarks
  }
  ```
- **Keypoint Topology:**
  - Left Leg: Left Hip (`23`), Left Knee (`25`), Left Ankle (`27`)
  - Right Leg: Right Hip (`24`), Right Knee (`26`), Right Ankle (`28`)
  - Torso: Left Shoulder (`11`), Right Shoulder (`12`)

### 1.3 `ORIGINAL_REQUEST.md` Specifications
- **Section R4 (Line 92):**
  - "Landmark Fixtures & Vitest Suite (`tests/fixtures/squats/` & `tests/`)"
- **Section R4 (Lines 93–98):**
  - 5 fixtures: `normal_squat_5reps.json`, `valgus_squat.json`, `shallow_squat.json`, `fast_squat.json`, `occluded_jitter.json`.
  - Format: 30 FPS synthetic/recorded JSON streams.
- **Acceptance Criteria (Lines 134–136):**
  - `pnpm --filter @kinesio/client exec tsc --noEmit` exits with code 0.
  - `pnpm vitest run tests/geometry.test.ts tests/smoothing.test.ts tests/repCounter.test.ts` exits with code 0.
  - 100% of assertions evaluate real computed state against synthetic/recorded BlazePose fixture streams (zero tautological mocks).

---

## 2. Logic Chain

From the observations above, the design and layout of the test harness is derived through the following deductive chain:

### Step 1: Fixture Directory Placement
- **Observation:** `ORIGINAL_REQUEST.md` line 92 specifies `tests/fixtures/squats/ & tests/`. Vitest runs with root working directory. `client/tsconfig.json` only includes `src/`.
- **Deduction:** Fixture JSON files MUST live in:
  `d:/TP/Hackathon/Cometchat/tests/fixtures/squats/`
  Placing fixtures in `client/tests/` would violate monorepo conventions, create duplicate paths, and conflict with `client/tsconfig.json` which excludes non-`src` files.

### Step 2: 30 FPS Fixture Stream Structure
- **Observation:** The biomechanical engine consumes both 2D `landmarks` (for standing calibration, pixel coordinates, depth ratio, valgus deviation) and metric 3D `worldLandmarks` (for knee flexion angle via dot product). MediaPipe operates at 30 FPS.
- **Deduction:** At 30 FPS:
  - Frame duration: $\Delta t = 1000 / 30 = 33.333\text{ ms}$.
  - Timestamps: $t_i = i \times 33.333\text{ ms}$ ($0, 33.33, 66.67, 100.0, \dots$).
  - Image dimensions: $W = 640$, $H = 480$.
  - All 33 BlazePose landmarks must be present per frame to satisfy skeletal indexing (indices 0 to 32), with bilateral lower-limb joints (23, 24, 25, 26, 27, 28) and shoulders (11, 12) strictly obeying realistic kinematics.
- **Fixture Schema Specification:**
  ```typescript
  export interface BlazePoseFixtureLandmark {
    x: number;
    y: number;
    z: number;
    visibility: number;
  }

  export interface BlazePoseFixtureFrame {
    frameIndex: number;
    timestampMs: number;
    landmarks: BlazePoseFixtureLandmark[];      // 33 normalized landmarks [0, 1]
    worldLandmarks: BlazePoseFixtureLandmark[]; // 33 metric landmarks (meters)
  }

  export interface SquatFixtureFile {
    name: string;
    description: string;
    fps: 30;
    frameIntervalMs: 33.333333333333336;
    totalFrames: number;
    imageWidth: 640;
    imageHeight: 480;
    frames: BlazePoseFixtureFrame[];
  }
  ```

### Step 3: Exact Characterization of the 5 Fixtures
1. **`normal_squat_5reps.json`:**
   - **Total duration:** 15.0 seconds (450 frames @ 30 FPS).
   - **Structure:**
     - Frames 0–29: Standing baseline calibration ($\theta = 180^\circ$, $depthRatio = 0.0$, $valgusDevPct \approx 0\%$, $vis = 0.99$).
     - Rep 1: Frames 30–89 (2000 ms duration). Descent to bottom at frame 60 ($\theta = 80^\circ$, $depthRatio = 1.05$), ascent back to standing at frame 89. Emits completed rep 1 (`tempo: "controlled"`, `depth: "good"|"deep"`, `durMs: 1967`).
     - Rest 1: Frames 90–104 (500 ms standing).
     - Rep 2: Frames 105–164 (2000 ms duration). Emits completed rep 2.
     - Rest 2: Frames 165–179.
     - Rep 3: Frames 180–239 (2000 ms duration). Emits completed rep 3.
     - Rest 3: Frames 240–254.
     - Rep 4: Frames 255–314 (2000 ms duration). Emits completed rep 4.
     - Rest 4: Frames 315–329.
     - Rep 5: Frames 330–389 (2000 ms duration). Emits completed rep 5.
     - Standing finish: Frames 390–449.
   - **Engine Outcome:** Exactly 5 completed reps; zero alerts (valgus $< 4\%$).

2. **`valgus_squat.json`:**
   - **Total duration:** ~4.5 seconds (135 frames @ 30 FPS).
   - **Structure:**
     - Frames 0–29: Standing calibration.
     - Frames 30–89: Squat repetition.
     - Descent: Frames 30–59. At Frames 42–46 (5 consecutive frames, 167 ms duration):
       - Left knee $X$ moves medially from neutral $370$ px to $344$ px ($X_{\text{baseline}} = 370$ px).
       - Medial shift: $X_k - X_{\text{baseline}} = -26$ px.
       - Polarity $=-1 \implies \text{valgusDevPct} = \frac{-1 \times (-26)}{192} \times 100 = +13.54\%$.
       - Exceeds $+8.0\%$ and $> +12.0\%$ for 5 consecutive frames during `descending`.
       - Triggers Left knee Valgus Alert at Frame 44 (after 3 consecutive frames $> +8.0\%$).
     - Frames 47–60: Left knee realigns to neutral $370$ px; reaches bottom at frame 60 ($\theta = 80^\circ$).
     - Ascent: Frames 61–89.
     - Cooldown test:
       - Frames 74–78: Left knee repeats valgus excursion ($+13.5\%$) at $t = 2467$ ms (~1000 ms after first alert at $t=1467$ ms).
       - Because 4000 ms cooldown is active, NO second Left alert is emitted.
       - Frames 80–84: Right knee medially collapses ($X$ moves from $270 \to 296$ px $\implies +13.5\%$).
       - Right leg cooldown is independent $\implies$ Right knee Valgus Alert fires!
   - **Engine Outcome:** Exactly 1 Left alert, exactly 1 Right alert; 4.0s cooldown respected per leg.

3. **`shallow_squat.json`:**
   - **Total duration:** 3.0 seconds (90 frames @ 30 FPS).
   - **Structure:**
     - Frames 0–29: Standing calibration.
     - Frames 30–52: Descent toward partial depth. Knee flexion halts at minimum $\theta_{\text{knee}} = 125.0^\circ$ ($depthRatio \approx 0.50$). Bottom threshold ($\theta < 100^\circ$ or $depthRatio > 0.85$) is NEVER reached.
     - Frame 53: Reversal detected ($\theta$ increases by $> 10^\circ$ to $136^\circ$, $depthRatio$ decreases).
       FSM triggers Transition 3: `descending` $\to$ `ascending` (shallow reversal path), preventing FSM deadlock.
     - Frames 54–75: Ascent back to standing ($\theta > 160^\circ$, $depthRatio < 0.20$).
     - Validation Gate at Frame 75: $\min(\theta) = 125^\circ > 105^\circ$.
       Marked as shallow squat. Rep count is NOT incremented.
   - **Engine Outcome:** Exactly 0 completed reps; FSM returns cleanly to `standing`.

4. **`fast_squat.json`:**
   - **Total duration:** 2.0 seconds (60 frames @ 30 FPS).
   - **Structure:**
     - Frames 0–20: Standing calibration ($t \in [0, 667]$ ms).
     - Rep begins at Frame 21 ($t = 700$ ms):
       - Rapid descent: Frames 21–27 (~233 ms) to $\theta = 80^\circ$ ($depthRatio = 1.05$).
       - Rapid ascent: Frames 28–35 (~267 ms) to $\theta = 175^\circ$ ($depthRatio = 0.05$).
       - Re-enters standing: Frame 36 ($t = 1200$ ms).
       - Duration: $1200 - 700 = 500\text{ ms} < 800\text{ ms}$.
     - Validation Gate: Minimum duration not met ($500\text{ ms} < 800\text{ ms}$).
       Marked as rapid bounce. Rep count is NOT incremented.
   - **Engine Outcome:** Exactly 0 completed reps.

5. **`occluded_jitter.json`:**
   - **Total duration:** 4.0 seconds (120 frames @ 30 FPS).
   - **Structure:**
     - Frames 0–25: Standing calibration.
     - Frame 26 ($t = 867$ ms): Coordinate impulse jitter:
       Left knee coordinate spikes from $X=370, Y=336 \to X=520, Y=180$.
     - Frame 27 ($t = 900$ ms): Left knee returns to $X=370, Y=336$.
       3-frame rolling median over $[370, 520, 370] \implies 370$. Single-frame spike is eliminated.
     - Frames 50–59 (10 consecutive frames, 333 ms duration):
       All landmarks drop visibility to $0.20$ ($< 0.65$).
       FSM transitions to phase `"lost"`.
     - Frame 60 ($t = 2000$ ms): Visibility restored to $0.99$.
       Dropout duration ($333\text{ ms} < 1000\text{ ms}$). FSM recovers back to previous active phase.
   - **Engine Outcome:** Impulse spike rejected by median filter; FSM cleanly enters `"lost"` and recovers.

### Step 4: Vitest Test Suite Wiring & Invariants
- **Test File Locations:**
  - `d:/TP/Hackathon/Cometchat/tests/geometry.test.ts`
  - `d:/TP/Hackathon/Cometchat/tests/smoothing.test.ts`
  - `d:/TP/Hackathon/Cometchat/tests/repCounter.test.ts`
- **Imports in Test Files:**
  ```typescript
  import { describe, it, expect } from 'vitest';
  import fs from 'node:fs';
  import path from 'node:path';
  import {
    compute3DKneeFlexion,
    calibrateStandingBaseline,
    computeValgusDeviation,
    computeDepthRatio
  } from '../client/src/engine/geometry';
  import { MedianFilter, EMAFilter } from '../client/src/engine/smoothing';
  import { RepCounter } from '../client/src/engine/repCounter';
  ```
- **Execution Command:**
  ```powershell
  pnpm vitest run tests/geometry.test.ts tests/smoothing.test.ts tests/repCounter.test.ts
  ```

---

## 3. Caveats

1. **Node.js Environment in Vitest:**
   - `vitest.config.ts` uses `environment: 'node'`. The engine modules in `client/src/engine/` must be 100% decoupled from DOM, `window`, `document`, React, and `canvas`. This matches Acceptance Criterion 124 ("Zero DOM, zero React, and zero browser-only global dependencies in client/src/engine/").
2. **Deterministic Floating-Point Equality:**
   - In geometry tests (vector angles and valgus deviation), floating-point arithmetic requires `toBeCloseTo(expected, numDigits)` rather than `toBe()`. For instance, dot-product trigonometric angles should use `expect(angle).toBeCloseTo(90.0, 1)`.
3. **TypeScript Module Resolution for Fixtures:**
   - Rather than relying on `resolveJsonModule` in `tsconfig.json` which can vary across monorepo subprojects under `NodeNext`, tests should load fixture JSON files using `JSON.parse(fs.readFileSync(path.resolve(__dirname, 'fixtures/squats/<file>.json'), 'utf-8'))`. This is guaranteed to pass both `vitest` and `tsc --noEmit` without module resolution ambiguity.

---

## 4. Conclusion

1. **Fixture Directory:**
   - The authoritative location is:
     `d:/TP/Hackathon/Cometchat/tests/fixtures/squats/`
   - Files to create:
     - `normal_squat_5reps.json`
     - `valgus_squat.json`
     - `shallow_squat.json`
     - `fast_squat.json`
     - `occluded_jitter.json`

2. **Fixture Format:**
   - 30 FPS, frame interval $33.333\text{ ms}$, image space $640 \times 480$.
   - Each frame contains:
     `frameIndex`, `timestampMs`, `landmarks` (33 normalized 2D items with `x, y, z, visibility`), and `worldLandmarks` (33 metric 3D items with `x, y, z, visibility` in meters).

3. **Test Suites Structure:**
   - `tests/geometry.test.ts`: Vector dot products (orthogonal $90^\circ$, collinear $180^\circ$, acute $60^\circ$), degenerate vector guards ($\|v\| \le 10^{-6} \to \text{null}$), standing baseline calibration (positive lengths, height order check), bilateral unmirrored valgus polarities (Left $-1$, Right $+1$), and vertical segment collapse guards ($|Y_a - Y_h| \le 10^{-4} \to \text{null}$).
   - `tests/smoothing.test.ts`: 3-frame median filter (single-frame impulse noise elimination $[10, 85, 12] \to 12$), EMA angle filter ($\alpha = 0.40$, step response $< 50\text{ ms}$ to $50\%$, dropout decay).
   - `tests/repCounter.test.ts`: Consumes the 5 real fixture streams frame-by-frame; verifies 5 completed reps on `normal_squat_5reps.json`, 0 reps on `shallow_squat.json`, 0 reps on `fast_squat.json`, 1 Left alert + cooldown on `valgus_squat.json`, and `"lost"` phase transition/recovery on `occluded_jitter.json`.

4. **Non-Tautological Invariants:**
   - Zero trivial mocks.
   - 100% of assertions evaluate real computed state against synthetic/recorded BlazePose fixture streams.
   - Zero crash-site masking (`?.`, `?? null`, `@ts-ignore`).

---

## 5. Verification Method

To independently verify this survey and prepare for Day 3 implementation:

1. **Verify Workspace Typecheck:**
   ```powershell
   pnpm run typecheck; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
   pnpm --filter @kinesio/client exec tsc --noEmit; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
   ```
   *Expected:* Exit code 0 across all packages.

2. **Verify Vitest Runner Execution:**
   ```powershell
   pnpm vitest run tests/e2e/spikes_math.test.ts; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
   ```
   *Expected:* 9/9 tests pass with exit code 0.

3. **Verify Target Day 3 Test Execution Command:**
   ```powershell
   pnpm vitest run tests/geometry.test.ts tests/smoothing.test.ts tests/repCounter.test.ts
   ```
   *Current Invalidation Condition:* Returns exit code 1 with "No test files found" because `tests/geometry.test.ts`, `tests/smoothing.test.ts`, and `tests/repCounter.test.ts` have not yet been implemented. Once implemented by the Day 3 engineer, it will execute and pass with exit code 0.

4. **Synthetic Fixture Generator Reference Script:**
   A deterministic fixture generator script should be provided at `tests/fixtures/generate_fixtures.ts` (or executed via `pnpm tsx`) to regenerate all 5 JSON files deterministically if any threshold or parameter is tuned.
