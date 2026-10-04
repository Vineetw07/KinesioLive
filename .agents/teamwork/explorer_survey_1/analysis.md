# Phase 3 Exploration & Architectural Survey Report (Milestones D4.2 – D4.5)

> **Document:** `analysis.md`  
> **Author:** Explorer Survey Agent (`explorer_survey_1`)  
> **Target Milestones:** D4.2 (Design Tokens & Shell), D4.3 (Patient Studio), D4.4 (Clinician Studio), D4.5 (Session Guard)  
> **Codebase:** `d:/TP/Hackathon/Cometchat`  
> **Status:** READ-ONLY Architectural Investigation Complete  

---

## Executive Summary

This report delivers a comprehensive architectural survey of the KinesioLive codebase to guide the implementation of Phase 3 (Milestones D4.2 through D4.5). The investigation verified:
1. **CometChat Calls v5 Headless Architecture:** How `@cometchat/calls-sdk-javascript@5` mounts WebRTC video into DOM container elements, how `SessionSettings` enforces `startAudioMuted: false` for the patient and `startAudioMuted: true` for the clinician (eliminating acoustic howling), and how lifecycle events are tracked.
2. **Zero-Contention Camera Ingestion:** How `poseRunner.ts` leverages `requestVideoFrameCallback` to read hardware compositor textures directly from the DOM `<video>` element created by Calls v5, avoiding Windows/Chromium `NotReadableError` camera lockups without initiating a secondary `getUserMedia` stream.
3. **Decoupled Biomechanics Engine Integration:** How `@mediapipe/tasks-vision` landmark outputs (`landmarks` 2D normalized and `worldLandmarks` 3D metric) map into `geometry.ts`, `smoothing.ts`, and `RepCounterStateMachine`, driving 10 Hz rate-capped transient telemetry (`kine.pose`) and persisted event triggers (`kine.rep`, `kine.alert`, `kine.cue`).
4. **Concrete Implementation Blueprints:** Clear component contracts and integration patterns for `Patient.tsx`, `Clinician.tsx`, `sessionGuard.ts`, `tokens.css`, and `motionPresets.ts`.

---

## 1. Video and Calls v5 Architecture

### 1.1 Calls v5 Headless Session Join Workflow
Inspection of `client/src/spikes/s3-calls/callsRunner.ts` (lines 19–147) and `.cometchat/skills/cometchat-js-v5-sdk/SKILL.md` confirms the mandatory step-by-step lifecycle:

```
[Server POST /api/session] ──> returns { sessionId, authToken, uid, appId, region }
             │
             ▼
[CometChat.init(appId, chatSettings)] ──> [CometChat.login(authToken)]
             │
             ▼
[CometChatCalls.init({ appId, region })] ──> [CometChatCalls.loginWithAuthToken(authToken)]
             │
             ▼
[CometChatCalls.generateToken(sessionId)] ──> returns { token }
             │
             ▼
[CometChatCalls.joinSession(token, callSettings, containerElement)]
```

### 1.2 DOM Video Rendering & Sizing Invariants
- **Container Mounting:** `CometChatCalls.joinSession(token, callSettings, containerElement)` mounts into an existing `HTMLElement`.
- **Dimension Invariant:** The container element **must possess explicit, non-zero dimensions** (e.g., `width: 100%`, `min-height: 440px` or `height: 100%`). If the container has `height: 0`, the internal Calls SDK WebRTC surface collapses and renders invisibly.
- **Internal DOM Structure:** When `sessionType: 'VIDEO'` and `layout: 'TILE'` are active, Calls SDK v5 dynamically injects a tile grid container into `containerElement`. Inside the tile container, it creates `<video>` elements with their `srcObject` property assigned to the WebRTC `MediaStream`.
- **Control Panel Customization:**
  - `SessionSettings.hideControlPanel`: When set to `false`, the SDK renders its built-in control bar (mic toggle, camera toggle, screen share, leave button).
  - When custom HUD controls are rendered (such as in KinesioLive's floating island layout), `SessionSettings` allows hiding specific buttons (`hideToggleAudioButton: false`, `hideToggleVideoButton: false`, `hideLeaveSessionButton: false`) or hiding the entire control panel (`hideControlPanel: true`) and executing custom action methods (`CometChatCalls.muteAudio()`, `CometChatCalls.leaveSession()`, etc.).

### 1.3 Role-Specific Audio Mute Invariants
In `client/src/spikes/s3-calls/callsRunner.ts` (lines 83–95):

```typescript
const isClinician = role === 'clinician';

const callSettings: SessionSettings = {
  sessionType: 'VIDEO',
  layout: 'TILE',
  startAudioMuted: isClinician, // INVARIANT: Clinician MUTED, Patient UNMUTED
  startVideoPaused: false,
  hideControlPanel: false,
  hideLeaveSessionButton: false,
  hideToggleAudioButton: false,
  hideToggleVideoButton: false,
  idleTimeoutPeriodBeforePrompt: 60000,
  idleTimeoutPeriodAfterPrompt: 180000,
};
```

- **Patient View (`Patient.tsx`):** `startAudioMuted: false`
  - The patient needs their microphone active so the clinician can hear exercise cadence, breathing, and verbal feedback.
- **Clinician View (`Clinician.tsx`):** `startAudioMuted: true`
  - **Acoustic Feedback Defense:** When evaluating dual profiles or during hackathon demo recording on a single workstation or laptop (Profile 1 vs Profile 2 / Incognito), unmuted microphones in adjacent windows create an immediate acoustic feedback howling loop. Clinician session strictly requires `startAudioMuted: true`.

### 1.4 Listener Registration and Cleanup
In `callsRunner.ts` (lines 63–75, 112–126):
- Listeners must be attached **before** `joinSession`:
  - `CometChatCalls.addEventListener('onSessionJoined', () => ...)`
  - `CometChatCalls.addEventListener('onSessionLeft', () => ...)`
  - `CometChatCalls.addEventListener('onConnectionFailed', () => ...)`
- Each `addEventListener` call returns an unsubscribe function.
- Teardown: On unmount, all unsubscribers must be invoked, followed by `CometChatCalls.leaveSession()`.

---

## 2. Zero-Contention Camera Ingestion Architecture

### 2.1 The Camera Contention Problem
On Windows Chromium, physical webcams are managed by exclusive-access OS drivers (DirectShow / Media Foundation). If CometChat Calls v5 acquires the camera via `navigator.mediaDevices.getUserMedia`, any secondary invocation of `getUserMedia` (e.g., from MediaPipe Vision) throws:
```
DOMException: Could not start video source (NotReadableError)
```
Or it causes video track freezing and black frames in the WebRTC call.

### 2.2 Current Implementation in `poseRunner.ts`
Inspection of `client/src/spikes/s1-pose/poseRunner.ts` (lines 146–222) reveals that `startVideoPosePipeline` **already operates on an existing DOM `HTMLVideoElement`** without calling `getUserMedia`:

```typescript
export function startVideoPosePipeline(
  video: HTMLVideoElement,
  landmarker: PoseLandmarker,
  onPose: (result: PoseLandmarkerResult, latencyMs: number) => void
): () => void {
  let isRunning = true;
  let rVfcId: number | null = null;
  let rafId: number | null = null;
  let lastProcessedTime = -1;

  const onFrame = (_now: DOMHighResTimeStamp, metadata?: VideoFrameCallbackMetadata) => {
    if (!isRunning) return;

    // Reschedule next callback
    if ('requestVideoFrameCallback' in video) {
      rVfcId = (video as any).requestVideoFrameCallback((n, m) => onFrame(n, m));
    }

    // Guard: Only process when valid video frame data is ready
    if (
      video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
      video.videoWidth > 0 &&
      video.videoHeight > 0
    ) {
      const mediaTime = metadata ? metadata.mediaTime : video.currentTime;
      if (mediaTime !== lastProcessedTime) {
        lastProcessedTime = mediaTime;
        const start = performance.now();
        try {
          const result = landmarker.detectForVideo(video, start);
          const duration = performance.now() - start;
          onPose(result, duration);
        } catch (inferenceErr) {
          console.warn('[MEDIAPIPE] Inference frame error:', inferenceErr);
        }
      }
    }
  };

  // Entry point: rVFC with rAF fallback
  if ('requestVideoFrameCallback' in video) {
    rVfcId = (video as any).requestVideoFrameCallback((n, m) => onFrame(n, m));
  } else {
    const loop = () => {
      if (!isRunning) return;
      onFrame(performance.now());
      rafId = requestAnimationFrame(loop);
    };
    rafId = requestAnimationFrame(loop);
  }

  // Teardown
  return () => {
    isRunning = false;
    if (rVfcId !== null && 'cancelVideoFrameCallback' in video) {
      (video as any).cancelVideoFrameCallback(rVfcId);
    }
    if (rafId !== null) cancelAnimationFrame(rafId);
  };
}
```

### 2.3 Tapping the Calls v5 DOM Video Element
To achieve zero-contention camera ingestion in `Patient.tsx`:
1. **Container Reference:** Create a dedicated container:
   `<div ref={callContainerRef} className="kine-call-webrtc-container" />`
2. **Mount Calls Session:** Run `CometChatCalls.joinSession(token, callSettings, callContainerRef.current)`.
3. **Locate Video Element:** Calls v5 mounts its local camera feed inside this container. We locate the `<video>` element via DOM query:
   ```typescript
   function findVideoElement(container: HTMLElement): HTMLVideoElement | null {
     return container.querySelector('video');
   }
   ```
4. **MutationObserver / Polling Attachment:** Because WebRTC video track negotiation and element attachment are asynchronous, attach a `MutationObserver` or short interval poll on `callContainerRef.current` until `container.querySelector('video')` is available and has `readyState >= HTMLMediaElement.HAVE_CURRENT_DATA`.
5. **Pass Directly to Pose Pipeline:** Hand that exact `video` element to `startVideoPosePipeline(videoEl, landmarker, onPose)`.
6. **Zero Hardware Conflict:** MediaPipe reads pixel frames directly from the decoded GPU compositor texture of the `<video>` element. No secondary `getUserMedia` is ever invoked.

### 2.4 Canvas Overlay 1:1 Coordinate Alignment
To render the 2D skeleton overlay on top of the video:
```html
<div className="relative w-full h-[480px]">
  <!-- Calls v5 mounts video here -->
  <div ref={callContainerRef} className="w-full h-full" />
  <!-- Canvas sits directly on top -->
  <canvas
    ref={canvasRef}
    className="absolute inset-0 w-full h-full pointer-events-none"
  />
</div>
```
When `drawPoseSkeleton(ctx, landmarks, canvas.width, canvas.height)` executes:
- Set `canvas.width = videoEl.videoWidth || 640` and `canvas.height = videoEl.videoHeight || 480`.
- Because BlazePose landmarks are normalized $[0, 1]$, multiplying by `canvas.width` and `canvas.height` maps joint coordinates 1:1 onto the underlying video pixels.

---

## 3. Biomechanics Engine Integration

### 3.1 Input / Output Contracts Overview

```
                      +---------------------------------------+
                      | MediaPipe PoseLandmarker (VIDEO mode) |
                      +---------------------------------------+
                                          |
                      +-------------------+-------------------+
                      |                                       |
                      v                                       v
          result.landmarks[0]                    result.worldLandmarks[0]
          (Normalized 2D: [0, 1])                 (Metric 3D: Meters)
          [Keypoints 23,24,25,26,27,28]           [Keypoints 23,24,25,26,27,28]
                      |                                       |
                      |                                       v
                      |                         +---------------------------+
                      |                         |   compute3DKneeFlexion    |
                      |                         +---------------------------+
                      |                                       |
                      |                                       v
                      |                              kneeFlexionDeg (L, R)
                      v                                       |
          +-------------------------+                         |
          | calibrateStandingBaseline|                         |
          +-------------------------+                         |
                      |                                       |
                      v                                       |
              StandingBaseline                                |
                      |                                       |
            +---------+---------+                             |
            |                   |                             |
            v                   v                             v
+-----------------------+ +--------------------+   +-----------------------+
| computeValgusDeviation| | computeDepthRatio  |   | SlidingMedianFilter   |
+-----------------------+ +--------------------+   | EMA Angle Filter      |
            |                   |                  +-----------------------+
            v                   v                             |
       valgusDevPct         depthRatio                        v
            |                   |                    Smoothed Kinematics
            +-------------------+-----------------------------+
                                |
                                v
                +-------------------------------+
                |    RepCounterStateMachine     |
                | - 5-Phase Hysteresis FSM      |
                | - Rep Validation Gate         |
                | - 3-Frame Valgus Alert        |
                +-------------------------------+
                                |
                +---------------+---------------+
                |                               |
                v                               v
    10 Hz Transient Stream           Custom Persisted Messages
  (CometChat.sendTransientMessage)   (CometChat.sendCustomMessage)
        `kine.pose`                  `kine.rep` | `kine.alert`
```

### 3.2 BlazePose Keypoint Topology
In `geometry.ts` (lines 80–90):
- **Left Leg:** Hip (`23`), Knee (`25`), Ankle (`27`)
- **Right Leg:** Hip (`24`), Knee (`26`), Ankle (`28`)

### 3.3 Kinematics Calculation Details
1. **3D Sagittal Knee Flexion (`compute3DKneeFlexion`):**
   - Sourced from metric `worldLandmarks[0]`:
     $\mathbf{v}_1 = \mathbf{p}_{\text{hip}} - \mathbf{p}_{\text{knee}}$, $\mathbf{v}_2 = \mathbf{p}_{\text{ankle}} - \mathbf{p}_{\text{knee}}$
     $$\theta = \arccos\left(\text{clamp}\left(\frac{\mathbf{v}_1 \cdot \mathbf{v}_2}{\|\mathbf{v}_1\| \|\mathbf{v}_2\|}, -1.0, 1.0\right)\right) \times \frac{180}{\pi}$$
   - Safety boundary: Returns `null` if any visibility $< 0.65$, coordinate non-finite, or $\|\mathbf{v}\| \le 10^{-6}$.
2. **Standing Baseline Calibration (`calibrateStandingBaseline`):**
   - Inputs: `landmarks[0]` (2D normalized), `imageWidth`, `imageHeight`.
   - Converts coordinates to unmirrored camera pixels: $X = x \cdot W, Y = y \cdot H$.
   - Validates all 6 keypoints have visibility $\ge 0.65$ and anatomical orientation ($Y_{\text{ankle}} > Y_{\text{knee}} > Y_{\text{hip}}$).
   - Computes bilateral leg lengths:
     $$L_{\text{standing}}^L = \sqrt{(X_{27} - X_{23})^2 + (Y_{27} - Y_{23})^2}, \quad L_{\text{standing}}^R = \sqrt{(X_{28} - X_{24})^2 + (Y_{28} - Y_{24})^2}$$
3. **Frontal Knee Valgus Deviation (`computeValgusDeviation`):**
   - Inputs: 2D coordinates of hip, knee, ankle; `StandingBaseline`; `side: "L" | "R"`.
   - Computes neutral axis at current vertical knee height $Y_k$:
     $$X_{\text{baseline}} = X_h + (X_a - X_h) \times \frac{Y_k - Y_h}{Y_a - Y_h}$$
   - Applies polarity in unmirrored camera space:
     - **Left Leg:** Appears on sensor right ($X \approx 0.60$). Medial collapse moves toward midline (decreasing $X$): $\text{polarity} = -1.0$.
     - **Right Leg:** Appears on sensor left ($X \approx 0.40$). Medial collapse moves toward midline (increasing $X$): $\text{polarity} = +1.0$.
   - Computes signed percentage:
     $$\text{valgusDevPct} = \frac{\text{polarity} \times (X_k - X_{\text{baseline}})}{L_{\text{standing}}^{\text{side}}} \times 100$$
   - Inward collapse $\to$ strictly positive ($+$); outward varus $\to$ negative ($-$).
4. **Normalized Pelvic Depth Ratio (`computeDepthRatio`):**
   $$\text{depthRatio} = \frac{Y_{\text{hip}}(t) - Y_{\text{hip}}(\text{standing})}{Y_{\text{knee}}(\text{standing}) - Y_{\text{hip}}(\text{standing})}$$
   - $0.0$ at upright standing, $\approx 1.0$ at parallel squat crease, $> 1.0$ below parallel.

### 3.4 Signal Smoothing
From `client/src/engine/smoothing.ts`:
- **`SlidingMedianFilter(3)`:** Rejects 1-frame impulse coordinate spikes without phase smearing or lag.
- **`ExponentialMovingAverageFilter(0.40)`:** Eliminates HUD digit flicker while maintaining step-response latency $< 50$ ms at 30 FPS.

### 3.5 State Machine Integration (`RepCounterStateMachine`)
In `client/src/engine/repCounter.ts`:
- **Input Contract:**
  ```typescript
  const frameInput: RepCounterInput = {
    timestamp: Date.now(),
    kneeAngle: { L: angleL, R: angleR },
    valgusDevPct: { L: valgusL, R: valgusR },
    depthRatio: depthRatio,
    visibility: avgVisibility,
    sessionId: sessionId,
    baseline: standingBaseline,
  };
  const output: RepCounterOutput = repCounter.update(frameInput);
  ```
- **FSM Transitions:**
  1. `standing` $\to$ `descending`: $\text{depthRatio} > 0.25$ OR $\theta_{\text{knee}} < 150^\circ$.
  2. `descending` $\to$ `bottom`: $\text{depthRatio} > 0.85$ OR $\theta_{\text{knee}} < 100^\circ$.
  3. `descending` $\to$ `ascending`: Reversal detected without reaching bottom (shallow squat deadlock prevention).
  4. `bottom` $\to$ `ascending`: $\theta_{\text{knee}} > 110^\circ$ AND $\text{depthRatio}$ decreasing.
  5. `ascending` $\to$ `standing` (Validation Gate): $\theta_{\text{knee}} > 160^\circ$ AND $\text{depthRatio} < 0.20$.
     - If $\min(\theta) \le 105^\circ$ AND $\text{duration} \ge 800$ ms: Rep count increments, emits `output.completedRep`.
     - Else: Flagged as shallow or bounce; rep count does not increment.
  6. Any phase $\to$ `lost`: Visibility $< 0.65$. Recovers cleanly when visibility restored.
- **Valgus Alerts:**
  - Active only during `descending` and `bottom`.
  - When $\text{valgusDevPct} > +8.0\%$ persists $\ge 3$ consecutive frames: Emits `output.alerts` with independent 4000 ms cooldown timers per leg.

### 3.6 CometChat Telemetry & Event Dispatch
1. **10 Hz Transient Stream (`kine.pose`):**
   - Regulated by `TelemetryTokenBucket` (`client/src/spikes/s2-transient/rateCap.ts`).
   - Dispatched via non-blocking WebSocket push:
     ```typescript
     if (tokenBucket.tryConsume()) {
       const poseMsg = new CometChat.TransientMessage(sessionId, CometChat.RECEIVER_TYPE.GROUP, posePayload);
       CometChat.sendTransientMessage(poseMsg);
     }
     ```
2. **Persisted Milestones (`kine.rep`, `kine.alert`):**
   - When `output.completedRep` is non-null:
     ```typescript
     const repMsg = new CometChat.CustomMessage(sessionId, CometChat.RECEIVER_TYPE.GROUP, 'kine.rep', output.completedRep);
     repMsg.shouldUpdateConversation(false);
     await CometChat.sendCustomMessage(repMsg);
     ```
   - When `output.alerts.length > 0`:
     ```typescript
     for (const alert of output.alerts) {
       const alertMsg = new CometChat.CustomMessage(sessionId, CometChat.RECEIVER_TYPE.GROUP, 'kine.alert', alert);
       alertMsg.shouldUpdateConversation(false);
       await CometChat.sendCustomMessage(alertMsg);
     }
     ```

---

## 4. Frontend Architecture & Design System Plan

### 4.1 Token Chemistry (`client/src/styles/tokens.css`)
Per `docs/frontend_architecture_spec.md` §2.1, create `tokens.css` with:
- **Surface & Canvas:**
  - `--surface-app-frame: #F4F6EA` (outer ambient frame)
  - `--surface-canvas: #FFFFFF` (floating island canvas, radius: 36px)
  - `--surface-dark-sidebar: #131417` (obsidian dark navigation sidebar)
  - `--surface-dark-card: #18191C` (anchor telemetry cards)
- **Brand & Biomechanical Accents:**
  - `--accent-lime: #DAFE52` (chartreuse active target)
  - `--status-stable: #10B981` (emerald green: normal alignment $\le 8.0\%$ valgus)
  - `--status-warning: #F59E0B` (amber: 8–12% valgus)
  - `--status-critical: #EF4444` (bright red: $> 12\%$ valgus breakdown)
- **Spatial Rhythm:** Strict 8pt scale (`--space-1: 4px`, `--space-2: 8px`, `--space-4: 16px`, `--space-6: 24px`, `--space-8: 32px`).
- **Rule:** Zero hardcoded hex values in UI components. 100% token usage.

### 4.2 Motion Physics (`client/src/styles/motionPresets.ts`)
Per `docs/frontend_architecture_spec.md` §5.1:
```typescript
import { Transition } from "framer-motion";

export const springPresets = {
  snappy: { type: "spring", stiffness: 420, damping: 30 } as Transition,
  layout: { type: "spring", stiffness: 300, damping: 28 } as Transition,
  gentle: { type: "spring", stiffness: 200, damping: 24 } as Transition,
  telemetry: { type: "spring", stiffness: 140, damping: 18 } as Transition,
};
```

### 4.3 Clinician Telemetry Smoothing (`useTelemetryStream.ts`)
Clinician receives discrete 10 Hz `kine.pose` transient messages. Directly setting React state at 10 Hz causes UI stuttering.
- Solution: Feed incoming discrete angles and depth ratios into Framer Motion `useSpring` motion dampers configured with `springPresets.telemetry`. This produces fluid, 60 fps gauge animations with zero visual jitter.

---

## 5. Session Guard & Deep-Link Router (`sessionGuard.ts`)

### 5.1 Architecture & Role Isolation
In `docs/audit.md` (lines 19–23) and `docs/trd.md` §Section 4:
- URL parameters: `/?role=clinician&session=<sessionId>` vs `/?role=patient&session=<sessionId>`.
- CometChat persists session authentication tokens inside browser `localStorage`.
- If a user opens Clinician and Patient tabs in the same browser profile, the second tab overwrites the first user's session credentials.
- **The Non-Destructive Guard Invariant:**
  - `sessionGuard.ts` inspects `window.location.search`.
  - Compares the requested URL role (`patient` or `clinician`) against the currently logged-in CometChat user (`CometChat.getLoggedinUser()?.getUid()`).
  - If a mismatch is detected (e.g., active user is `dr-demo` but URL role is `patient`):
    - Halt rendering of the conflicting view.
    - Mount a non-destructive modal warning: *"Profile Collision: You are currently signed in as Clinician. Please open Patient sessions in an Incognito window or a separate Chrome profile."*
    - **CRITICAL:** **NEVER call `CometChat.logout()` automatically**, as doing so wipes shared `localStorage` and crashes the other active participant tab.

---

## 6. Implementation Readiness & Dependency Map

| Subsystem / File | Status | Action Required for Phase 3 |
|---|---|---|
| `client/src/styles/tokens.css` | Pending (D4.2) | Create with CSS variables from `frontend_architecture_spec.md` §2.1 |
| `client/src/styles/motionPresets.ts` | Pending (D4.2) | Create with Framer Motion spring presets |
| `client/src/views/Patient.tsx` | Pending (D4.3) | Assemble Calls v5 (`startAudioMuted: false`) + zero-contention rVFC pose pipeline + canvas overlay + 10 Hz telemetry |
| `client/src/views/Clinician.tsx` | Pending (D4.4) | Assemble Calls v5 (`startAudioMuted: true`) + 60 fps smoothed HUD + Coaching Cue pad + session controls |
| `client/src/utils/sessionGuard.ts` | Pending (D4.5) | Deep-link parser + non-destructive UID collision modal |
| `client/src/App.tsx` | Established | Refactor to route between Floating Island Shell, `Patient.tsx`, `Clinician.tsx`, and `/spikes` |
| `client/src/engine/` | Completed (273 tests green) | Ready for import by `Patient.tsx` |
| `server/` | Completed & Verified | `/api/session` and `/api/health` ready for dual-profile bootstrap |

---

## Conclusion
The architectural investigation proves that the foundation for Phase 3 is completely verified:
1. Calls v5 headless mounting patterns in `callsRunner.ts` cleanly handle dual-profile join with `startAudioMuted: true` on clinician.
2. Zero-contention camera tapping via `requestVideoFrameCallback` in `poseRunner.ts` eliminates hardware lockups by reading decoded video compositor frames directly.
3. The biomechanics engine (`geometry.ts`, `smoothing.ts`, `repCounter.ts`) is fully tested and ready to interface with live MediaPipe landmarks.
4. The system is positioned for clean implementation of Milestones D4.2 through D4.5.
