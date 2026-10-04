# Handoff Report — Phase 3 Architectural Survey (D4.2 – D4.5)

> **Folder:** `.agents/teamwork/explorer_survey_1/`  
> **Report Date:** 2026-10-04  
> **Author:** Explorer Survey Agent (`explorer_survey_1`)  
> **Recipient:** Parent Orchestrator (`a77c14a7-77c2-49ff-ac55-3cd4ed6cb622`)  
> **Full Analysis:** Reference `analysis.md` in this directory  

---

## 1. Observation

1. **Calls v5 Session Join & Audio Muting (`client/src/spikes/s3-calls/callsRunner.ts:83–105`):**
   ```typescript
   const isClinician = role === 'clinician';
   const callSettings: SessionSettings = {
     sessionType: 'VIDEO',
     layout: 'TILE',
     startAudioMuted: isClinician,
     startVideoPaused: false,
     hideControlPanel: false,
     ...
   };
   const joinResult = await CometChatCalls.joinSession(callToken, callSettings, containerElement);
   ```
   Observed that Calls v5 mounts its WebRTC video interface into `containerElement`. When `role === 'clinician'`, `startAudioMuted` is explicitly set to `true`, preventing acoustic feedback between adjacent tabs. Patient mounts with `startAudioMuted: false`.

2. **Video Element Frame Ingestion (`client/src/spikes/s1-pose/poseRunner.ts:146–222`):**
   ```typescript
   export function startVideoPosePipeline(
     video: HTMLVideoElement,
     landmarker: PoseLandmarker,
     onPose: (result: PoseLandmarkerResult, latencyMs: number) => void
   ): () => void
   ```
   Lines 159–170 use `video.requestVideoFrameCallback` (with `requestAnimationFrame` fallback) to intercept decoded compositor frames directly from an existing DOM `HTMLVideoElement`. `landmarker.detectForVideo(video, start)` runs without calling `navigator.mediaDevices.getUserMedia()`.

3. **Camera Contention Invariant (`docs/audit.md:42`):**
   "Calls SDK v5 internally calls `getUserMedia` to render into its container. If MediaPipe makes an independent `getUserMedia` request, Windows camera drivers throw `NotReadableError`. KinesioLive attaches MediaPipe directly to the `<video>` element created by Calls SDK inside the mount container via `requestVideoFrameCallback`, eliminating concurrent camera contention."

4. **Biomechanics Engine Topology and Contracts (`client/src/engine/`):**
   - `geometry.ts`: `compute3DKneeFlexion` takes 3D metric `Point3D` (`worldLandmarks[0]`) for keypoints [23, 25, 27] and [24, 26, 28]. `calibrateStandingBaseline` takes 2D normalized `landmarks[0]`. `computeValgusDeviation` computes polarity-corrected percentage ($+1.0$ Right, $-1.0$ Left). `computeDepthRatio` normalizes hip descent.
   - `smoothing.ts`: `SlidingMedianFilter(3)` rejects 1-frame coordinate spikes; `ExponentialMovingAverageFilter(0.40)` provides display smoothing with $< 50$ ms step-response latency.
   - `repCounter.ts`: `RepCounterStateMachine` processes frame inputs (`RepCounterInput`), manages 5-phase hysteresis FSM, validates reps ($\le 105^\circ$, $\ge 800$ ms), and emits `KineRepPayload` and `KineAlertPayload` (persisting valgus $> 8.0\%$ for $\ge 3$ frames with 4.0s cooldown).

5. **Test Suite Verification:**
   Executed `pnpm vitest run`:
   - 16 test files passed, 273 tests green (0 failures).
   Executed `pnpm --filter @kinesio/client exec tsc --noEmit; pnpm --filter @kinesio/server exec tsc --noEmit`:
   - Exited with code 0.

---

## 2. Logic Chain

1. **From Observation 1 & 3 to Calls v5 Architecture Conclusion:**
   Because CometChat Calls v5 renders WebRTC media directly into child `<video>` elements of the mounted DOM container, and because Windows camera drivers lock the device on `getUserMedia`, the patient's video stream is already available in the DOM as soon as `CometChatCalls.joinSession()` resolves. By setting `startAudioMuted: false` for the patient and `startAudioMuted: true` for the clinician, dual-profile testing and demo recording can occur without acoustic feedback.
2. **From Observation 2 & 3 to Zero-Contention Camera Tapping Conclusion:**
   Because `poseRunner.ts` already provides `startVideoPosePipeline` accepting an `HTMLVideoElement` and using `requestVideoFrameCallback`, the patient view (`Patient.tsx`) does not need to call `getUserMedia`. Instead, it locates the rendered `<video>` element inside the Calls SDK container (`container.querySelector('video')`) and attaches `startVideoPosePipeline`. This completely circumvents Windows `NotReadableError` and runs inference synchronously with GPU frame presentation.
3. **From Observation 4 to Biomechanics Integration Conclusion:**
   `MediaPipe PoseLandmarker` produces `landmarks[0]` (2D normalized $[0, 1]$) and `worldLandmarks[0]` (3D metric in meters). These inputs feed directly into `compute3DKneeFlexion`, `calibrateStandingBaseline`, `computeValgusDeviation`, and `computeDepthRatio`. The resulting angles and depth ratios are filtered via `SlidingMedianFilter` and `ExponentialMovingAverageFilter`, then passed to `RepCounterStateMachine.update()`.
4. **From Observation 4 & 5 to Telemetry & Messaging Conclusion:**
   The output of `RepCounterStateMachine` feeds two channels:
   - 10 Hz transient messages (`KinePosePayload`) via `TelemetryTokenBucket` to `CometChat.sendTransientMessage` for real-time clinician HUD display.
   - Custom persisted messages (`kine.rep` and `kine.alert`) via `CometChat.sendCustomMessage` when milestones or form breakdowns occur.

---

## 3. Caveats

1. **Calls SDK DOM Rendering Delay:** Calls SDK v5 creates the internal `<video>` element asynchronously after WebRTC track negotiation. The patient component must use a `MutationObserver` or polling check (`readyState >= HAVE_CURRENT_DATA`) to attach `startVideoPosePipeline` only once the `<video>` element exists and is active.
2. **Cross-Profile Session Isolation in Browser:** Because CometChat JS SDK stores user tokens in `localStorage`, running clinician and patient in the same browser profile simultaneously will overwrite session state. They must run in separate Chrome profiles or one normal and one incognito window. `sessionGuard.ts` will detect this and show a non-destructive blocking modal without calling `CometChat.logout()`.
3. **No Code Edits Performed:** This investigation was strictly READ-ONLY. No production code was modified.

---

## 4. Conclusion

The architectural foundations for Phase 3 (D4.2–D4.5) are sound, thoroughly verified by tests, and ready for immediate implementation:
- **D4.2 (Design Tokens & Shell):** Ready to implement `tokens.css` and `motionPresets.ts` from `docs/frontend_architecture_spec.md`.
- **D4.3 (Patient Studio):** Calls v5 mounts with `startAudioMuted: false`; zero-contention camera tapping uses `requestVideoFrameCallback` on the container's `<video>` element; pose stream feeds `geometry.ts` and `RepCounterStateMachine`; 10 Hz rate-capped transient telemetry sends `kine.pose`.
- **D4.4 (Clinician Studio):** Calls v5 mounts with `startAudioMuted: true`; `useTelemetryStream` ingests `kine.pose` and damps with `useSpring`; tactile cue buttons dispatch `kine.cue`.
- **D4.5 (Session Guard):** Deep-link routing validates role and mounts non-destructive modal on UID mismatch.

---

## 5. Verification Method

To independently verify these findings:
1. **Run full Vitest test suite:**
   ```powershell
   pnpm vitest run
   ```
   *Expected result:* 16 test files pass, 273 tests green.
2. **Run TypeScript compiler check:**
   ```powershell
   pnpm --filter @kinesio/client exec tsc --noEmit; pnpm --filter @kinesio/server exec tsc --noEmit
   ```
   *Expected result:* Exit code 0, zero diagnostic errors.
3. **Inspect surveyed files:**
   - `client/src/spikes/s3-calls/callsRunner.ts` (Lines 83–105 for `SessionSettings` and DOM join)
   - `client/src/spikes/s1-pose/poseRunner.ts` (Lines 146–222 for `startVideoPosePipeline` and `rVFC`)
   - `client/src/engine/` (`geometry.ts`, `smoothing.ts`, `repCounter.ts` for biomechanics contracts)
