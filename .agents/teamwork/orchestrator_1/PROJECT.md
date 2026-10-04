# Project: KinesioLive Biomechanical Kinematics Engine (Day 3: D3.1–D3.5)

## Architecture
A decoupled, zero-DOM biomechanical kinematics engine executing in `client/src/engine/` accompanied by 30 FPS BlazePose landmark fixtures in `tests/fixtures/squats/` and non-tautological Vitest test suites in `tests/`.

### Architectural Principles & Boundaries
1. **Zero-DOM Isolation:**
   - `client/src/engine/` has zero imports of `@mediapipe/tasks-vision`, React, or browser globals (`window`, `document`, `navigator`, `HTMLVideoElement`, `CanvasRenderingContext2D`).
   - All functions consume plain TypeScript interfaces (`Point3D`, `Point2D`, `StandingBaseline`, etc.).
   - Explicit timestamps are injected to enable 100% deterministic offline replay in Node.js / Vitest.
2. **Dual Coordinate Space Separation:**
   - 3D Metric Coordinates (`worldLandmarks`): $(x, y, z)$ in meters centered at hip midpoint. Used exclusively for 3D sagittal knee flexion angle ($\theta_{\text{knee}}$).
   - 2D Unmirrored Pixel Coordinates (`landmarks`): $(X = x \cdot W, Y = y \cdot H)$. Used for standing calibration, frontal knee valgus deviation percentage, and vertical hip depth ratio.
3. **Rigorous Defense & Safety:**
   - Return `null` (never `NaN`, `Infinity`, or dummy values like `180`) on degenerate vectors ($\|\mathbf{v}\| \le 10^{-6}$), non-finite coordinates, or visibility $< 0.65$.
   - Frontal axis vertical division guard: return `null` if $|Y_a - Y_h| \le 10^{-4}$.
   - Depth ratio span guard: return `0.0` if $|Y_k^{\text{stand}} - Y_h^{\text{stand}}| \le 10^{-4}$.
4. **Frontal Valgus Polarity Invariant:**
   - Left Leg (Sensor Right, $X \approx 0.60$): Medial collapse moves toward body midline (decreasing $X$): $\text{polarity} = -1$.
   - Right Leg (Sensor Left, $X \approx 0.40$): Medial collapse moves toward body midline (increasing $X$): $\text{polarity} = +1$.
   - Medial collapse ALWAYS yields strictly positive percentage ($+$); outward varus bow-leg yields negative percentage ($-$).

---

## Feature Inventory
| # | Feature | Description | Milestone | Source | Status |
|---|---------|-------------|-----------|--------|--------|
| 1 | 3D Knee Flexion (`compute3DKneeFlexion`) | Computes sagittal knee angle via vector dot product from metric 3D landmarks with strict null guards | M1 | R1, TRD §3 | DONE |
| 2 | Standing Baseline (`calibrateStandingBaseline`) | Calibrates standing bilateral leg lengths and hip/knee heights with 6-keypoint anatomical ordering validation | M1 | R1, TRD §3 | DONE |
| 3 | Frontal Knee Valgus (`computeValgusDeviation`) | Computes signed medial deviation percentage relative to calibrated standing leg length with polarity correction | M1 | R1, TRD §3 | DONE |
| 4 | Normalized Depth Ratio (`computeDepthRatio`) | Computes hip descent relative to standing vertical span ($0.0 \to 1.0+$) with zero-span guard | M1 | R1, TRD §3 | DONE |
| 5 | Sliding Median Filter (`SlidingMedianFilter`) | 3-frame rolling buffer filter rejecting single-frame impulse spikes; resets on null | M2 | R2 | DONE |
| 6 | EMA Angle Filter (`ExponentialMovingAverageFilter`) | Exponential moving average ($\alpha = 0.40$) for digit flicker elimination with $< 50$ ms step latency; resets on 3 missing frames | M2 | R2 | DONE |
| 7 | Deterministic Rep Counter FSM (`RepCounterStateMachine`) | 5-phase hysteresis state machine (`standing`, `descending`, `bottom`, `ascending`, `lost`) | M3 | R3, TRD §3 | DONE |
| 8 | Shallow Squat Reversal Path | Dynamic reversal transition `descending` $\to$ `ascending` preventing FSM deadlock | M3 | R3 | DONE |
| 9 | Rapid Bounce Gate | Rep duration validation ($< 800$ ms) preventing fast bounce repetition counts | M3 | R3 | DONE |
| 10 | Valgus Form Alert Detector | Active during `descending` & `bottom`; triggers if valgus $> +8.0\%$ for $\ge 3$ consecutive frames | M3 | R3, Shared | DONE |
| 11 | Independent Cooldown Timers | Independent 4000 ms cooldown timers per leg (`L` and `R`) for valgus form alerts | M3 | R3, Shared | DONE |
| 12 | Tracking Dropout Recovery | Handles visibility dropout $< 0.65$; recovers if $< 1000$ ms, resets to standing if $\ge 1000$ ms | M3 | R3 | DONE |
| 13 | 30 FPS BlazePose Squat Fixtures | 5 realistic 30 FPS synthetic/recorded JSON streams in `tests/fixtures/squats/` | M4 | R4 | DONE |
| 14 | Geometry Vitest Suite | Unit tests in `tests/geometry.test.ts` asserting 3D angles, degenerate vectors, calibration, valgus polarity | M4 | R4, Testing §2 | DONE |
| 15 | Smoothing Vitest Suite | Unit tests in `tests/smoothing.test.ts` asserting impulse spike rejection and EMA step response latency | M4 | R4, Testing §2 | DONE |
| 16 | Rep Counter Vitest Suite | Integration tests in `tests/repCounter.test.ts` asserting 5 completed reps, shallow squat rejection, bounce rejection, valgus alerts, and recovery | M4 | R4, Testing §2 | DONE |

---

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | Mathematical Geometry Engine | `client/src/engine/geometry.ts`: `compute3DKneeFlexion`, `calibrateStandingBaseline`, `computeValgusDeviation`, `computeDepthRatio` | none | DONE |
| 2 | Kinematic Signal Filter | `client/src/engine/smoothing.ts`: `SlidingMedianFilter`, `ExponentialMovingAverageFilter` | none | DONE |
| 3 | Deterministic Rep Counter FSM | `client/src/engine/repCounter.ts`, `client/src/engine/index.ts`: 5-phase FSM, shallow reversal, valgus detector, barrel export | M1, M2 | DONE |
| 4 | BlazePose Fixtures & Vitest Suites | `tests/fixtures/squats/*.json`, `tests/geometry.test.ts`, `tests/smoothing.test.ts`, `tests/repCounter.test.ts` | M1, M2, M3 | DONE |
| 5 | Monorepo Verification Triad & Forensic Victory Audit | Monorepo typecheck, test execution, zero-secret scan, forensic integrity verification | M1, M2, M3, M4 | DONE |

---

## Code Layout
```
d:\TP\Hackathon\Cometchat\
├── client/
│   └── src/
│       └── engine/
│           ├── geometry.ts
│           ├── smoothing.ts
│           ├── repCounter.ts
│           └── index.ts
└── tests/
    ├── fixtures/
    │   └── squats/
    │       ├── normal_squat_5reps.json
    │       ├── valgus_squat.json
    │       ├── shallow_squat.json
    │       ├── fast_squat.json
    │       └── occluded_jitter.json
    ├── geometry.test.ts
    ├── smoothing.test.ts
    └── repCounter.test.ts
```
