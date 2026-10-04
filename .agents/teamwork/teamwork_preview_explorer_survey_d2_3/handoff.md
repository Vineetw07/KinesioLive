# Handoff Report: MediaPipe PoseLandmarker & Video Pipeline Survey (Spike S1 / D2.1)

## 1. Observation
- **Package & Dependency State:**
  - `client/package.json` specifies `"@mediapipe/tasks-vision": "^0.10.14"`, resolved to version `0.10.35` in `node_modules/@mediapipe/tasks-vision/package.json`.
  - Exported members inspected via Node.js: `FilesetResolver`, `PoseLandmarker`, `DrawingUtils`, `POSE_CONNECTIONS`.
  - Methods on `PoseLandmarker`: `createFromOptions`, `detectForVideo`, `detect`, `setOptions`.
  - Required WASM files verified in package: `vision_wasm_internal.js`, `vision_wasm_internal.wasm`, `vision_wasm_nosimd_internal.js`, `vision_wasm_nosimd_internal.wasm`, `vision_wasm_module_internal.js`, `vision_wasm_module_internal.wasm`.
- **System Constraints & Architectural Contracts:**
  - `docs/audit.md` line 42:
    > "Hardware Camera Contention Defense (Windows/Chromium): Calls SDK v5 internally calls getUserMedia to render into its container. If MediaPipe makes an independent getUserMedia request, Windows camera drivers throw NotReadableError. KinesioLive attaches MediaPipe directly to the <video> element created by Calls SDK inside the mount container via requestVideoFrameCallback, eliminating concurrent camera contention."
  - `docs/trd.md` Section 3:
    - 3D Sagittal Knee Flexion is computed from `worldLandmarks` metric coordinates: $\mathbf{v}_1 = \mathbf{p}_h - \mathbf{p}_k, \mathbf{v}_2 = \mathbf{p}_a - \mathbf{p}_k$.
    - Frontal Knee Valgus is computed from unmirrored 2D `landmarks` normalized to standing leg length baseline $L_{\text{standing}}$, with Left leg polarity $-1$ and Right leg polarity $+1$.
    - Minimum landmark visibility threshold: $0.65$. Below $0.65$, phase is `"lost"`.
  - `docs/implementation_plan.md` Section 6, Milestone D2.1 (Spike S1):
    - Target: Initialize `@mediapipe/tasks-vision` PoseLandmarker on video element, sustaining $\ge 15$ FPS with zero WebRTC video stuttering.
- **Build Verification:**
  - `pnpm --filter @kinesio/client exec tsc --noEmit` exited with code 0.
  - `pnpm --filter @kinesio/client build` completed in 4.49s and exited with code 0.

## 2. Logic Chain
1. **PoseLandmarker Initialization:**
   - From our package inspection, `@mediapipe/tasks-vision@0.10.35` requires a WASM fileset URL.
   - Using `FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm")` points to exact pinned binaries.
   - For `runningMode: "VIDEO"`, `PoseLandmarker.createFromOptions` requires `modelAssetPath` set to `pose_landmarker_lite.task` (`https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task`), which provides the lowest latency (~15–25ms) and produces both `landmarks` and `worldLandmarks`.
   - Wrapping with GPU-to-CPU fallback guarantees initialization succeeds across diverse execution environments.
2. **Camera Track Contention Defense:**
   - On Windows, independent `getUserMedia` calls on the same physical camera trigger OS driver collisions (`NotReadableError`).
   - Because Calls SDK v5 (or local preview) attaches the single `MediaStream` to an `HTMLVideoElement`, MediaPipe can call `detectForVideo(videoElement, timestamp)`.
   - `detectForVideo` reads from the browser video compositor buffer and never touches the underlying `MediaStreamTrack` or hardware driver.
   - Wiring this via `videoElement.requestVideoFrameCallback` guarantees execution is locked to decoded video frame delivery (~30 FPS) rather than the screen refresh rate (60–144 Hz), eliminating duplicate inferences and CPU waste.
3. **33 Landmarks Validation:**
   - `detectForVideo` returns `PoseLandmarkerResult` with 33 normalized `landmarks` and 33 metric `worldLandmarks`.
   - All joints required by TRD Section 3 (hips 23/24, knees 25/26, ankles 27/28) are present and verifiable.
4. **Live FPS Benchmark:**
   - A sliding 30-frame window measures instantaneous and rolling FPS, while a benchmark accumulator computes sustained FPS over 5+ seconds.
   - Because BlazePose Lite runs in 15–25ms on GPU, sustained FPS will sit between 28–30 FPS on 30 FPS video feeds, comfortably exceeding the $\ge 15.0$ FPS acceptance criteria.
5. **Synthetic / Automated Fallback:**
   - In automated environments or machines without webcams, `getUserMedia` fails.
   - A test video source (looping reference video e.g. `/fixtures/squat_reference.webm` or procedural canvas stream) attached to the `<video>` element allows deterministic validation of 33 keypoints and live FPS measurement without physical hardware.

## 3. Caveats
- GPU delegation requires WebGL/WebGPU support in the browser. In virtualized or headless CI runners, GPU initialization may throw; the CPU delegate fallback handles this.
- If the video element has zero dimensions or `readyState < HAVE_CURRENT_DATA` (2), `detectForVideo` will throw; frame processing must be guarded with `readyState >= 2 && videoWidth > 0`.
- Offline local development without internet requires serving the WASM files from `client/public/wasm/` rather than the jsdelivr CDN.

## 4. Conclusion
Spike S1 (D2.1) has a clear, robust implementation path:
- `@mediapipe/tasks-vision` can be loaded dynamically in Vite with `FilesetResolver.forVisionTasks` pointing to CDN `0.10.35` and model `pose_landmarker_lite.task`.
- Camera contention is completely avoided by tapping the DOM `<video>` element via `requestVideoFrameCallback`.
- Sustained $\ge 15$ FPS benchmark is achievable with BlazePose Lite and measurable via a sliding window FPS meter.
- A synthetic video fallback ensures deterministic testing in automated and no-webcam environments.
Full details and drop-in code snippets are documented in `d:/TP/Hackathon/Cometchat/.agents/teamwork/teamwork_preview_explorer_survey_d2_3/report.md`.

## 5. Verification Method
1. **Compilation & Build Verification:**
   ```powershell
   pnpm --filter @kinesio/client exec tsc --noEmit
   pnpm --filter @kinesio/client build
   ```
2. **File Inspection:**
   - Inspect survey report: `d:/TP/Hackathon/Cometchat/.agents/teamwork/teamwork_preview_explorer_survey_d2_3/report.md`
   - Inspect dispatch: `d:/TP/Hackathon/Cometchat/.agents/teamwork/teamwork_preview_explorer_survey_d2_3/DISPATCH.md`
3. **Runtime Spike Verification (Once Implemented in `SpikesHarness.tsx`):**
   - Navigate to `/spikes` in client dev server.
   - Verify Pose Landmarker initialization displays green `READY` status.
   - Verify continuous 33 landmark detection with sustained FPS readout $\ge 15$ FPS.
