# Authoritative Kinematics & Biomechanics Specification Report (Day 3: D3.1–D3.5)

**Author:** `spec_miner_d3_survey_2` (Biomechanics & Kinematics Specification Specialist)  
**Date:** 2026-10-04  
**Target Modules:** `client/src/engine/geometry.ts`, `client/src/engine/smoothing.ts`, `client/src/engine/repCounter.ts`  
**Authoritative Sources:** `ORIGINAL_REQUEST.md`, `docs/trd.md` (§2 & §3), `docs/testing.md` (§2), `shared/src/index.ts`

---

## 1. Observation

Direct examination of ground-truth sources (`ORIGINAL_REQUEST.md` lines 10–116, `docs/trd.md` lines 57–155, `docs/testing.md` lines 37–46, and `shared/src/index.ts` lines 1–134) reveals the following structural, mathematical, and algorithmic requirements:

1. **Topology & Landmark Format:**
   - MediaPipe BlazePose 33-keypoint standard:
     - Left Leg: Hip = `23`, Knee = `25`, Ankle = `27`.
     - Right Leg: Hip = `24`, Knee = `26`, Ankle = `28`.
   - Two distinct coordinate systems:
     - Metric 3D `worldLandmarks`: Coordinates $(x, y, z)$ in meters relative to human body center of mass. Used exclusively for sagittal knee flexion angle $\theta_{\text{knee}}$.
     - Normalized 2D `landmarks`: Image-relative coordinates $(x, y)$ in $[0, 1]$. Multiplied by image width $W$ and height $H$ to obtain unmirrored camera pixel coordinates $(X = x \cdot W, Y = y \cdot H)$. Used for calibration, frontal knee valgus deviation, and vertical hip depth ratio.

2. **3D Sagittal Knee Flexion (`compute3DKneeFlexion`):**
   - Vectors:
     $$\mathbf{v}_1 = \mathbf{p}_{\text{hip}} - \mathbf{p}_{\text{knee}} = (x_h - x_k, y_h - y_k, z_h - z_k)$$
     $$\mathbf{v}_2 = \mathbf{p}_{\text{ankle}} - \mathbf{p}_{\text{knee}} = (x_a - x_k, y_a - y_k, z_a - z_k)$$
   - Formulation:
     $$\cos(\theta) = \frac{\mathbf{v}_1 \cdot \mathbf{v}_2}{\|\mathbf{v}_1\| \|\mathbf{v}_2\|}$$
     $$\theta = \arccos\left(\text{clamp}(\cos(\theta), -1.0, 1.0)\right) \times \frac{180}{\pi}$$
   - Safety Invariants: Returns `null` (NEVER `NaN`, `Infinity`, or dummy placeholder like `180`):
     - If any coordinate is non-finite (`isNaN` or `!Number.isFinite`).
     - If landmark `visibility` is present and $< 0.65$.
     - If either vector magnitude is degenerate: $\|\mathbf{v}_1\| \le 10^{-6}$ or $\|\mathbf{v}_2\| \le 10^{-6}$.

3. **Standing Baseline Calibration (`calibrateStandingBaseline`):**
   - Requires all 6 bilateral keypoints (`[23, 24, 25, 26, 27, 28]`) with `visibility >= 0.65`.
   - Converts to unmirrored camera pixels: $X = x \cdot W, Y = y \cdot H$.
   - Anatomical Orientation Invariant (camera Y increases downwards):
     $$Y_{\text{ankle}} > Y_{\text{knee}} > Y_{\text{hip}} \quad \text{for both Left } (27 > 25 > 23) \text{ and Right } (28 > 26 > 24)$$
   - Bilateral Standing Leg Lengths:
     $$L_{\text{standing}}^L = \sqrt{(X_{27} - X_{23})^2 + (Y_{27} - Y_{23})^2}$$
     $$L_{\text{standing}}^R = \sqrt{(X_{28} - X_{24})^2 + (Y_{28} - Y_{24})^2}$$
   - Midpoint Standing Heights:
     $$Y_{\text{hip}}^{\text{standing}} = \frac{Y_{23} + Y_{24}}{2}, \quad Y_{\text{knee}}^{\text{standing}} = \frac{Y_{25} + Y_{26}}{2}$$

4. **Frontal Knee Valgus Deviation (`computeValgusDeviation`):**
   - Current Neutral Frontal Axis at knee height $Y_k$:
     $$X_{\text{baseline}} = X_h + (X_a - X_h) \times \frac{Y_k - Y_h}{Y_a - Y_h}$$
   - Guard: If $|Y_a - Y_h| \le 10^{-4}$, return `null` (prevents vertical division-by-zero).
   - Unmirrored Polarity Invariant:
     - Left Leg (Sensor Right, $X \approx 0.60$): Medial collapse moves toward body midline (decreasing $X$): $\text{polarity} = -1$.
     - Right Leg (Sensor Left, $X \approx 0.40$): Medial collapse moves toward body midline (increasing $X$): $\text{polarity} = +1$.
   - Percentage Formula:
     $$\text{valgusDevPct} = \frac{\text{polarity} \times (X_k - X_{\text{baseline}})}{L_{\text{standing}}^{\text{side}}} \times 100$$
   - Sign Convention: Strictly positive ($+$) for medial inward collapse; strictly negative ($-$) for outward varus bow-leg.

5. **Normalized Hip Depth Ratio (`computeDepthRatio`):**
   $$\text{depthRatio} = \frac{Y_{\text{hip}}(t) - Y_{\text{hip}}^{\text{standing}}}{Y_{\text{knee}}^{\text{standing}} - Y_{\text{hip}}^{\text{standing}}}$$
   - Guard: $|Y_{\text{knee}}^{\text{standing}} - Y_{\text{hip}}^{\text{standing}}| \le 10^{-4} \implies \text{return } 0.0$.
   - Characteristics: $0.0$ at upright standing; $\approx 1.0$ at parallel squat crease; $> 1.0$ below parallel.

6. **Kinematic Signal Filters (`smoothing.ts`):**
   - `SlidingMedianFilter`: Window size 3. Frame 1 $\to$ raw; Frame 2 $\to$ average; Frame 3+ $\to$ median. Resets buffer on `null` input.
   - `ExponentialMovingAverageFilter`: Smoothing factor $\alpha = 0.40$. Formula $y_t = \alpha \cdot x_t + (1 - \alpha) \cdot y_{t-1}$. Step latency $< 50$ ms at 30 FPS. Resets after 3 consecutive missing/null frames.

7. **Rep Counter FSM & Valgus Detector (`repCounter.ts`):**
   - States: `"standing" | "descending" | "bottom" | "ascending" | "lost"`.
   - Transitions:
     - `standing` $\to$ `descending`: $\text{depthRatio} > 0.25$ OR $\theta_{\text{knee}} < 150^\circ$.
     - `descending` $\to$ `bottom`: $\text{depthRatio} > 0.85$ OR $\theta_{\text{knee}} < 100^\circ$.
     - `descending` $\to$ `ascending`: Reversal path ($\theta_{\text{knee}} > \min + 10^\circ$ and $\text{depthRatio}$ decreasing) without reaching bottom.
     - `bottom` $\to$ `ascending`: $\theta_{\text{knee}} > 110^\circ$ AND $\text{depthRatio}$ decreasing.
     - `ascending` $\to$ `standing`: $\theta_{\text{knee}} > 160^\circ$ AND $\text{depthRatio} < 0.20$.
   - Rep Validation Gate:
     - Valid Rep: $\min(\theta_{\text{knee}}) \le 105^\circ$ AND $\text{durMs} \ge 800$ ms $\implies \text{reps}++$. Emits `kine.rep` (`depth: "deep"` if $\le 80^\circ$ else `"good"`; `tempo: "fast"` if $< 1200$ ms, `"controlled"` if $1200 \le \text{durMs} \le 3500$, `"slow"` if $> 3500$).
     - Shallow Squat: $\min(\theta_{\text{knee}}) > 105^\circ \implies$ rep count does NOT increment.
     - Rapid Bounce: $\text{durMs} < 800$ ms $\implies$ rep count does NOT increment.
   - Dropout / `lost` handling:
     - Visibility $< 0.65$ or keypoint dropout $\implies$ transition to `"lost"`.
     - Visibility restored: if upright ($\theta_{\text{knee}} > 160^\circ$), transition to `"standing"`. If mid-rep and dropout $< 1000$ ms, resume previous phase. If dropout $\ge 1000$ ms, reset rep to `"standing"`.
   - Valgus Alert Detector:
     - Active ONLY during `descending` and `bottom` phases.
     - Condition: $\text{valgusDevPct} > +8.0\%$ for $\ge 3$ consecutive frames.
     - Cooldown: Independent 4000 ms cooldown timers per leg (`L` and `R`).
     - Emits `KineAlertPayload` (`kind: "knee_valgus"`).

---

## 2. Logic Chain

1. **Sagittal Angle Grounding:**
   - In biomechanics, knee flexion is defined in 3D Euclidean space. Using 2D camera pixels for knee flexion produces severe foreshortening distortion when the camera angle is tilted or when the femur moves toward/away from the camera plane.
   - MediaPipe's `worldLandmarks` provide metric 3D coordinates $(x, y, z)$ in meters centered at the hips. The 3D dot product between hip-knee vector $\mathbf{v}_1$ and ankle-knee vector $\mathbf{v}_2$ gives the true anatomical angle.
   - When a person is standing upright with knee extended, vectors $\mathbf{v}_1 = \mathbf{p}_h - \mathbf{p}_k$ and $\mathbf{v}_2 = \mathbf{p}_a - \mathbf{p}_k$ point in opposite directions along the leg axis ($\mathbf{v}_1 \approx [0, -L_1, 0]$, $\mathbf{v}_2 \approx [0, +L_2, 0]$). Their dot product is negative: $\mathbf{v}_1 \cdot \mathbf{v}_2 \approx -\|\mathbf{v}_1\| \|\mathbf{v}_2\|$, yielding $\cos(\theta) \approx -1.0$ and $\theta = \arccos(-1.0) \times \frac{180}{\pi} = 180^\circ$.
   - As the knee bends, the vectors fold towards each other. At 90 degrees flexion, the vectors are orthogonal: $\mathbf{v}_1 \cdot \mathbf{v}_2 = 0$, yielding $\theta = 90^\circ$.
   - If either landmark collapses onto another ($\|\mathbf{v}\| \le 10^{-6}$), the vector direction is undefined. Returning `null` rather than a dummy value (e.g. `180` in the spike) prevents false state transitions. Clamping to $[-1.0, 1.0]$ prevents IEEE 754 precision leakage where $|1.0000000000000002| > 1$ generates `NaN`.

2. **Frontal Valgus Polarity Grounding:**
   - In an unmirrored camera stream, the subject's Left leg is seen by the sensor on the viewer's right side (higher $X$, normalized $x \approx 0.55 - 0.65$). The subject's Right leg is seen on the viewer's left side (lower $X$, normalized $x \approx 0.35 - 0.45$).
   - The body midline is between the legs ($x \approx 0.50$).
   - When the Left knee collapses medially (inwards toward midline), the knee moves to the left in the camera frame, so $X_k$ decreases, making $X_k - X_{\text{baseline}} < 0$. To represent inward collapse as positive valgus, we apply $\text{polarity}_L = -1$, yielding $-1 \cdot (X_k - X_{\text{baseline}}) > 0$.
   - When the Right knee collapses medially (inwards toward midline), the knee moves to the right in the camera frame, so $X_k$ increases, making $X_k - X_{\text{baseline}} > 0$. Applying $\text{polarity}_R = +1$ yields $+1 \cdot (X_k - X_{\text{baseline}}) > 0$.
   - Therefore, medial inward collapse is invariant positive ($+$) on BOTH legs. Outward varus movement produces negative ($-$) values. Normalizing by calibrated standing leg length $L_{\text{standing}}$ produces a scale-invariant percentage independent of camera distance.

3. **Frontal Axis Geometry Grounding:**
   - The neutral frontal axis line connects hip $(X_h, Y_h)$ to ankle $(X_a, Y_a)$.
   - Parametric line equation: $\mathbf{P}(t) = \mathbf{P}_h + t (\mathbf{P}_a - \mathbf{P}_h)$.
   - At the knee's vertical position $Y_k$, parameter $t = \frac{Y_k - Y_h}{Y_a - Y_h}$.
   - Substituting $t$ into $X$ yields $X_{\text{baseline}} = X_h + (X_a - X_h) \frac{Y_k - Y_h}{Y_a - Y_h}$.
   - If $Y_a = Y_h$, the leg segment is horizontal, meaning the subject is prone, supine, or heavily occluded. A guard $|Y_a - Y_h| \le 10^{-4}$ prevents division by zero and returns `null`.

4. **Depth Ratio Calibration Grounding:**
   - In standing calibration, standing hip height $Y_h^{\text{standing}}$ and knee height $Y_k^{\text{standing}}$ define the anatomical vertical thigh span $\Delta Y = Y_k^{\text{standing}} - Y_h^{\text{standing}} > 0$.
   - During squat descent, the pelvis descends toward the floor (increasing $Y$ in camera coordinates).
   - $\text{depthRatio} = \frac{Y_h(t) - Y_h^{\text{standing}}}{Y_k^{\text{standing}} - Y_h^{\text{standing}}}$.
   - At standing: $Y_h(t) = Y_h^{\text{standing}} \implies \text{depthRatio} = 0.0$.
   - When hip crease reaches knee height: $Y_h(t) = Y_k^{\text{standing}} \implies \text{depthRatio} = 1.0$ (parallel squat).
   - Below parallel: $Y_h(t) > Y_k^{\text{standing}} \implies \text{depthRatio} > 1.0$.

5. **Filter Latency & Step Response Grounding:**
   - At 30 FPS, frame interval $T = 33.33$ ms.
   - For an EMA filter with $\alpha = 0.40$:
     - Frame 0: $y_0 = 0$
     - Frame 1 ($t = 33.3$ ms): $y_1 = 0.40(100) + 0.60(0) = 40.0$
     - Frame 2 ($t = 66.7$ ms): $y_2 = 0.40(100) + 0.60(40.0) = 64.0$
     - The continuous 50% rise time $t_{50\%} = \frac{\ln(1 - 0.5)}{\ln(1 - \alpha)} \cdot T = \frac{-0.69315}{-0.51083} \times 33.33 \text{ ms} \approx 45.23 \text{ ms} < 50 \text{ ms}$.
     - This mathematically proves that $\alpha = 0.40$ satisfies the latency invariant $< 50$ ms while attenuating frame-to-frame digitization jitter.

6. **Rep Counter Deadlock Prevention Grounding:**
   - Standard 3-phase state machines (`standing` $\to$ `descending` $\to$ `ascending`) deadlock if a user begins a squat, only reaches $125^\circ$ knee flexion (a shallow squat), and reverses back up without hitting the $100^\circ$ bottom threshold.
   - Without a shallow reversal transition, the FSM remains stuck in `descending` indefinitely.
   - Introducing transition 3 (`descending` $\to$ `ascending` on $\theta_{\text{knee}} > \min(\theta) + 10^\circ$ and $\text{depthRatio}$ decreasing) allows the FSM to track the upward motion back to `standing`. At the `ascending` $\to$ `standing` gate, the condition $\min(\theta_{\text{knee}}) \le 105^\circ$ evaluates to false, correctly rejecting the rep without deadlocking.

---

## 3. Features Discovered

| # | Category | Feature | Description | Inputs | Outputs | Error Behavior | Discovered Via |
|---|----------|---------|-------------|--------|---------|----------------|----------------|
| 1 | Geometry | `compute3DKneeFlexion` | Computes 3D sagittal knee angle from metric `worldLandmarks` | Hip, Knee, Ankle 3D coordinates $(x,y,z)$ + optional visibility | Angle in $[0^\circ, 180^\circ]$ | Returns `null` if degenerate ($\|\mathbf{v}\| \le 10^{-6}$), non-finite, or $\text{vis} < 0.65$ | `ORIGINAL_REQUEST.md` R1, `docs/trd.md` §3 |
| 2 | Geometry | `calibrateStandingBaseline` | Calibrates neutral standing leg lengths and hip/knee heights | 2D normalized landmarks, image width $W$, image height $H$ | `StandingBaseline` object | Returns `null` if any of 6 keypoints $\text{vis} < 0.65$ or $Y_a \le Y_k$ or $Y_k \le Y_h$ | `ORIGINAL_REQUEST.md` R1, `docs/trd.md` §3 |
| 3 | Geometry | `computeValgusDeviation` | Frontal knee valgus deviation % relative to standing leg length | Current 2D $(X,Y)$ hip/knee/ankle, `StandingBaseline`, side (`"L"` \| `"R"`) | Signed deviation percentage (e.g. $+11.2\%$) | Returns `null` if $\|Y_a - Y_h\| \le 10^{-4}$, $L_{\text{standing}} \le 10^{-4}$, or non-finite | `ORIGINAL_REQUEST.md` R1, `docs/trd.md` §3 |
| 4 | Geometry | `computeDepthRatio` | Normalized pelvic descent ratio relative to standing vertical span | Current hip $Y$ coordinate, `StandingBaseline` | Depth ratio ($0.0 \to 1.0+$) | Returns `0.0` or guards if vertical span $\le 10^{-4}$ | `ORIGINAL_REQUEST.md` R1, `docs/trd.md` §3 |
| 5 | Smoothing | `SlidingMedianFilter` | 3-frame rolling median filter for scalar signals | Scalar number (or `null`) | Filtered scalar number (or `null`) | Buffer cleared/reset on `null` input; 1st frame raw, 2nd avg, 3rd+ median | `ORIGINAL_REQUEST.md` R2 |
| 6 | Smoothing | `ExponentialMovingAverageFilter` | EMA filter with $\alpha = 0.40$ for angular stabilization | Scalar number (or `null`) | Filtered scalar number (or `null`) | State resets after 3 consecutive missing/`null` frames; latency $< 50$ ms | `ORIGINAL_REQUEST.md` R2 |
| 7 | Rep Counter | `RepCounterStateMachine` | Hysteresis FSM with 5 phases (`standing`, `descending`, `bottom`, `ascending`, `lost`) | Frame telemetry ($\theta_{\text{knee}}$, `depthRatio`, `valgusDevPct`, visibility, timestamp) | Current `SquatPhase`, `reps` count, events (`kine.rep`, `kine.alert`) | Shallow squats and fast bounces rejected; deadlocks prevented via reversal path | `ORIGINAL_REQUEST.md` R3, `docs/trd.md` §3 |
| 8 | Rep Counter | Shallow Squat Reversal | Dynamic reversal transition `descending` $\to$ `ascending` | $\theta_{\text{knee}} > \min + 10^\circ$ and $\text{depthRatio}$ decreasing | Transition to `ascending` phase | Rep rejected at standing gate ($\min > 105^\circ$) | `ORIGINAL_REQUEST.md` R3 |
| 9 | Rep Counter | Rapid Bounce Gate | Rep duration validation ($< 800$ ms) | `repDurationMs = t_end - t_start` | Flagged as rapid bounce; rep not incremented | Rep discarded | `ORIGINAL_REQUEST.md` R3 |
| 10 | Rep Counter | Valgus Alert Detector | Active during `descending` and `bottom`; fires if valgus $> +8.0\%$ for $\ge 3$ frames | `valgusDevPct`, current phase, timestamp | Emits `KineAlertPayload` (`kind: "knee_valgus"`) | Suppressed during `standing` and `ascending`; 4000 ms independent cooldown per leg | `ORIGINAL_REQUEST.md` R3, `shared/src/index.ts` |
| 11 | Rep Counter | Independent Cooldown Timers | Separate 4000 ms timers for Left and Right legs | Leg side, timestamp | Independent alert throttling | Firing Left alert does not block Right alert | `ORIGINAL_REQUEST.md` R3, `docs/testing.md` |
| 12 | Rep Counter | Tracking Dropout Recovery | Handles visibility $< 0.65$ with transient resume vs reset | Visibility, timestamp | Transition to `lost`, resume or reset | Resumes if dropout $< 1000$ ms; resets to `standing` if $\ge 1000$ ms | `ORIGINAL_REQUEST.md` R3 |

---

## 4. Edge Cases & Boundary Conditions

| # | Feature | Input / Condition | Observed / Required Behavior |
|---|---------|-------------------|-----------------------------|
| 1 | `compute3DKneeFlexion` | Degenerate vector: hip coincident with knee ($\|\mathbf{v}_1\| \le 10^{-6}$) | Returns `null` (NEVER `NaN`, `Infinity`, or `180`). |
| 2 | `compute3DKneeFlexion` | Ankle coincident with knee ($\|\mathbf{v}_2\| \le 10^{-6}$) | Returns `null`. |
| 3 | `compute3DKneeFlexion` | Any coordinate is `NaN`, `undefined`, or `Infinity` | Returns `null`. |
| 4 | `compute3DKneeFlexion` | Landmark visibility $< 0.65$ (e.g. $0.64$) | Returns `null`. |
| 5 | `compute3DKneeFlexion` | Collinear straight leg ($\cos \theta = -1.0$) | Yields exactly $180.0^\circ \pm 0.1^\circ$. |
| 6 | `compute3DKneeFlexion` | Orthogonal leg segment ($\cos \theta = 0.0$) | Yields exactly $90.0^\circ \pm 0.1^\circ$. |
| 7 | `compute3DKneeFlexion` | Floating point overshoot ($\cos \theta = 1.0000000000000002$) | Clamped to $1.0$ before `Math.acos`, yields $0.0^\circ$ (not `NaN`). |
| 8 | `calibrateStandingBaseline` | Any of keypoints 23..28 missing or $\text{vis} < 0.65$ | Returns `null`. |
| 9 | `calibrateStandingBaseline` | Inverted person / handstand ($Y_a < Y_k$ or $Y_k < Y_h$) | Returns `null` (fails anatomical ordering check). |
| 10 | `calibrateStandingBaseline` | Person lying flat on floor ($Y_a \approx Y_k \approx Y_h$) | Returns `null`. |
| 11 | `calibrateStandingBaseline` | Zero or negative image dimensions ($W \le 0$ or $H \le 0$) | Returns `null`. |
| 12 | `computeValgusDeviation` | Subject horizontal / segment collapsed ($|Y_a - Y_h| \le 10^{-4}$) | Returns `null` (safely guards division by zero). |
| 13 | `computeValgusDeviation` | Left leg inward medial collapse ($X_k$ decreases) | Yields positive percentage: $\text{valgusDevPct} > 0$. |
| 14 | `computeValgusDeviation` | Right leg inward medial collapse ($X_k$ increases) | Yields positive percentage: $\text{valgusDevPct} > 0$. |
| 15 | `computeValgusDeviation` | Outward bow-leg varus posture on either leg | Yields negative percentage: $\text{valgusDevPct} < 0$. |
| 16 | `computeValgusDeviation` | Perfectly neutral alignment ($X_k = X_{\text{baseline}}$) | Yields $0.0\% \pm 0.1\%$. |
| 17 | `computeDepthRatio` | Standing baseline position ($Y_h(t) = Y_h^{\text{standing}}$) | Yields $0.0$. |
| 18 | `computeDepthRatio` | Thigh horizontal / parallel crease ($Y_h(t) = Y_k^{\text{standing}}$) | Yields $\approx 1.0$. |
| 19 | `computeDepthRatio` | Deep squat below parallel ($Y_h(t) > Y_k^{\text{standing}}$) | Yields $> 1.0$ (e.g. $1.15$). |
| 20 | `computeDepthRatio` | Standing vertical span degenerate ($|Y_k^{\text{stand}} - Y_h^{\text{stand}}| \le 10^{-4}$) | Returns `0.0` safely. |
| 21 | `SlidingMedianFilter` | Single frame impulse noise $[10, 85, 12]$ | Frame 1: $10$, Frame 2: $47.5$, Frame 3: $12.0$ (85 spike is annihilated). |
| 22 | `SlidingMedianFilter` | Tracking dropout: input receives `null` | Buffer cleared; returns `null`. Next valid frame returns raw value. |
| 23 | `EMA Filter` | Step input from 0 to 100 at 30 FPS | Frame 1: $40$, Frame 2: $64$; reaches $> 50\%$ in $< 50$ ms. |
| 24 | `EMA Filter` | 1 or 2 consecutive `null` frames | Returns `null`, internal smoothed state retained. |
| 25 | `EMA Filter` | 3 consecutive `null` frames | Internal state fully reset; subsequent valid frame starts raw. |
| 26 | `RepCounter` | Shallow squat reversing at $\theta_{\text{knee}} = 125^\circ$ | Reversal path triggers `descending` $\to$ `ascending`; rep gate rejects ($\min > 105^\circ$); `reps` count remains $0$. |
| 27 | `RepCounter` | Rapid bounce completing in $500$ ms | Rep gate rejects ($\text{durMs} < 800$ ms); `reps` count remains $0$. |
| 28 | `RepCounter` | Left valgus exceeds $+10\%$ for only 2 frames, then recovers | No alert emitted (requires $\ge 3$ consecutive frames). |
| 29 | `RepCounter` | Left valgus persists $> +8\%$ for 10 consecutive frames | Exactly 1 alert emitted at frame 3; subsequent frames in window throttled by 4000 ms cooldown. |
| 30 | `RepCounter` | Right valgus $> +8\%$ occurs 1500 ms after Left valgus alert | Right alert FIRES immediately (independent cooldown per leg). |
| 31 | `RepCounter` | Transient occlusion during descent ($< 1000$ ms) | Transitions to `lost`, resumes `descending` upon recovery. |
| 32 | `RepCounter` | Long occlusion during descent ($\ge 1000$ ms) | Transitions to `lost`, resets rep state to `standing` upon recovery. |

---

## 5. Authoritative Mathematical Specifications

### 5.1 Sagittal 3D Knee Flexion (`compute3DKneeFlexion`)

```typescript
export interface Landmark3D {
  x: number;
  y: number;
  z: number;
  visibility?: number;
}

export function compute3DKneeFlexion(
  hip: Landmark3D | null | undefined,
  knee: Landmark3D | null | undefined,
  ankle: Landmark3D | null | undefined
): number | null {
  // 1. Boundary & Visibility Guards
  if (!hip || !knee || !ankle) return null;
  if (hip.visibility !== undefined && hip.visibility < 0.65) return null;
  if (knee.visibility !== undefined && knee.visibility < 0.65) return null;
  if (ankle.visibility !== undefined && ankle.visibility < 0.65) return null;

  // 2. Coordinate Finite Guards
  if (
    !Number.isFinite(hip.x) || !Number.isFinite(hip.y) || !Number.isFinite(hip.z) ||
    !Number.isFinite(knee.x) || !Number.isFinite(knee.y) || !Number.isFinite(knee.z) ||
    !Number.isFinite(ankle.x) || !Number.isFinite(ankle.y) || !Number.isFinite(ankle.z)
  ) {
    return null;
  }

  // 3. Vector Formulations
  const v1x = hip.x - knee.x;
  const v1y = hip.y - knee.y;
  const v1z = hip.z - knee.z;

  const v2x = ankle.x - knee.x;
  const v2y = ankle.y - knee.y;
  const v2z = ankle.z - knee.z;

  // 4. Degenerate Magnitude Guards (<= 1e-6)
  const mag1Sq = v1x * v1x + v1y * v1y + v1z * v1z;
  const mag2Sq = v2x * v2x + v2y * v2y + v2z * v2z;
  if (mag1Sq <= 1e-12 || mag2Sq <= 1e-12) return null; // sqrt(1e-12) = 1e-6

  const mag1 = Math.sqrt(mag1Sq);
  const mag2 = Math.sqrt(mag2Sq);
  if (mag1 <= 1e-6 || mag2 <= 1e-6) return null;

  // 5. Dot Product & Clamping
  const dot = v1x * v2x + v1y * v2y + v1z * v2z;
  const cosTheta = Math.max(-1.0, Math.min(1.0, dot / (mag1 * mag2)));
  if (!Number.isFinite(cosTheta)) return null;

  // 6. Degree Conversion
  return (Math.acos(cosTheta) * 180.0) / Math.PI;
}
```

### 5.2 Standing Baseline Calibration (`calibrateStandingBaseline`)

```typescript
export interface Landmark2D {
  x: number;
  y: number;
  z?: number;
  visibility?: number;
}

export interface StandingBaseline {
  standingLegLengthL: number;
  standingLegLengthR: number;
  standingHipY_L: number;
  standingHipY_R: number;
  standingKneeY_L: number;
  standingKneeY_R: number;
  standingAnkleY_L: number;
  standingAnkleY_R: number;
  standingHipY: number;    // Bilateral midpoint
  standingKneeY: number;   // Bilateral midpoint
  standingAnkleY: number;  // Bilateral midpoint
  verticalSpan: number;    // standingKneeY - standingHipY
  imageWidth: number;
  imageHeight: number;
  calibratedAt: number;
}

export function calibrateStandingBaseline(
  landmarks: Array<Landmark2D | null | undefined>,
  imageWidth: number,
  imageHeight: number,
  timestamp = Date.now()
): StandingBaseline | null {
  if (!landmarks || imageWidth <= 0 || imageHeight <= 0) return null;

  // Required keypoint indices
  // Left: Hip 23, Knee 25, Ankle 27
  // Right: Hip 24, Knee 26, Ankle 28
  const indices = [23, 24, 25, 26, 27, 28];
  for (const idx of indices) {
    const lm = landmarks[idx];
    if (!lm) return null;
    if (lm.visibility !== undefined && lm.visibility < 0.65) return null;
    if (!Number.isFinite(lm.x) || !Number.isFinite(lm.y)) return null;
  }

  // Convert to unmirrored camera pixel coordinates
  const hL = { x: landmarks[23]!.x * imageWidth, y: landmarks[23]!.y * imageHeight };
  const hR = { x: landmarks[24]!.x * imageWidth, y: landmarks[24]!.y * imageHeight };
  const kL = { x: landmarks[25]!.x * imageWidth, y: landmarks[25]!.y * imageHeight };
  const kR = { x: landmarks[26]!.x * imageWidth, y: landmarks[26]!.y * imageHeight };
  const aL = { x: landmarks[27]!.x * imageWidth, y: landmarks[27]!.y * imageHeight };
  const aR = { x: landmarks[28]!.x * imageWidth, y: landmarks[28]!.y * imageHeight };

  // Anatomical Ordering Check: In camera pixels, Y increases downwards (floor)
  // Must satisfy: Y_ankle > Y_knee > Y_hip on both sides
  if (aL.y <= kL.y || kL.y <= hL.y) return null;
  if (aR.y <= kR.y || kR.y <= hR.y) return null;

  // Calculate standing leg lengths
  const lenL = Math.sqrt((aL.x - hL.x) ** 2 + (aL.y - hL.y) ** 2);
  const lenR = Math.sqrt((aR.x - hR.x) ** 2 + (aR.y - hR.y) ** 2);
  if (lenL <= 1e-4 || lenR <= 1e-4) return null;

  const standingHipY = (hL.y + hR.y) / 2.0;
  const standingKneeY = (kL.y + kR.y) / 2.0;
  const standingAnkleY = (aL.y + aR.y) / 2.0;
  const verticalSpan = standingKneeY - standingHipY;
  if (verticalSpan <= 1e-4) return null;

  return {
    standingLegLengthL: lenL,
    standingLegLengthR: lenR,
    standingHipY_L: hL.y,
    standingHipY_R: hR.y,
    standingKneeY_L: kL.y,
    standingKneeY_R: kR.y,
    standingAnkleY_L: aL.y,
    standingAnkleY_R: aR.y,
    standingHipY,
    standingKneeY,
    standingAnkleY,
    verticalSpan,
    imageWidth,
    imageHeight,
    calibratedAt: timestamp,
  };
}
```

### 5.3 Frontal Knee Valgus Deviation (`computeValgusDeviation`)

```typescript
export function computeValgusDeviation(
  hip: { x: number; y: number; visibility?: number } | null | undefined,
  knee: { x: number; y: number; visibility?: number } | null | undefined,
  ankle: { x: number; y: number; visibility?: number } | null | undefined,
  baseline: StandingBaseline | null | undefined,
  side: "L" | "R"
): number | null {
  if (!hip || !knee || !ankle || !baseline) return null;
  if (hip.visibility !== undefined && hip.visibility < 0.65) return null;
  if (knee.visibility !== undefined && knee.visibility < 0.65) return null;
  if (ankle.visibility !== undefined && ankle.visibility < 0.65) return null;

  const Xh = hip.x, Yh = hip.y;
  const Xk = knee.x, Yk = knee.y;
  const Xa = ankle.x, Ya = ankle.y;

  if (
    !Number.isFinite(Xh) || !Number.isFinite(Yh) ||
    !Number.isFinite(Xk) || !Number.isFinite(Yk) ||
    !Number.isFinite(Xa) || !Number.isFinite(Ya)
  ) {
    return null;
  }

  // Vertical segment collapse guard
  const deltaY = Ya - Yh;
  if (Math.abs(deltaY) <= 1e-4) return null;

  const L_standing = side === "L" ? baseline.standingLegLengthL : baseline.standingLegLengthR;
  if (L_standing <= 1e-4) return null;

  // Neutral frontal axis interpolation at current knee height Yk
  const X_baseline = Xh + (Xa - Xh) * ((Yk - Yh) / deltaY);

  // Unmirrored camera coordinate polarity
  // Left Leg: Sensor right, medial collapse moves left (decreasing X) -> polarity = -1
  // Right Leg: Sensor left, medial collapse moves right (increasing X) -> polarity = +1
  const polarity = side === "L" ? -1.0 : 1.0;

  const valgusDevPct = (polarity * (Xk - X_baseline) / L_standing) * 100.0;
  return Number.isFinite(valgusDevPct) ? valgusDevPct : null;
}
```

### 5.4 Normalized Hip Depth Ratio (`computeDepthRatio`)

```typescript
export function computeDepthRatio(
  currentHipY: number | null | undefined,
  baseline: StandingBaseline | null | undefined
): number {
  if (currentHipY === null || currentHipY === undefined || !baseline) return 0.0;
  if (!Number.isFinite(currentHipY)) return 0.0;

  const denominator = baseline.verticalSpan;
  if (Math.abs(denominator) <= 1e-4) return 0.0;

  const ratio = (currentHipY - baseline.standingHipY) / denominator;
  return Number.isFinite(ratio) ? ratio : 0.0;
}
```

### 5.5 Kinematic Signal Filters (`smoothing.ts`)

```typescript
export class SlidingMedianFilter {
  private buffer: number[] = [];

  public update(val: number | null): number | null {
    if (val === null || !Number.isFinite(val)) {
      this.reset();
      return null;
    }

    this.buffer.push(val);
    if (this.buffer.length > 3) {
      this.buffer.shift();
    }

    if (this.buffer.length === 1) {
      return this.buffer[0];
    } else if (this.buffer.length === 2) {
      return (this.buffer[0] + this.buffer[1]) / 2.0;
    } else {
      // 3 elements: return median
      const sorted = [...this.buffer].sort((a, b) => a - b);
      return sorted[1];
    }
  }

  public reset(): void {
    this.buffer = [];
  }
}

export class ExponentialMovingAverageFilter {
  private current: number | null = null;
  private missingFrames = 0;
  private readonly alpha: number;

  constructor(alpha = 0.40) {
    this.alpha = alpha;
  }

  public update(val: number | null): number | null {
    if (val === null || !Number.isFinite(val)) {
      this.missingFrames++;
      if (this.missingFrames >= 3) {
        this.reset();
      }
      return null;
    }

    this.missingFrames = 0;
    if (this.current === null) {
      this.current = val;
    } else {
      this.current = this.alpha * val + (1.0 - this.alpha) * this.current;
    }
    return this.current;
  }

  public reset(): void {
    this.current = null;
    this.missingFrames = 0;
  }
}
```

### 5.6 Rep Counter State Machine & Valgus Detector (`repCounter.ts`)

```typescript
import type {
  Side,
  SquatPhase,
  KineRepPayload,
  KineAlertPayload,
} from "@kinesio/shared";

export interface RepCounterInput {
  timestamp: number;
  kneeDeg: number | null; // Representative (min of L & R or active leg)
  depthRatio: number;
  valgusDevPctL: number | null;
  valgusDevPctR: number | null;
  visibility: number;
}

export interface RepCounterOutput {
  phase: SquatPhase;
  reps: number;
  repEvent?: KineRepPayload;
  alertEvents?: KineAlertPayload[];
}

export class RepCounterStateMachine {
  private phase: SquatPhase = "standing";
  private reps = 0;
  private repStartTime: number | null = null;
  private minKneeDeg = 180.0;
  private maxDepthRatio = 0.0;

  // Dropout recovery state
  private previousPhaseBeforeLost: SquatPhase | null = null;
  private lostStartTime: number | null = null;

  // Valgus detector state
  private valgusFramesL = 0;
  private valgusFramesR = 0;
  private lastAlertTimeL = -4000;
  private lastAlertTimeR = -4000;

  public processFrame(input: RepCounterInput): RepCounterOutput {
    const { timestamp, kneeDeg, depthRatio, valgusDevPctL, valgusDevPctR, visibility } = input;
    const alertEvents: KineAlertPayload[] = [];
    let repEvent: KineRepPayload | undefined;

    // 1. Tracking Dropout / Visibility Guard
    if (visibility < 0.65 || kneeDeg === null) {
      if (this.phase !== "lost") {
        this.previousPhaseBeforeLost = this.phase;
        this.lostStartTime = timestamp;
        this.phase = "lost";
      }
      return { phase: this.phase, reps: this.reps };
    }

    // 2. Recovery from 'lost'
    if (this.phase === "lost") {
      const dropoutMs = this.lostStartTime !== null ? timestamp - this.lostStartTime : 0;
      if (kneeDeg > 160.0) {
        this.phase = "standing";
        this.resetRepState();
      } else if (this.previousPhaseBeforeLost && dropoutMs < 1000) {
        this.phase = this.previousPhaseBeforeLost;
      } else {
        this.phase = "standing";
        this.resetRepState();
      }
    }

    // 3. FSM Phase State Machine
    switch (this.phase) {
      case "standing": {
        if (depthRatio > 0.25 || kneeDeg < 150.0) {
          this.phase = "descending";
          this.repStartTime = timestamp;
          this.minKneeDeg = kneeDeg;
          this.maxDepthRatio = depthRatio;
          this.valgusFramesL = 0;
          this.valgusFramesR = 0;
        }
        break;
      }

      case "descending": {
        if (kneeDeg < this.minKneeDeg) this.minKneeDeg = kneeDeg;
        if (depthRatio > this.maxDepthRatio) this.maxDepthRatio = depthRatio;

        // Transition to bottom
        if (depthRatio > 0.85 || kneeDeg < 100.0) {
          this.phase = "bottom";
        }
        // Shallow Squat Reversal Path (prevents FSM deadlock)
        else if (kneeDeg > this.minKneeDeg + 10.0 && depthRatio < this.maxDepthRatio - 0.05) {
          this.phase = "ascending";
        }

        this.checkValgusAlert(valgusDevPctL, "L", timestamp, alertEvents);
        this.checkValgusAlert(valgusDevPctR, "R", timestamp, alertEvents);
        break;
      }

      case "bottom": {
        if (kneeDeg < this.minKneeDeg) this.minKneeDeg = kneeDeg;
        if (depthRatio > this.maxDepthRatio) this.maxDepthRatio = depthRatio;

        if (kneeDeg > 110.0 && depthRatio < this.maxDepthRatio - 0.05) {
          this.phase = "ascending";
        }

        this.checkValgusAlert(valgusDevPctL, "L", timestamp, alertEvents);
        this.checkValgusAlert(valgusDevPctR, "R", timestamp, alertEvents);
        break;
      }

      case "ascending": {
        // Valgus alerts are inactive during ascent
        if (kneeDeg > 160.0 && depthRatio < 0.20) {
          const durMs = this.repStartTime !== null ? timestamp - this.repStartTime : 0;

          // Rep Validation Gate
          if (this.minKneeDeg <= 105.0 && durMs >= 800) {
            this.reps++;
            const depth = this.minKneeDeg <= 80.0 ? "deep" : "good";
            const tempo = durMs < 1200 ? "fast" : durMs <= 3500 ? "controlled" : "slow";

            repEvent = {
              v: 1,
              sid: "",
              t: timestamp,
              type: "kine.rep",
              n: this.reps,
              minKneeDeg: Math.round(this.minKneeDeg * 10) / 10,
              depth,
              durMs,
              tempo,
            };
          }
          // Else: shallow squat (minKneeDeg > 105) or rapid bounce (durMs < 800) -> rejected!

          this.phase = "standing";
          this.resetRepState();
        }
        break;
      }
    }

    return {
      phase: this.phase,
      reps: this.reps,
      repEvent,
      alertEvents: alertEvents.length > 0 ? alertEvents : undefined,
    };
  }

  private checkValgusAlert(
    valgusDevPct: number | null,
    side: Side,
    timestamp: number,
    alerts: KineAlertPayload[]
  ): void {
    if (valgusDevPct !== null && valgusDevPct > 8.0) {
      if (side === "L") this.valgusFramesL++;
      else this.valgusFramesR++;
    } else {
      if (side === "L") this.valgusFramesL = 0;
      else this.valgusFramesR = 0;
    }

    const consecutiveFrames = side === "L" ? this.valgusFramesL : this.valgusFramesR;
    const lastAlertTime = side === "L" ? this.lastAlertTimeL : this.lastAlertTimeR;

    if (consecutiveFrames >= 3 && timestamp - lastAlertTime >= 4000) {
      if (side === "L") this.lastAlertTimeL = timestamp;
      else this.lastAlertTimeR = timestamp;

      alerts.push({
        v: 1,
        sid: "",
        t: timestamp,
        type: "kine.alert",
        kind: "knee_valgus",
        side,
        value: Math.round(valgusDevPct! * 10) / 10,
        thresholdPct: 8.0,
        repN: this.reps + 1,
        phase: this.phase,
        note: "Form alert (biomechanical feedback)",
      });
    }
  }

  private resetRepState(): void {
    this.repStartTime = null;
    this.minKneeDeg = 180.0;
    this.maxDepthRatio = 0.0;
    this.valgusFramesL = 0;
    this.valgusFramesR = 0;
    this.previousPhaseBeforeLost = null;
    this.lostStartTime = null;
  }

  public getReps(): number {
    return this.reps;
  }

  public getPhase(): SquatPhase {
    return this.phase;
  }
}
```

---

## 6. Caveats

1. **TRD vs. ORIGINAL_REQUEST Knee Flexion Threshold for Valid Rep:**
   - In `docs/trd.md` line 153, the text states "if minimum depth reached $< 110^\circ$".
   - In `ORIGINAL_REQUEST.md` line 75 & 128, the requirement explicitly specifies $\min(\theta_{\text{knee}}) \le 105^\circ$.
   - **Resolution:** `ORIGINAL_REQUEST.md` is the primary authoritative source for Day 3 acceptance criteria. The threshold $\le 105^\circ$ is adopted as the strict validation barrier.
2. **Camera Aspect Ratio & Resolution Scaling:**
   - Pixel coordinates $(X, Y)$ depend on image dimensions $(W, H)$. `calibrateStandingBaseline` must record $W$ and $H$. In production or test fixtures, if frames change resolution mid-session, coordinates must normalize against the calibrated $(W, H)$ to prevent artificial leg length changes.
3. **Monocular Unmirrored Assumption:**
   - Frontal polarity formulas assume an unmirrored user facing the webcam directly. If a camera feed is horizontally mirrored before passing into MediaPipe, the polarity signs would invert. In KinesioLive, video canvas rendering mirrors for patient feedback, but pose inference receives the raw unmirrored video track or compositor frames. The engine operates purely in unmirrored camera coordinates.

---

## 7. Conclusion

All 6 core biomechanical modules have been exhaustively specified with mathematical proofs, exact vector definitions, guard thresholds, and state transition equations:
1. `compute3DKneeFlexion`: Implements metric 3D dot product with clamp to $[-1, 1]$, degenerate vector guard ($\le 10^{-6}$), visibility threshold ($0.65$), and returns `null` on invalid data.
2. `calibrateStandingBaseline`: Validates bilateral keypoints 23..28, enforces $Y_{\text{ankle}} > Y_{\text{knee}} > Y_{\text{hip}}$, and computes unmirrored leg lengths and vertical spans.
3. `computeValgusDeviation`: Interpolates the neutral axis, guards against $|Y_a - Y_h| \le 10^{-4}$, applies unmirrored polarity (Left: $-1$, Right: $+1$), ensuring medial collapse is strictly positive ($+$).
4. `computeDepthRatio`: Normalizes pelvic descent against standing vertical span, yielding $0.0$ at standing, $\sim 1.0$ at parallel, and $> 1.0$ below parallel.
5. Signal Smoothing: 3-frame sliding median filter rejects single-frame impulse noise; EMA filter ($\alpha = 0.40$) guarantees $< 50$ ms rise-time latency while eliminating display digit jitter.
6. Rep Counter FSM: 5-state hysteresis machine prevents deadlocks via shallow squat reversal path, enforces $800$ ms duration and $105^\circ$ depth validation, and isolates Left/Right valgus alert cooldowns to 4000 ms per leg.

---

## 8. Verification Method

To independently verify this specification against implementation and test suites:

1. **Vitest Unit Suite Execution:**
   Run the 3 dedicated test suites specified in `ORIGINAL_REQUEST.md` and `docs/testing.md`:
   ```powershell
   pnpm vitest run tests/geometry.test.ts tests/smoothing.test.ts tests/repCounter.test.ts
   ```
2. **Key Mathematical Invariants Verification:**
   - In `tests/geometry.test.ts`:
     - Test orthogonal 3D vectors $\to$ assert $90.0^\circ \pm 0.1^\circ$.
     - Test collinear opposite $\to$ assert $180.0^\circ \pm 0.1^\circ$.
     - Test degenerate vectors $(0,0,0)$ and non-finite inputs $\to$ assert returns `null` (not `NaN` or dummy values).
     - Test valgus deviation polarity: Left medial collapse ($X$ decrease) $\to > 0$; Right medial collapse ($X$ increase) $\to > 0$; outward varus $\to < 0$.
     - Test vertical denominator collapse ($|Y_a - Y_h| \le 10^{-4}$) $\to$ assert returns `null`.
3. **Signal Filter Verification:**
   - In `tests/smoothing.test.ts`:
     - Feed impulse sequence $[10, 85, 12]$ to `SlidingMedianFilter` $\to$ assert 3rd frame output is $12.0$.
     - Feed step input $[0, 100, 100]$ to `ExponentialMovingAverageFilter` ($\alpha = 0.40$) $\to$ assert Frame 2 reaches $64.0$ ($> 50\%$) within 2 frames ($< 50$ ms at 30 FPS).
4. **Rep Counter Fixture Verification:**
   - In `tests/repCounter.test.ts`:
     - Feed `normal_squat_5reps.json` $\to$ assert exactly 5 reps completed with `tempo: "controlled"` and `depth: "good" | "deep"`.
     - Feed `shallow_squat.json` $\to$ assert 0 reps completed, phase returns to `standing` without deadlock.
     - Feed `fast_squat.json` $\to$ assert 0 reps completed (duration $< 800$ ms).
     - Feed `valgus_squat.json` $\to$ assert exactly 1 Left knee valgus alert, honors 4.0s cooldown, and allows Right knee alert independently.
     - Feed `occluded_jitter.json` $\to$ assert transitions to `lost` and recovers cleanly.
