# State-of-the-Art Human Pose Skeleton Overlays, Joint Angle Kinematics, and WebRTC Tele-Rehabilitation: Open-Source Benchmark & Architectural Evaluation

**Author:** Principal Biomechanics AI & Open-Source Research Architect  
**Project:** KinesioLive Tele-Rehabilitation Platform  
**Target Milestone:** Architectural Deep Dive & Synthesis  
**Scope:** Browser-based Real-Time Pose Estimation, WebRTC DOM Canvas Alignment, Biomechanical Angles, Landmark Filtering, and Hysteresis Rep Counting

---

## Executive Summary

Real-time computer vision in browser-based telerehabilitation demands the convergence of three traditionally divergent disciplines: **sub-millisecond DOM/WebRTC compositing**, **clinical biomechanical signal integrity**, and **deterministic finite state machine (FSM) validation**. Markerless motion capture engines executing client-side in WebAssembly/WebGL (notably Google MediaPipe Pose / BlazePose) provide unprecedented accessibility for remote musculoskeletal physiotherapy. However, translating raw 2D and pseudo-3D neural network outputs into clinical-grade range-of-motion (ROM) metrics in a web application involves subtle mathematical pitfalls: coordinate letterbox/pillarbox distortion, single-frame landmark dropouts, high-frequency camera digitization jitter, and monocular depth ambiguity.

This investigation analyzes **5 landmark open-source projects, industrial architectures, and peer-reviewed clinical validation studies**, details their technical handling of these challenges, cross-evaluates our existing KinesioLive implementation (`canvasOverlayAligner.ts`, `geometry.ts`, `repCounter.ts`, `smoothing.ts`), and outlines **4 high-impact architectural upgrades** to advance KinesioLive to a state-of-the-art tele-rehab engine.

---

## Part 1: Landmark Open-Source Projects & Clinical Literature Review

### 1. Primary Benchmark Matrix

| Landmark Implementation / Paper | Primary Authors & Venue / Repo | Key Biomechanical & Technical Innovations | Primary Architectural Relevance to KinesioLive |
| :--- | :--- | :--- | :--- |
| **BlazePose: On-device Real-time Body Pose tracking** | Valentin Bazarevsky, Ivan Grishchenko et al. (Google Research, CVPR 2020 CV4ARVR) [arXiv:2006.10204](https://arxiv.org/abs/2006.10204) | Two-stage detector-tracker topology; 33 2D/3D topological landmarks; dual output of normalized image coordinates ($x, y \in [0, 1]$) and metric 3D `worldLandmarks` ($X, Y, Z$ in meters centered at hip midpoint). | Baseline neural network runtime powering MediaPipe Vision Tasks. Demonstrates distinction between camera-plane projection and metric 3D space. |
| **1€ Filter: A Simple Speed-based Low-pass Filter for Jittery Signals** | Géry Casiez, Nicolas Roussel, Daniel Vogel (ACM CHI 2012) [GitHub: casiez/OneEuroFilter](https://github.com/casiez/OneEuroFilter) | Adaptive low-pass filter with dynamic cutoff frequency: $f_c = f_{c,\min} + \beta |\hat{\dot{x}}|$. Resolves the fundamental trade-off between resting jitter stabilization and low-latency tracking during ballistic movement. | Mathematical backbone for sub-pixel landmark stabilization without phase lag in real-time browser overlays. |
| **RepNet: Counting Out Time — Class Agnostic Video Repetition Counting** | Debidatta Dwibedi, Yusuf Aytar, Jonathan Tompson, Pierre Sermanet, Andrew Zisserman (Google Research & Oxford, CVPR 2020) [RepNet Repository](https://github.com/materight/RepNet-pytorch) | Temporal self-similarity matrices (SSM) and feed-forward period predictors to dynamically track variable-speed cyclic actions without hardcoded anatomical heuristics. | Establishes theoretical upper bounds for non-parametric repetition segmentation and validates multi-phase cycle decomposition (eccentric/concentric). |
| **Clinical Validation of MediaPipe Pose vs. Gold Standard 3D MoCap** | Multiple Clinical Trials (e.g., Stenum et al. 2021; Ota et al. 2023; PMC8838234, PMC10002167) | Systematic comparison of MediaPipe 2D/3D joint angles against marker-based Vicon and Qualisys optoelectronic systems during squats and gait. Intraclass correlation (ICC > 0.89) for 2D sagittal knee flexion, but highlights monocular Z-axis error (~18°–20° valgus divergence). | Validates KinesioLive’s strategy of combining 3D metric worldLandmarks for sagittal flexion with calibrated 2D frontal plane baselines for medial valgus deviation. |
| **Open-Source Web AI Fitness Engines (e.g. GC_Fit / AI-Fitness-Trainer / 3D-HPE-MediaPipe-Pose)** | Clemente et al. (2023), TanHuy2k2 (GC_Fit), samarthify (AI-Fitness-Trainer) | Real-time DOM canvas video tapping, WebRTC integration, hysteresis state machines, and angle threshold bounding for squats, lunges, and curls. | Standardizes browser-side DOM canvas overlays, `requestVideoFrameCallback` pipelines, and practical UX feedback for unconstrained domestic camera environments. |

---

## Part 2: Technical Breakdown of Core Engineering Challenges

### A. WebRTC Skeleton Alignment & DOM Video Tapping

#### 1. DOM Video Tapping vs. Secondary Camera Streams
In multi-party WebRTC platforms (e.g. CometChat Calls SDK v5, Twilio, Agora), requesting a second camera stream via `navigator.mediaDevices.getUserMedia()` triggers fatal hardware contention on mobile devices and crashes or locks the video track in desktop Chromium (`TrackStartError` / `OverconstrainedError`).
* **State of the Art:** Tapping the live, rendered `<video>` element directly in the DOM. Modern browsers provide the `HTMLVideoElement.requestVideoFrameCallback()` (rVFC) API.
* **Synchronization Mechanism:** While `requestAnimationFrame()` fires at the monitor's refresh rate (e.g., 60 Hz or 144 Hz) irrespective of video state, `requestVideoFrameCallback()` executes precisely when a newly decoded video frame is dispatched to the compositor. The callback exposes metadata:
  ```typescript
  video.requestVideoFrameCallback((now, metadata) => {
    // metadata.presentedFrames, metadata.expectedDisplayTime, metadata.rtpTimestamp
    processPoseInference(video, metadata.expectedDisplayTime);
  });
  ```
* **Compositing: CSS Absolute Overlay vs. Offscreen Rendering:**
  In production tele-rehab applications, running inference on an `OffscreenCanvas` in a Web Worker keeps the UI thread responsive. For rendering the overlay, a transparent high-DPI `<canvas>` positioned with `position: absolute; pointer-events: none;` directly over the DOM `<video>` tile is preferred over composite re-encoding. This avoids re-compressing the video stream and maintains zero additional latency for the WebRTC peer.

---

### B. Occlusion, Partial Framing, & Boundary Gating

#### 1. The Domestic Tele-Rehab Framing Problem
In home tele-rehabilitation, patients frequently position webcams on desks or laptops, cropping the lower body (knees, shins, or feet) out of the frame. Standard neural pose estimators attempt to "hallucinate" missing limbs based on upper-body posture, generating erroneous bone segments and phantom joint angles.

```
       [Camera Viewport]
+-------------------------------+
|             ( O )  Head       |  <-- High Visibility (1.0)
|            /  |  \            |
|           /   |   \           |
|          O----O----O Hips     |  <-- Mid-Torso Visible
+ - - - - - - - - - - - - - - - +
:            \     /            :
:             O   O    Knees    :  <-- Cropped by bottom border (y > 0.95)
:             |   |             :      Visibility drops (< 0.60)
:             O   O    Ankles   :  <-- Completely Occluded!
+-------------------------------+
```

#### 2. Industry Mitigation Patterns
1. **Kinematic Confidence Thresholding ($V_{\min}$):**
   MediaPipe provides landmark-level `visibility` scores representing the probability that a keypoint is located within the frame and not occluded. Top repositories reject frames or individual bones where $V < 0.60 - 0.65$.
2. **Normalized Boundary Guardrails:**
   Landmarks with normalized $y > 0.95$ (near the bottom viewport edge) or $x < 0.05 \lor x > 0.95$ are subject to boundary clipping. When an ankle landmark crosses $y > 0.95$, the tibia link (`[knee, ankle]`) is suppressed.
3. **FSM "Lost" State Transition:**
   When critical kinematic joints fall below confidence thresholds, the repetition counter transitions to a `lost` phase rather than maintaining a speculative state.

---

### C. Coordinate Space Transforms: Model, Display, & Aspect Ratio

MediaPipe models output normalized coordinates $(x_m, y_m) \in [0, 1] \times [0, 1]$. Mapping these to screen pixels requires accounting for CSS `object-fit` (`cover` vs. `contain`) and selfie video mirroring (`scaleX(-1)`).

```
+-------------------------------------------------------------------+
| Container [displayWidth x displayHeight]                          |
|    +---------------------------------------------------------+    |
|    | Cropped / Padded Video Content [contentWidth x contentHeight] |
|    |                                                         |    |
|    |       (X_pixel, Y_pixel) =                              |    |
|    |         contentLeft + (normX * contentWidth)            |    |
|    |         contentTop  + (normY * contentHeight)           |    |
|    +---------------------------------------------------------+    |
+-------------------------------------------------------------------+
```

#### Mathematical Formulation for Aspect Ratio Preservation:
Given:
- Intrinsic video dimensions: $W_{\text{vid}}, H_{\text{vid}}$ with aspect ratio $R_{\text{vid}} = W_{\text{vid}} / H_{\text{vid}}$
- Display container dimensions: $W_{\text{disp}}, H_{\text{disp}}$ with aspect ratio $R_{\text{disp}} = W_{\text{disp}} / H_{\text{disp}}$

1. **For `object-fit: contain`:**
   - If $R_{\text{disp}} > R_{\text{vid}}$ (Pillarboxing):
     $$W_c = H_{\text{disp}} \cdot R_{\text{vid}}, \quad H_c = H_{\text{disp}}, \quad X_{\text{offset}} = \frac{W_{\text{disp}} - W_c}{2}, \quad Y_{\text{offset}} = 0$$
   - If $R_{\text{disp}} \le R_{\text{vid}}$ (Letterboxing):
     $$W_c = W_{\text{disp}}, \quad H_c = \frac{W_{\text{disp}}}{R_{\text{vid}}}, \quad X_{\text{offset}} = 0, \quad Y_{\text{offset}} = \frac{H_{\text{disp}} - H_c}{2}$$

2. **For `object-fit: cover`:**
   - If $R_{\text{disp}} > R_{\text{vid}}$ (Vertical Cropping):
     $$W_c = W_{\text{disp}}, \quad H_c = \frac{W_{\text{disp}}}{R_{\text{vid}}}, \quad X_{\text{offset}} = 0, \quad Y_{\text{offset}} = \frac{H_{\text{disp}} - H_c}{2}$$
   - If $R_{\text{disp}} \le R_{\text{vid}}$ (Horizontal Cropping):
     $$W_c = H_{\text{disp}} \cdot R_{\text{vid}}, \quad H_c = H_{\text{disp}}, \quad X_{\text{offset}} = \frac{W_{\text{disp}} - W_c}{2}, \quad Y_{\text{offset}} = 0$$

3. **Mirror Transformation:**
   For local patient video tiles rendered with CSS `transform: scaleX(-1)`:
   $$x_{\text{norm}} = 1.0 - x_m$$
   $$X_{\text{screen}} = X_{\text{offset}} + x_{\text{norm}} \cdot W_c$$
   $$Y_{\text{screen}} = Y_{\text{offset}} + y_m \cdot H_c$$

---

### D. Signal Smoothing & Jitter Reduction

Raw neural landmark streams suffer from high-frequency digitization jitter caused by sub-pixel neural activations and WebRTC compression artifacts. Applying a static low-pass filter (or simple moving average) introduces phase lag ($> 100 \text{ ms}$), causing the visual skeleton to trail behind the patient's limbs during rapid movements.

#### 1. The 1€ Filter Formulation (Casiez et al., 2012)
The 1€ Filter continuously adjusts its cutoff frequency $f_c$ based on the estimated rate of change $\hat{\dot{x}}$ of the signal:

1. **Discrete Derivative Estimation:**
   $$\dot{x}_k = \frac{x_k - \hat{x}_{k-1}}{T_e}$$
   $$\hat{\dot{x}}_k = \alpha_d \dot{x}_k + (1 - \alpha_d) \hat{\dot{x}}_{k-1}, \quad \text{where } \alpha_d = \frac{1}{1 + \frac{1}{2 \pi f_{c,d} T_e}}$$
2. **Adaptive Cutoff Frequency:**
   $$f_c = f_{c,\min} + \beta |\hat{\dot{x}}_k|$$
3. **Signal Filtering:**
   $$\alpha = \frac{1}{1 + \frac{1}{2 \pi f_c T_e}}$$
   $$\hat{x}_k = \alpha x_k + (1 - \alpha) \hat{x}_{k-1}$$

* **Low Speed ($|\hat{\dot{x}}| \approx 0$):** $f_c \to f_{c,\min}$ (e.g. $1.0\text{ Hz}$). High smoothing eliminates resting jitter.
* **High Speed ($|\hat{\dot{x}}| \gg 0$):** $f_c$ increases linearly with $\beta |\hat{\dot{x}}|$ (e.g. $\beta = 8.0$), driving $\alpha \to 1.0$ and eliminating phase lag.

#### 2. Hybrid Pipeline: Sliding Median + 1€ Filter
While the 1€ filter handles Gaussian noise, it can be disturbed by single-frame neural tracking dropouts (impulse spikes). The optimal real-time signal pipeline pairs a **3-frame sliding median filter** (to reject impulse spikes) with a **1€ filter** (for continuous phase-adaptive smoothing).

---

### E. Biomechanical Joint Angles & Hysteresis Repetition Counting

#### 1. Knee Flexion Angle: 3D Metric World Space vs. 2D Image Space
In clinical biomechanics, knee flexion is defined in the sagittal plane:
$$\theta_{\text{knee}} = \arccos\left(\frac{\mathbf{v}_1 \cdot \mathbf{v}_2}{\|\mathbf{v}_1\| \|\mathbf{v}_2\|}\right)$$
where $\mathbf{v}_1 = \mathbf{p}_{\text{hip}} - \mathbf{p}_{\text{knee}}$ and $\mathbf{v}_2 = \mathbf{p}_{\text{ankle}} - \mathbf{p}_{\text{knee}}$.

* **2D Image Projections:** In monocular front-facing camera setups, calculating $\theta_{\text{knee}}$ via 2D projected coordinates introduces projective foreshortening: as the patient bends their knees forward toward the camera, 2D coordinates compress, leading to angle distortion.
* **3D Metric `worldLandmarks`:** MediaPipe BlazePose provides `worldLandmarks` expressed in metric Euclidean space with origin at the hip center. Calculating the 3D dot product across metric coordinates eliminates projective compression and aligns closely with clinical goniometry ($R^2 > 0.91$).

#### 2. Frontal Knee Valgus Deviation Percentage
Clinical literature demonstrates that single-camera Z-axis estimates are noisy for measuring absolute frontal valgus angles in degrees (which can exhibit $18^\circ\text{--}20^\circ$ error). KinesioLive solves this by defining **Normalized Valgus Deviation Percentage** ($V_{\text{dev}}$) relative to a calibrated neutral standing baseline ($L_{\text{standing}}$):
$$X_{\text{baseline}} = X_{\text{hip}} + (X_{\text{ankle}} - X_{\text{hip}}) \cdot \frac{Y_{\text{knee}} - Y_{\text{hip}}}{Y_{\text{ankle}} - Y_{\text{hip}}}$$
$$V_{\text{dev}} = \text{polarity} \cdot \frac{X_{\text{knee}} - X_{\text{baseline}}}{L_{\text{standing}}} \times 100\%$$
*(where polarity $= -1$ for left leg and $+1$ for right leg in unmirrored camera coordinates)*.

#### 3. Repetition Counting State Machine: 5-Phase Hysteresis
To prevent count fluttering and shallow repetition false-positives, repetition counting requires a deterministic finite state machine (FSM):

```
                  +--------------+
                  |   STANDING   | <-------------------------+
                  +--------------+                           |
                         | (depthRatio > 0.25                |
                         |  or theta < 150°)                 | (theta > 160° &
                         v                                   |  depthRatio < 0.20)
                  +--------------+                           | [Rep Validation Gate]
   +------------> |  DESCENDING  |                           |
   |              +--------------+                           |
   | (Shallow            | (depthRatio > 0.85                |
   |  Reversal)          |  or theta < 100°)                 |
   |                     v                                   |
   |              +--------------+                           |
   +------------- |    BOTTOM    |                           |
   |              +--------------+                           |
   |                     |                                   |
   |                     | (theta > 110° & depth decreasing) |
   |                     v                                   |
   |              +--------------+                           |
   +------------> |  ASCENDING   | --------------------------+
                  +--------------+
```

* **Repetition Validation Gate:** To qualify as a valid repetition upon returning to `standing`, two criteria must be satisfied:
  1. **Depth Threshold:** $\min(\theta_{\text{knee}}) \le 105.0^\circ$ (or $\text{depthRatio} \ge 0.70$).
  2. **Duration Boundary:** $\Delta t_{\text{rep}} \ge 800\text{ ms}$ (rejects ballistic bounces).

---

## Part 3: Gap Analysis of KinesioLive's Current Implementation

Our review of `client/src/utils/canvasOverlayAligner.ts`, `client/src/engine/geometry.ts`, `client/src/engine/repCounter.ts`, and `client/src/views/Patient.tsx` reveals a solid foundation:
- 1:1 pixel alignment handling `cover` vs. `contain` letterboxing.
- Metric 3D `worldLandmarks` dot-product for knee flexion.
- Standing baseline calibration with signed valgus deviation.
- 5-phase hysteresis state machine with shallow-squat reversal protection.
- DOM video tapping using `requestVideoFrameCallback`.

However, comparing against state-of-the-art benchmarks identified several key opportunities for improvement:

1. **Decoupled Landmark vs. Kinematic Smoothing:**
   In `Patient.tsx`, `LandmarkSmoother2D` filters screen landmarks for visual canvas rendering, but kinematics (`compute3DKneeFlexion`) operate on raw 3D world landmarks, which are then passed through scalar EMA/Median filters. Filtering raw 3D landmarks directly with a 3D One Euro filter before angle computation improves angle stability and reduces downstream derivative noise.
2. **Dynamic Baseline Recalibration / Drift Adaptation:**
   The standing baseline is calibrated once at session start. If the patient shifts position or repositions the camera, scale drift can occur. Integrating an automated drift detection routine stabilizes long sessions.
3. **Anatomical Bone Segment Constraints:**
   During occlusions, raw landmarks can produce anatomically impossible bone lengths. Adding segment length validation helps flag and suppress distorted frames.
4. **Adaptive Camera Framing Guidance:**
   While `isLowerBodyVisible` checks threshold boundaries, proactive visual framing cues assist patients in positioning the camera correctly before starting exercises.

---

## Part 4: High-Impact Architectural Upgrades for KinesioLive

### Upgrade 1: 3D Metric World-Landmark 1€ Kinematic Filter

#### Architectural Rationale
Currently, visual 2D landmarks are smoothed with `LandmarkSmoother2D`, while 3D `worldLandmarks` are processed raw before passing angles to scalar EMA filters. Because 3D dot products are non-linear, high-frequency spatial noise on any landmark vertex ($p_{23}, p_{25}, p_{27}$) propagates into angle variance. Filtering metric 3D points directly with a synchronized 3D One Euro filter stabilizes the vector field before trigonometric calculations.

```
+------------------------------------+
| MediaPipe 3D Metric worldLandmarks |
+------------------------------------+
                  |
                  v
+------------------------------------+
|    OneEuroFilter3D Pipeline        |  <-- Filters X, Y, Z in metric space
|  (Adaptive cutoff: fc = 1.2 + 8*v) |
+------------------------------------+
                  |
                  v
+------------------------------------+
|  compute3DKneeFlexion(H, K, A)     |  <-- Stable metric dot product
+------------------------------------+
                  |
                  v
+------------------------------------+
|     Deterministic FSM Engine       |
+------------------------------------+
```

#### Implementation Blueprint (`client/src/engine/smoothing.ts`)
```typescript
export class OneEuroFilter3D {
  private fx: OneEuroFilter;
  private fy: OneEuroFilter;
  private fz: OneEuroFilter;

  constructor(minCutoff: number = 1.0, beta: number = 0.007, dCutoff: number = 1.0) {
    this.fx = new OneEuroFilter(minCutoff, beta, dCutoff);
    this.fy = new OneEuroFilter(minCutoff, beta, dCutoff);
    this.fz = new OneEuroFilter(minCutoff, beta, dCutoff);
  }

  public filter(pt: Point3D | null | undefined, timestamp?: number): Point3D | null {
    if (!pt || !Number.isFinite(pt.x) || !Number.isFinite(pt.y) || !Number.isFinite(pt.z)) {
      this.reset();
      return null;
    }
    const x = this.fx.filter(pt.x, timestamp);
    const y = this.fy.filter(pt.y, timestamp);
    const z = this.fz.filter(pt.z, timestamp);
    if (x === null || y === null || z === null) return null;
    return { x, y, z, visibility: pt.visibility };
  }

  public reset(): void {
    this.fx.reset();
    this.fy.reset();
    this.fz.reset();
  }
}
```

---

### Upgrade 2: Anthropometric Bone Length Invariant Guard

#### Architectural Rationale
Human limb segments (femur: hip-to-knee; tibia: knee-to-ankle) remain rigid across all exercise phases. If neural tracking drops or self-occlusion occurs, calculated limb lengths can distort significantly. Enforcing bone-length consistency ($L \in [0.85 L_0, 1.15 L_0]$) provides an effective check for anatomical plausibility.

```typescript
export interface AnthropometricConstraint {
  femurLength: number;
  tibiaLength: number;
  tolerance: number; // e.g. 0.20 (+/- 20%)
}

export function validateLimbSegmentLength(
  jointA: Point3D,
  jointB: Point3D,
  expectedLength: number,
  tolerance: number = 0.20
): boolean {
  const dist = Math.hypot(jointA.x - jointB.x, jointA.y - jointB.y, jointA.z - jointB.z);
  return Math.abs(dist - expectedLength) / expectedLength <= tolerance;
}
```

---

### Upgrade 3: Dynamic Standing Baseline Drift Compensation

#### Architectural Rationale
In extended tele-rehabilitation sessions, patients may adjust their standing position or shift the camera angle. A static baseline calibrated in frame 1 can experience drift in normalized depth ratios ($D_{\text{ratio}}$). When the FSM enters the `standing` phase with stable upright posture for $> 60$ frames ($\sim 2\text{ seconds}$), gently updating the baseline via an exponential moving average maintains calibration without requiring explicit user resets.

```typescript
export function updateBaselineDrift(
  currentBaseline: StandingBaseline,
  newStandingY: number,
  learningRate: number = 0.05
): StandingBaseline {
  return {
    ...currentBaseline,
    standingHipY: currentBaseline.standingHipY * (1 - learningRate) + newStandingY * learningRate,
  };
}
```

---

### Upgrade 4: Intelligent Viewport Framing Assistant

#### Architectural Rationale
Rather than showing a generic alert when tracking confidence drops, an interactive framing assistant can guide the user in real time:
- User too close: Knees/ankles cut off at bottom border ($y > 0.95$).
- User too far: Landmark bounding box span $< 35\%$ of frame height.
- Off-center: Hip midpoint outside $[0.30, 0.70]$ horizontal frame span.

Displaying subtle directional cues (e.g., "Step back 2 steps" or "Tilt camera down slightly") ensures optimal camera setup before exercise begins.

---

## Part 5: Benchmark Citations & References

1. **Bazarevsky, V., Grishchenko, I., Raveendran, K., Zhu, T., Zhang, F., & Grundmann, M.** (2020). *BlazePose: On-device Real-time Body Pose tracking*. CVPR Workshop on Computer Vision for Augmented and Virtual Reality (CV4ARVR). arXiv:2006.10204.
2. **Casiez, G., Roussel, N., & Vogel, D.** (2012). *1€ filter: a simple speed-based low-pass filter for noisy input in interactive systems*. Proceedings of the SIGCHI Conference on Human Factors in Computing Systems (CHI '12), 2527–2530. DOI:10.1145/2207676.2208639.
3. **Dwibedi, D., Aytar, Y., Tompson, J., Sermanet, P., & Zisserman, A.** (2020). *Counting Out Time: Class Agnostic Video Repetition Counting in the Wild*. IEEE/CVF Conference on Computer Vision and Pattern Recognition (CVPR), 10313–10322.
4. **Stenum, J., Rossi, C., & Roemmich, R. T.** (2021). *Two-dimensional video-based analysis of human gait using MediaPipe*. *PLOS ONE*, 16(11), e0259301. PMC8838234.
5. **Ota, M., Tateuchi, H., Hashiguchi, T., & Ichihashi, N.** (2023). *Verification of joint angle estimation accuracy during squat exercise using MediaPipe*. *Journal of Physical Therapy Science*, 35(3), 195–200. PMC10002167.
6. **W3C Media Capture and Streams / WebRTC Working Group**. *HTMLVideoElement.requestVideoFrameCallback() Specification*. W3C Draft / Chromium Compositor Pipeline Documentation.
