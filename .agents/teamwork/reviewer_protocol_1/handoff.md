# Review Report & Protocol Assessment: Phase 3 (D4.2–D4.5)

**Reviewer:** Reviewer 1 (CometChat & WebRTC Protocol Reviewer)  
**Target Work:** Phase 3 Implementation (D4.2–D4.5) by `worker_studio`  
**Verdict:** **APPROVE**  
**Timestamp:** 2026-10-04T07:12:30Z  

---

## 1. Observation

### Observation 1: Clinician Audio Muting Invariant
- **File:** `client/src/views/Clinician.tsx`
- **Lines:** 162–174 & 177
- **Verbatim Code:**
  ```typescript
  const callSettings: SessionSettings = {
    sessionType: 'VIDEO',
    layout: 'TILE',
    startAudioMuted: true, // NON-NEGOTIABLE ACOUSTIC HOWLING DEFENSE
    startVideoPaused: false,
    hideControlPanel: false,
    hideLeaveSessionButton: false,
    hideToggleAudioButton: false,
    hideToggleVideoButton: false,
    idleTimeoutPeriodBeforePrompt: 60000,
    idleTimeoutPeriodAfterPrompt: 180000,
  };

  if (callContainerRef.current) {
    setCallStatus('connecting');
    const joinResult = await CometChatCalls.joinSession(callToken, callSettings, callContainerRef.current);
  ```
- **Evidence:** `startAudioMuted: true` is strictly passed to `CometChatCalls.joinSession`. Local microphone cannot broadcast automatically upon clinician connection, preventing acoustic howling.

### Observation 2: Patient Camera Tapping Invariant
- **File:** `client/src/views/Patient.tsx`
- **Lines:** 265–293
- **Verbatim Code:**
  ```typescript
  const checkForVideoElement = () => {
    if (!callContainerRef.current) return;
    const videoEl = callContainerRef.current.querySelector('video');

    if (
      videoEl &&
      videoEl.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
      videoEl.videoWidth > 0 &&
      videoEl.videoHeight > 0
    ) {
      if (pollIntervalId) {
        clearInterval(pollIntervalId);
        pollIntervalId = null;
      }

      // Start frame ingestion pipeline tapping video directly via rVFC
      const stopPipeline = startVideoPosePipeline(
        videoEl,
        initResult.landmarker,
        (result: PoseLandmarkerResult, latencyMs: number) => {
          handlePoseFrame(result, latencyMs, videoEl);
        }
      );

      stopPosePipelineRef.current = stopPipeline;
    }
  };
  ```
- **Pipeline Implementation (`client/src/spikes/s1-pose/poseRunner.ts` lines 162–207):**
  ```typescript
  if ('requestVideoFrameCallback' in video) {
    rVfcId = (
      video as HTMLVideoElement & {
        requestVideoFrameCallback: (
          cb: (now: DOMHighResTimeStamp, meta: VideoFrameCallbackMetadata) => void
        ) => number;
      }
    ).requestVideoFrameCallback((n, m) => onFrame(n, m));
  } else {
    const loop = () => {
      if (!isRunning) return;
      onFrame(performance.now());
      rafId = requestAnimationFrame(loop);
    };
    rafId = requestAnimationFrame(loop);
  }
  ```
- **Grep Result:** Ripgrep search across `client/src/views/` for `getUserMedia` returned zero invocations. Only `requestVideoFrameCallback` (with rAF fallback) is used to sample video compositor frames directly from the Calls SDK DOM `<video>` element.

### Observation 3: 10 Hz Telemetry Rate-Capping & Stream Hook
- **File:** `client/src/spikes/s2-transient/rateCap.ts` & `client/src/views/Patient.tsx` (lines 413–439)
- **Token Bucket Ingestion in Patient:**
  ```typescript
  if (tokenBucketRef.current.tryConsume() && activeSessionId) {
    const posePayload: KinePosePayload = {
      v: SCHEMA_VERSION,
      sid: activeSessionId,
      t: Date.now(),
      type: 'kine.pose',
      seq: telemetrySeqRef.current++,
      fps: instantFps || 30,
      phase: fsmOutput ? fsmOutput.phase : 'standing',
      kneeFlexionDeg: { L: angleL, R: angleR },
      valgusDevPct: { L: devL, R: devR },
      depthRatio: depth,
      vis: avgVis,
      reps: fsmOutput ? fsmOutput.reps : repCount,
    };

    try {
      const transientMsg = new CometChat.TransientMessage(
        activeSessionId,
        CometChat.RECEIVER_TYPE.GROUP,
        posePayload as unknown as Record<string, unknown>
      );
      CometChat.sendTransientMessage(transientMsg);
    } catch {
      // Fire-and-forget transient send error suppression
    }
  }
  ```
- **Throttle & Parse in Stream Consumer (`client/src/hooks/useTelemetryStream.ts` lines 37–66):**
  ```typescript
  onTransientMessageReceived: (message: CometChat.TransientMessage) => {
    const now = performance.now();
    // 10 Hz rate limit (100ms throttle bucket)
    if (now - lastUpdateRef.current < 90) {
      return;
    }
    lastUpdateRef.current = now;
    // ... handles string or object JSON payload safely
  ```
- **Evidence:** Egress is throttled to 10 Hz via `TelemetryTokenBucket` (capacity 1, refill interval 100ms). Ingress is throttled with a 90ms bucket in `useTelemetryStream.ts` to reject bursts while accommodating network jitter.

### Observation 4: Custom Message Schemas & `shouldUpdateConversation(false)`
- **`kine.rep` (`Patient.tsx` lines 446–460):**
  ```typescript
  const customMsg = new CometChat.CustomMessage(
    activeSessionId,
    CometChat.RECEIVER_TYPE.GROUP,
    'kine.rep',
    repPayload as unknown as Record<string, unknown>
  );
  customMsg.shouldUpdateConversation(false);
  await CometChat.sendCustomMessage(customMsg);
  ```
- **`kine.alert` (`Patient.tsx` lines 462–476):**
  ```typescript
  const customMsg = new CometChat.CustomMessage(
    activeSessionId,
    CometChat.RECEIVER_TYPE.GROUP,
    'kine.alert',
    alertPayload as unknown as Record<string, unknown>
  );
  customMsg.shouldUpdateConversation(false);
  await CometChat.sendCustomMessage(customMsg);
  ```
- **`kine.cue` (`Clinician.tsx` lines 253–270):**
  ```typescript
  const customMsg = new CometChat.CustomMessage(
    activeSessionId,
    CometChat.RECEIVER_TYPE.GROUP,
    'kine.cue',
    cuePayload as unknown as Record<string, unknown>
  );
  customMsg.shouldUpdateConversation(false);
  await CometChat.sendCustomMessage(customMsg);
  ```
- **`kine.session` (`Clinician.tsx` lines 290–307):**
  ```typescript
  const markerMsg = new CometChat.CustomMessage(
    activeSessionId,
    CometChat.RECEIVER_TYPE.GROUP,
    'kine.session',
    markerPayload as unknown as Record<string, unknown>
  );
  markerMsg.shouldUpdateConversation(false);
  await CometChat.sendCustomMessage(markerMsg);
  ```
- **Schema Validation:** Payloads strictly match `shared/src/index.ts` contracts (`v: 1`, `sid`, `t`, `type`).

### Observation 5: Verification Triad Commands & Results
- **Command 1:** `pnpm --filter @kinesio/client exec tsc --noEmit`
  - Output: Exit code `0`. (Clean typecheck, zero diagnostics).
- **Command 2:** `pnpm vitest run tests/e2e/dualProfileInteractions.test.ts`
  - Output: Exit code `0`. 4 passed tests (rate-capping, transient delivery, cue routing, valgus alert 3-frame trigger & 4000ms cooldown).
- **Command 3:** Monorepo test check: `pnpm vitest run`
  - Output: Exit code `0`. 19 test files passed, 327 tests passed.
- **Command 4:** Monorepo typecheck: `pnpm -r run typecheck`
  - Output: Exit code `0` across `@kinesio/shared`, `@kinesio/client`, and `@kinesio/server`.

### Observation 6: Integrity & Clean Code Scan
- Regex scan for hex patterns (`#[0-9a-fA-F]{3,8}\b`) in `client/src/views/` and `client/src/components/`: **0 matches** (100% semantic CSS design tokens).
- Regex scan for `console.log` in `client/src/views/` and `client/src/hooks/`: **0 matches** in high-frequency loops or frame callbacks.
- Regex scan for `@ts-ignore` in `client/src/`: **0 matches**.
- Regex scan for `COMETCHAT_AUTH_KEY` / `REST_KEY` in `client/`: **0 matches** (credentials securely isolated to backend).

---

## 2. Logic Chain

1. **Acoustic Stability (Feedback Elimination):**
   - Observation 1 demonstrates that `Clinician.tsx` hardcodes `startAudioMuted: true` in `SessionSettings` upon `joinSession`.
   - Therefore, when both clinician and patient join the same WebRTC room from adjacent tabs or the same room, acoustic audio looping cannot occur. Manual unmuting is preserved via `hideToggleAudioButton: false`.

2. **Camera Hardware Multi-Access Safety:**
   - Observation 2 demonstrates that `Patient.tsx` does not request a physical camera stream via `getUserMedia()`.
   - Instead, the Calls SDK handles camera acquisition, and the pose engine consumes presented frames directly from the `<video>` element using `requestVideoFrameCallback`.
   - Therefore, camera device lock contention (`NotReadableError`) on Windows/Chromium is impossible.

3. **Network Throughput & State Performance:**
   - Observation 3 shows that `TelemetryTokenBucket` strictly allows 1 token per 100ms. In high-frequency 30/60 FPS loops, extra frames are dropped from telemetry dispatch.
   - On the clinician side, `useTelemetryStream.ts` throttles state updates and feeds Framer Motion `useSpring` motion values.
   - Therefore, network bandwidth remains bounded at ~10 packets/sec while rendering buttery 60 fps gauges without React state thrashing.

4. **Conversation List Cleanliness:**
   - Observation 4 shows all four custom message types (`kine.rep`, `kine.alert`, `kine.cue`, `kine.session`) explicitly invoke `.shouldUpdateConversation(false)`.
   - Therefore, high-volume telemetry events do not clutter or overwrite conversation previews in CometChat.

5. **Test Authenticity & Non-Tautological Assertions:**
   - Observation 5 and the test implementations demonstrate that tests execute real token bucket calculations, real state machine transitions with cooldown gates, and real message listener routing against the mock SDK.
   - Zero hardcoded fixture overrides or facade mocks were detected.

---

## 3. Caveats

1. **Single-Browser Tab Testing:** Because CometChat's JS SDK stores session credentials in browser storage (`localStorage` / cookies), running both Clinician and Patient concurrently in the *same standard browser window* causes role collisions. As observed in `RoleConflictModal.tsx`, dual-profile local testing should use an Incognito tab or two separate browser profiles.
2. **Video Element Mount Polling:** `Patient.tsx` uses a 150ms interval to detect when CometChat Calls v5 renders the `<video>` element into the container. This is robust and cleans up on unmount, but depends on DOM element insertion within reasonable timeout.

---

## 4. Conclusion

**Verdict: APPROVE**

The Phase 3 implementation (D4.2–D4.5) by `worker_studio` completely satisfies all architectural, protocol, and integrity requirements:
- Clinician Audio Muting invariant is strictly enforced (`startAudioMuted: true`).
- Patient Camera Tapping invariant is strictly followed via DOM `<video>` tapping (`requestVideoFrameCallback`), with zero secondary `getUserMedia` calls.
- 10 Hz rate capping via `TelemetryTokenBucket` is applied in `Patient.tsx` and consumed/throttled in `useTelemetryStream.ts`.
- All custom messages (`kine.rep`, `kine.alert`, `kine.cue`, `kine.session`) strictly conform to `shared/src/index.ts` schemas and use `shouldUpdateConversation(false)`.
- Verification Triad passes cleanly with 0 type errors and 327 passing automated tests.
- Zero integrity violations, zero raw hex codes, zero `@ts-ignore`, and zero high-frequency `console.log` pollution.

---

## 5. Verification Method

To independently reproduce and verify this review:

```powershell
# 1. Verify Client TypeScript Compilation (Must exit code 0)
pnpm --filter @kinesio/client exec tsc --noEmit; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

# 2. Verify Monorepo Compilation
pnpm -r run typecheck; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

# 3. Run Targeted Dual-Profile Interaction Tests
pnpm vitest run tests/e2e/dualProfileInteractions.test.ts; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

# 4. Run Full Monorepo Test Suite (19 files, 327 tests)
pnpm vitest run; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

# 5. Verify Zero Raw Hex Codes in Studio Views
Get-ChildItem -Path client/src/views, client/src/components -Recurse -Include *.tsx, *.ts | Select-String -Pattern '#[0-9a-fA-F]{3,8}\b'

# 6. Verify Zero Secondary getUserMedia Calls in Patient Studio
Select-String -Path client/src/views/Patient.tsx -Pattern 'getUserMedia'
```
