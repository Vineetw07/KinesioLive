# Biomechanical Kinematics Engine Survey & Architectural Handoff Report

**Agent:** `explorer_d3_survey_1`  
**Mission:** Workspace structure survey, `@kinesio/shared` contracts mapping, zero-DOM boundary verification, and engine code layout design (`client/src/engine/`).  
**Working Directory:** `d:/TP/Hackathon/Cometchat/.agents/teamwork/teamwork_preview_explorer_d3_survey_1/`

---

## 1. Observation

### 1.1 Workspace Layout & Configuration Ground Truth
- **Root Configuration:**
  - `pnpm-workspace.yaml`:
    ```yaml
    packages:
      - 'shared'
      - 'server'
      - 'client'
    ```
  - `vitest.config.ts`:
    ```typescript
    export default defineConfig({
      test: {
        environment: 'node',
      },
      resolve: {
        alias: {
          '@cometchat/calls-sdk-javascript': path.resolve(__dirname, 'tests/mocks/calls-sdk.ts'),
          '@cometchat/chat-sdk-javascript': path.resolve(__dirname, 'tests/mocks/chat-sdk.ts'),
        },
      },
    });
    ```
    *Critical Observation:* `test.environment` is strictly `'node'`. The global execution environment for Vitest has no `window`, `document`, `navigator`, `HTMLVideoElement`, or `CanvasRenderingContext2D`.
  - `package.json` scripts:
    `"test": "vitest run"`, `"typecheck": "pnpm -r run typecheck"`, `"build": "pnpm -r run build"`.

### 1.2 Shared Package (`shared/src/index.ts` & `shared/package.json`)
- `shared/package.json`: exports `.` mapped to `./dist/index.d.ts` and `./dist/index.js`.
- `shared/src/index.ts` exports 22 symbols:
  1. `SCHEMA_VERSION = 1 as const` (line 6)
  2. `Side = "L" | "R"` (line 8)
  3. `SquatPhase = "standing" | "descending" | "bottom" | "ascending" | "lost"` (line 10)
  4. `SquatDepthRating = "shallow" | "good" | "deep"` (line 12)
  5. `SquatTempo = "fast" | "controlled" | "slow"` (line 14)
  6. `CoachingCueType = "knees_out" | "slower" | "chest_up" | "good_depth"` (line 16)
  7. `SessionMarkerAction = "start" | "end" | "summary"` (line 18)
  8. `UserRole = "clinician" | "patient"` (line 20)
  9. `Envelope` (lines 25–29)
  10. `KinePosePayload` (lines 35–46: includes `phase: SquatPhase`, `kneeFlexionDeg: { L: number | null; R: number | null }`, `valgusDevPct: { L: number | null; R: number | null }`, `depthRatio: number`, `vis: number`, `reps: number`)
  11. `KineRepPayload` (lines 52–59: includes `n: number`, `minKneeDeg: number`, `depth: SquatDepthRating`, `durMs: number`, `tempo: SquatTempo`)
  12. `KineAlertPayload` (lines 65–74: includes `kind: "knee_valgus"`, `side: Side`, `value: number`, `thresholdPct: number`, `repN: number`, `phase: SquatPhase`, `note: "Form alert (biomechanical feedback)"`)
  13. `KineCuePayload` (lines 80–84)
  14. `KineSessionMarkerPayload` (lines 90–95)
  15. `KineMessage` (lines 100–105)
  16. `SessionRequest` (lines 110–113)
  17. `SessionResponse` (lines 118–124)
  18. `CLINICIAN_UID = "dr-demo"` (line 129)
  19. `PATIENT_UID = "pt-demo"` (line 130)
  20. `TELEMETRY_RATE_HZ = 10` (line 131)
  21. `VALGUS_THRESHOLD_PCT = 8.0` (line 132)
  22. `VALGUS_COOLDOWN_MS = 4000` (line 133)

### 1.3 Client Directory Inspection (`client/`)
- `client/src/` contains:
  - `App.tsx`, `index.css`, `main.tsx`, `vite-env.d.ts`
  - `spikes/` (`s1-pose/`, `s2-transient/`, `s3-calls/`, `s4-custom/`, `utils/`, `types.ts`, `SpikesHarness.tsx`)
  - **`client/src/engine/` does NOT exist yet.**
- `client/tsconfig.json`:
  - `"include": ["src"]`
  - `"moduleResolution": "bundler"`
  - `"target": "ES2022"`, `"strict": true`
  - Any file placed in `client/src/engine/` is immediately type-checked by `tsc`.
- Existing pose handling in Spike 1 (`client/src/spikes/s1-pose/poseRunner.ts`):
  - Couples MediaPipe vision tasks with DOM video tapping: `startVideoPosePipeline` (lines 146–222) and `drawPoseSkeleton` (lines 256–299).
  - Rudimentary `calculateKneeFlexionAngle` (lines 124–139) returns dummy `180` for degenerate vectors, which directly violates R1 acceptance criteria ("Return null (NEVER NaN, Infinity, or dummy values like 180)").
- Existing workspace tests:
  - `pnpm test` executed 11 test files and 175 tests, all passing with exit code 0.
  - `pnpm --filter @kinesio/client exec tsc --noEmit` exits cleanly with code 0.

---

## 2. Logic Chain

### 2.1 Type Flow & Boundary Resolution (`@kinesio/shared` $\leftrightarrow$ `client/src/engine/`)
1. **Observation:** `@kinesio/shared` is a direct workspace dependency of `@kinesio/client` (`"@kinesio/shared": "workspace:*"` in `client/package.json`), already successfully consumed across `client/src/App.tsx`, `client/src/spikes/types.ts`, and `client/src/spikes/s2-transient/telemetryRunner.ts`.
2. **Observation:** `@kinesio/shared` contains telemetry and persistence contracts (`SquatPhase`, `SquatDepthRating`, `SquatTempo`, `Side`, `KinePosePayload`, `KineRepPayload`, `KineAlertPayload`, `VALGUS_THRESHOLD_PCT`, `VALGUS_COOLDOWN_MS`), but does NOT declare internal vision geometry structures (`Point3D`, `Point2D`, `StandingBaseline`, etc.).
3. **Reasoning:**
   - `client/src/engine/` must import shared types directly via `'@kinesio/shared'`.
   - Engine-internal types (`Point3D`, `Point2D`, `StandingBaseline`, `RepCounterState`, `RepCounterConfig`, `RepEvent`, `ValgusAlertEvent`) should be defined in `client/src/engine/` to avoid polluting the cross-service network contract in `@kinesio/shared`.
   - `client/src/engine/index.ts` should re-export both the engine-specific geometric types and the relevant shared biomechanics contracts (`Side`, `SquatPhase`, `SquatDepthRating`, `SquatTempo`, `KineRepPayload`, `KineAlertPayload`, etc.), providing a cohesive barrel export for consumers (UI HUD, workout history parser, test suites).

### 2.2 The Zero-DOM Architectural Boundary
1. **Observation:** In `vitest.config.ts`, `test.environment: 'node'`. No JSDOM or browser window mock is injected globally.
2. **Observation:** Biomechanical algorithms (`geometry.ts`, `smoothing.ts`, `repCounter.ts`) rely purely on mathematical vectors, dot products, trigonometry, digital filters, and state machine transition tables.
3. **Reasoning:**
   - If `client/src/engine/` imports `@mediapipe/tasks-vision` or references `window`, `document`, `navigator`, `HTMLVideoElement`, or `CanvasRenderingContext2D`, running unit tests (`tests/geometry.test.ts`, `tests/smoothing.test.ts`, `tests/repCounter.test.ts`) in the default `node` Vitest environment will crash with `ReferenceError`.
   - By declaring structural landmark interfaces in `client/src/engine/geometry.ts` (e.g., `{ x: number; y: number; z?: number; visibility?: number }`), MediaPipe outputs satisfy the type contract via structural subtyping without requiring `@mediapipe/tasks-vision` imports in the engine.
   - For timestamping: all state updates in `RepCounter` and filters should accept an explicit `timestamp: number` parameter (`update(landmarks, timestamp)`). If omitted in interactive browser execution, it can default to `performance.now()` (native in both Node.js $\ge 16$ and browser). This enables deterministic, frame-accurate test replay of synthetic fixture JSONs without mocking clocks or timers (`vi.useFakeTimers()`).

### 2.3 Modular Engine Layout Recommendations
To satisfy Day 3 requirements (R1–R4 in `ORIGINAL_REQUEST.md` and `docs/trd.md`), `client/src/engine/` should be structured as follows:

```
client/src/engine/
├── geometry.ts       # Pure vector math, 3D knee flexion, baseline calibration, valgus deviation, depth ratio
├── smoothing.ts      # 3-frame sliding median filter, EMA angle filter (alpha = 0.40)
├── repCounter.ts     # 5-phase FSM with hysteresis, shallow squat reversal, rep validation gate, valgus alerts
├── types.ts          # Internal geometric & engine types (or defined inline / exported)
└── index.ts          # Unified public engine API & re-exports
```

---

## 3. Detailed Architectural Specifications

### 3.1 Type Contracts & Imports

#### Imports in `client/src/engine/`
```typescript
import type {
  Side,
  SquatPhase,
  SquatDepthRating,
  SquatTempo,
  KineRepPayload,
  KineAlertPayload,
} from '@kinesio/shared';
import { VALGUS_THRESHOLD_PCT, VALGUS_COOLDOWN_MS } from '@kinesio/shared';
```

#### Engine-Internal Types (in `geometry.ts` / `repCounter.ts`)
```typescript
export interface Point3D {
  x: number;
  y: number;
  z: number;
  visibility?: number;
}

export interface Point2D {
  x: number;
  y: number;
  visibility?: number;
}

export interface PixelPoint2D {
  x: number;
  y: number;
  visibility?: number;
}

export interface StandingBaseline {
  legLengthL: number;
  legLengthR: number;
  hipY: { L: number; R: number; midpoint: number };
  kneeY: { L: number; R: number; midpoint: number };
  ankleY: { L: number; R: number; midpoint: number };
  imageWidth: number;
  imageHeight: number;
  calibratedAt: number;
}
```

---

### 3.2 Module Layout & Function Specifications

#### 1. `client/src/engine/geometry.ts`
- **Topology Keypoint Constants (BlazePose):**
  - Left Leg: `LEFT_HIP = 23`, `LEFT_KNEE = 25`, `LEFT_ANKLE = 27`
  - Right Leg: `RIGHT_HIP = 24`, `RIGHT_KNEE = 26`, `RIGHT_ANKLE = 28`
- **`compute3DKneeFlexion(hip: Point3D, knee: Point3D, ankle: Point3D): number | null`:**
  - Coordinates: metric 3D `worldLandmarks` in meters.
  - Vectors: $\mathbf{v}_1 = \mathbf{p}_{\text{hip}} - \mathbf{p}_{\text{knee}}$, $\mathbf{v}_2 = \mathbf{p}_{\text{ankle}} - \mathbf{p}_{\text{knee}}$.
  - Dot product formulation:
    $$\theta = \arccos\left(\text{clamp}\left(\frac{\mathbf{v}_1 \cdot \mathbf{v}_2}{\|\mathbf{v}_1\| \|\mathbf{v}_2\|}, -1, 1\right)\right) \times \frac{180}{\pi}$$
  - Guard conditions returning `null` (never `NaN`, `Infinity`, or dummy values like `180`):
    - Any coordinate is `NaN` or non-finite (`!isFinite(val)`).
    - Any landmark has `visibility !== undefined && visibility < 0.65`.
    - Either vector magnitude is degenerate: $\|\mathbf{v}_1\| \le 10^{-6}$ or $\|\mathbf{v}_2\| \le 10^{-6}$.
- **`calibrateStandingBaseline(landmarks: Point2D[], imageWidth: number, imageHeight: number): StandingBaseline | null`:**
  - Input: 2D normalized landmarks, camera frame dimensions $W, H$.
  - Scales to unmirrored camera pixel coordinates: $X = x \cdot W, Y = y \cdot H$.
  - Validates keypoint count $\ge 29$ and all 6 bilateral keypoints (23–28) have finite coordinates and $\text{visibility} \ge 0.65$.
  - Anatomical validation: In camera pixel space (where $Y$ increases downwards), standing posture requires $Y_{\text{ankle}} > Y_{\text{knee}} > Y_{\text{hip}}$ for both legs. If inverted or collapsed, return `null`.
  - Bilateral standing leg lengths:
    $$L_{\text{standing}}^L = \sqrt{(X_{aL} - X_{hL})^2 + (Y_{aL} - Y_{hL})^2}$$
    $$L_{\text{standing}}^R = \sqrt{(X_{aR} - X_{hR})^2 + (Y_{aR} - Y_{hR})^2}$$
  - Guard: If $L_{\text{standing}}^L \le 1.0$ or $L_{\text{standing}}^R \le 1.0$, return `null`.
- **`computeValgusDeviation(hip: PixelPoint2D, knee: PixelPoint2D, ankle: PixelPoint2D, standingLegLength: number, side: Side): number | null`:**
  - Guard: If $|Y_a - Y_h| \le 10^{-4}$ (vertical segment collapse) or $standingLegLength \le 10^{-4}$, return `null`.
  - Neutral frontal axis at current knee vertical position $Y_k$:
    $$X_{\text{baseline}} = X_h + (X_a - X_h) \times \frac{Y_k - Y_h}{Y_a - Y_h}$$
  - Polarity in unmirrored camera space:
    - Left Leg (sensor right, $X \approx 0.60$): medial movement decreases $X \implies \text{polarity} = -1$.
    - Right Leg (sensor left, $X \approx 0.40$): medial movement increases $X \implies \text{polarity} = +1$.
  - Signed Medial Deviation Percentage:
    $$\text{valgusDevPct} = \frac{\text{polarity} \times (X_k - X_{\text{baseline}})}{standingLegLength} \times 100$$
    *Invariant:* Inward medial collapse is positive ($+$); outward varus is negative ($-$).
- **`computeDepthRatio(currentHipY: number, standingHipY: number, standingKneeY: number): number | null`:**
  - Formula:
    $$\text{depthRatio} = \frac{Y_{\text{hip}}(t) - Y_{\text{hip}}(\text{standing})}{Y_{\text{knee}}(\text{standing}) - Y_{\text{hip}}(\text{standing})}$$
  - Guard: If $|Y_{\text{knee}}(\text{standing}) - Y_{\text{hip}}(\text{standing})| \le 10^{-4}$, return `null`.
  - Returns `0.0` at standing, `~1.0` at parallel squat, `> 1.0` below parallel.

---

#### 2. `client/src/engine/smoothing.ts`
- **`class MedianFilter` (3-Frame Sliding Window):**
  - Maintains rolling buffer of size 3 for scalar values.
  - Frame progression:
    - 1st frame $\to$ return raw value.
    - 2nd frame $\to$ return arithmetic mean of 2 values.
    - 3rd+ frame $\to$ return exact median (middle value of sorted 3-element buffer).
  - Tracking dropout: If input is `null`, buffer clears/resets and returns `null`.
  - Rejects single-frame coordinate spikes (e.g., $[10, 85, 12] \to 12$) without phase distortion.
- **`class EmaFilter` (Exponential Moving Average Angle Filter):**
  - Smoothing factor $\alpha = 0.40$.
  - Formula: $y_t = \alpha \cdot x_t + (1 - \alpha) \cdot y_{t-1}$.
  - Warm start: First valid frame initializes $y_0 = x_0$ (eliminates zero-start lag).
  - Missing frames: If input is `null`, maintains counter; resets to `null` after 3 consecutive missing frames.
  - Step-response latency: Step from 0 to 100 converges past 50% in $< 2$ frames ($< 50$ ms at 30 FPS).

---

#### 3. `client/src/engine/repCounter.ts`
- **State Machine Topology:**
  - Valid phases: `"standing" | "descending" | "bottom" | "ascending" | "lost"` (conforms to `SquatPhase`).
- **Hysteresis Transitions & Guards:**
  1. `standing` $\to$ `descending`: $\text{depthRatio} > 0.25$ OR $\theta_{\text{knee}} < 150^\circ$. Records `repStartTime = timestamp`, initializes `minKneeDeg = \theta_{\text{knee}}`, `maxDepthRatio = \text{depthRatio}`.
  2. `descending` $\to$ `bottom`: $\text{depthRatio} > 0.85$ OR $\theta_{\text{knee}} < 100^\circ$.
  3. `descending` $\to$ `ascending` *(Shallow Squat Reversal Deadlock Defense)*: Reversal detected ($\theta_{\text{knee}}$ increases by $> 10^\circ$ from minimum and $\text{depthRatio}$ decreases) WITHOUT reaching bottom threshold.
  4. `bottom` $\to$ `ascending`: $\theta_{\text{knee}} > 110^\circ$ AND $\text{depthRatio}$ is decreasing.
  5. `ascending` $\to$ `standing` *(Rep Validation Gate)*:
     - Trigger: $\theta_{\text{knee}} > 160^\circ$ AND $\text{depthRatio} < 0.20$.
     - Validation Logic:
       $$\text{duration} = \text{timestamp} - \text{repStartTime}$$
       - IF $\min(\theta_{\text{knee}}) \le 105^\circ$ AND $\text{duration} \ge 800$ ms:
         - Increment `reps` count.
         - Emit rep event: `depth: minKneeDeg <= 80 ? "deep" : "good"`, `durMs: duration`, `tempo: duration < 1200 ? "fast" : (duration <= 3500 ? "controlled" : "slow")`.
       - ELSE IF $\min(\theta_{\text{knee}}) > 105^\circ$: Mark shallow rep; rep count DOES NOT increment.
       - ELSE IF $\text{duration} < 800$ ms: Mark rapid bounce; rep count DOES NOT increment.
  6. Any phase $\to$ `lost`: Visibility $< 0.65$ or key landmarks missing.
  7. `lost` $\to$ previous/standing: Visibility restored $\ge 0.65$. If $\theta_{\text{knee}} > 160^\circ \to \text{"standing"}$. If mid-rep and dropout $< 1000$ ms $\to$ resume previous phase; if dropout $\ge 1000$ ms $\to$ reset to $\text{"standing"}$.
- **Valgus Alert Detector:**
  - Active ONLY during `descending` and `bottom` phases.
  - Triggers when $\text{valgusDevPct} > +8.0\%$ persists for $\ge 3$ consecutive frames.
  - Maintains **independent** 4000 ms cooldown timers for Left leg and Right leg ($T_{\text{lastAlert}}^L$ and $T_{\text{lastAlert}}^R$).
  - Emits form alert conforming to `KineAlertPayload` (`kind: "knee_valgus"`, `side`, `value`, `thresholdPct: 8.0`, `repN: reps + 1`, `phase`, `note: "Form alert (biomechanical feedback)"`).

---

#### 4. `client/src/engine/index.ts` (Barrel Export)
```typescript
// Re-export shared contracts
export type {
  Side,
  SquatPhase,
  SquatDepthRating,
  SquatTempo,
  KinePosePayload,
  KineRepPayload,
  KineAlertPayload,
} from '@kinesio/shared';
export { VALGUS_THRESHOLD_PCT, VALGUS_COOLDOWN_MS } from '@kinesio/shared';

// Export engine geometry
export {
  compute3DKneeFlexion,
  calibrateStandingBaseline,
  computeValgusDeviation,
  computeDepthRatio,
  type Point3D,
  type Point2D,
  type PixelPoint2D,
  type StandingBaseline,
} from './geometry.js';

// Export engine smoothing
export { MedianFilter, EmaFilter } from './smoothing.js';

// Export engine rep counter & state machine
export {
  RepCounter,
  type RepCounterConfig,
  type RepCounterFrameInput,
  type RepCounterState,
  type RepCompletedEvent,
  type ValgusAlertEvent,
} from './repCounter.js';
```

---

## 4. Test Strategy & Fixture Specification (`tests/`)

### 4.1 Synthetic Landmark Fixtures (`tests/fixtures/squats/`)
Each fixture is a deterministic JSON array of 30 FPS frames with structure:
```typescript
interface FixtureFrame {
  timestamp: number; // e.g. 0, 33, 67, 100... ms
  landmarks2D: Array<{ x: number; y: number; visibility?: number }>;
  worldLandmarks3D: Array<{ x: number; y: number; z: number; visibility?: number }>;
}
```
1. `normal_squat_5reps.json`: 5 complete cycles, depth $\theta_{\text{knee}} \approx 78^\circ - 85^\circ$, rep duration $\approx 2000$ ms, valgus $< 4\%$.
2. `valgus_squat.json`: Squat repetition where Left knee medial deviation reaches $+12.4\%$ for 5 consecutive frames during descent, followed by recovery.
3. `shallow_squat.json`: Squat reversing at $\theta_{\text{knee}} = 125^\circ$ ($\text{depthRatio} \approx 0.50$).
4. `fast_squat.json`: Squat completing in 500 ms ($< 800$ ms duration gate).
5. `occluded_jitter.json`: Stream with single-frame coordinate impulses and a 10-frame visibility dropout ($< 0.50$).

### 4.2 Test Suite Execution in Vitest
In `tests/geometry.test.ts`, `tests/smoothing.test.ts`, and `tests/repCounter.test.ts`:
- Import from `../client/src/engine/index.js` or `../client/src/engine/<file>.js`.
- Execute with:
  ```powershell
  pnpm vitest run tests/geometry.test.ts tests/smoothing.test.ts tests/repCounter.test.ts
  ```
- Because of the zero-DOM architecture, all test suites execute in the native `node` environment in $< 200$ ms with zero DOM mocking overhead.

---

## 5. Caveats
1. **Structural Landmark Indexing:** BlazePose 33-landmark indices (Left: 23, 25, 27; Right: 24, 26, 28) require that input landmark arrays have at least 29 elements. Any array with fewer than 29 elements must be handled safely by returning `null` (not crashing with `TypeError: cannot read property of undefined`).
2. **Camera Inversion:** Valgus deviation polarity is calibrated for unmirrored camera space ($X \approx 0.60$ for Left leg on sensor right, $X \approx 0.40$ for Right leg on sensor left). If a consumer mirrors the video stream prior to landmark extraction, $X$ coordinates would be flipped. The contract assumes standard unmirrored camera coordinates as specified in TRD Section 3.
3. **No Code Modifications Outside Working Directory:** In accordance with the Explorer persona and dispatch rules, this survey investigated and documented the architecture without modifying any code outside `teamwork_preview_explorer_d3_survey_1/`.

---

## 6. Conclusion
The workspace is cleanly structured and ready for Day 3 engine implementation.
1. All network biomechanics contracts are already established in `@kinesio/shared` and can be imported directly into `client/src/engine/`.
2. A strict zero-DOM boundary ensures that `client/src/engine/` is decoupled from `@mediapipe/tasks-vision`, React, and browser globals, enabling deterministic, high-speed execution under Vitest in the `'node'` environment.
3. The recommended module architecture (`geometry.ts`, `smoothing.ts`, `repCounter.ts`, `index.ts`) directly implements R1–R3 mathematical formulations, hysteresis transitions, and acceptance criteria with zero crash-site masking.

---

## 7. Verification Method
An independent agent or reviewer can verify this survey by:
1. Verifying workspace package linkages and TypeScript settings:
   ```powershell
   pnpm --filter @kinesio/client exec tsc --noEmit
   ```
   *Expected result: Exits with code 0.*
2. Verifying existing Vitest test suite in `'node'` environment:
   ```powershell
   pnpm test
   ```
   *Expected result: 11 test files, 175 tests pass with code 0.*
3. Inspecting `shared/src/index.ts` to confirm the 22 exported contract symbols.
4. Inspecting `client/src/` to confirm absence of `client/src/engine/` and readiness for scaffolding.
