# Phase 3 Survey Handoff Report (Milestones D4.2 through D4.5)

## 1. Observation
- **Current Baseline Build & Tests:**
  - Running `pnpm vitest run` executes 16 test files, 273 tests, 0 failures in 14.36s (exit code 0).
  - Running `pnpm --filter @kinesio/client exec tsc --noEmit` exits with code 0.
- **File System State in `client/src/`:**
  - `client/src/styles/` does **not** exist.
  - `client/src/views/` does **not** exist.
  - `client/src/components/` does **not** exist.
  - `client/src/utils/` does **not** exist (only `client/src/spikes/utils/` exists).
  - `client/src/index.css` exists (187 lines), but contains legacy dark-mode tokens (`--bg-primary: #0b0f19`, `--accent-cyan: #06b6d4`, etc.) rather than the Floating Island Bento Canvas tokens from `docs/frontend_architecture_spec.md §2.1`.
- **Pre-existing Reusable Spikes & Engine Assets:**
  - `client/src/engine/` contains tested math algorithms: `geometry.ts`, `smoothing.ts`, `repCounter.ts`, `index.ts`.
  - `client/src/spikes/s1-pose/poseRunner.ts` implements `initializePoseLandmarker`, `calculateKneeFlexionAngle`, and `startVideoPosePipeline` (using `requestVideoFrameCallback` to tap frames from DOM `<video>`).
  - `client/src/spikes/s2-transient/rateCap.ts` implements `TelemetryTokenBucket` (10 Hz = 100ms interval).
  - `client/src/spikes/s2-transient/telemetryRunner.ts` implements transient message dispatch and listener attachment.
  - `client/src/spikes/s3-calls/callsRunner.ts` implements Calls SDK v5 join workflow with `startAudioMuted: isClinician`.
  - `client/src/spikes/s4-custom/persistenceRunner.ts` implements custom message dispatch and retrieval with `shouldUpdateConversation(false)`.
- **Mock State in `tests/mocks/`:**
  - `tests/mocks/chat-sdk.ts` (139 lines) lacks `sendTransientMessage`, `TransientMessage`, `MessageListener`, `addMessageListener`, and `removeMessageListener`.
  - `tests/mocks/calls-sdk.ts` (64 lines) provides `CometChatCalls` (`joinSession`, `generateToken`, `leaveSession`).
- **Security & Lifecycle Invariants in Documentation:**
  - `docs/audit.md` §1: "Mechanisms: `sessionGuard.ts` detects active UID vs URL role param... mounts a non-destructive blocking modal... Crucial: It never calls `CometChat.logout()`, which would wipe shared `localStorage` and crash the other active participant tab."
  - `docs/audit.md` §3: "Acoustic Feedback Defense: Clinician session defaults to `startAudioMuted: true` in `SessionSettings`."

## 2. Logic Chain
1. *From Observation (File System State):* Because `client/src/styles/` does not exist, Milestone D4.2 requires creating `client/src/styles/tokens.css` with all §2.1 CSS variables and `client/src/styles/motionPresets.ts` with §5.1 spring physics. The Floating Island shell layout requires an outer frame (`#F4F6EA`), dark sidebar (`#131417`), and floating alabaster canvas (`#FFFFFF`, 36px radius).
2. *From Observation (Pre-existing Spikes & Engine Assets):*
   - For Patient Studio (`client/src/views/Patient.tsx`), the camera contention defense is already solved in `poseRunner.ts`: rather than calling `getUserMedia`, it taps the `<video>` element rendered by Calls SDK via `requestVideoFrameCallback`.
   - The 10 Hz rate limit on `sendTransientMessage` is directly handled by instantiating `TelemetryTokenBucket` from `rateCap.ts`.
   - The valgus alert logic with 4000ms cooldown is already encapsulated in `RepCounterStateMachine.update()`.
   - Clinician coaching cues (`kine.cue`) can be received via `onCustomMessageReceived` and rendered as animated toasts.
3. *From Observation (Acoustic Feedback Invariant):* Clinician Studio (`client/src/views/Clinician.tsx`) must join Calls v5 with `startAudioMuted: true`. This prevents acoustic howling loops when testing locally on a single machine or recording demo videos.
4. *From Observation (Telemetry Smoothing):* Discrete 10 Hz telemetry (`kine.pose`) causes visual stepped jumps if bound directly to DOM meters. Decoupling the receiver into `useTelemetryStream.ts` and damping joint angles/depth with Framer Motion `useSpring(motionValue, springPresets.telemetry)` delivers 60 fps smooth transitions without React re-render churn.
5. *From Observation (Session Guard & Invariant):* `sessionGuard.ts` must parse `?role=clinician|patient&session=<sessionId>`. If the logged-in CometChat user UID conflicts with the requested role (e.g. `dr-demo` vs `patient`), calling `CometChat.logout()` automatically would wipe `localStorage` and crash the other tab. Therefore, it must render a non-destructive `RoleConflictModal` offering an explicit confirmation or suggesting Incognito/separate Chrome profile.
6. *From Observation (Mock State in `tests/mocks/`):* `tests/mocks/chat-sdk.ts` must be extended with `sendTransientMessage`, `TransientMessage`, and `addMessageListener`/`removeMessageListener` to enable writing the automated dual-profile interaction test suite without external network calls.

## 3. Caveats
- **React 19 StrictMode Lifecycle:** `client/src/main.tsx` mounts `<App />` inside `<React.StrictMode>`. In development mode, `useEffect` hooks run twice on mount. All CometChat listener attachments (`addMessageListener`), WebRTC session initializations, and animation frame loops must have strict cleanup functions to avoid duplicate listeners or memory leaks.
- **Browser Camera Permissions:** When testing locally across dual tabs, Chromium allows camera sharing on `localhost`. However, Windows webcam drivers may lock hardware access if two separate processes try to acquire exclusive camera handles. Because Calls SDK handles the camera and Patient taps the compositor texture via `requestVideoFrameCallback`, camera contention within the tab is avoided.

## 4. Conclusion
Phase 3 is ready for implementation by the builder/implementer agent. The architectural requirements are fully mapped, all math/spike building blocks exist and are verified, and the exact files to create and test have been specified in `analysis.md`:
1. `client/src/styles/tokens.css` & `motionPresets.ts` (D4.2)
2. `client/src/views/Patient.tsx` (D4.3)
3. `client/src/views/Clinician.tsx` & `client/src/hooks/useTelemetryStream.ts` (D4.4)
4. `client/src/utils/sessionGuard.ts` & `client/src/components/RoleConflictModal.tsx` (D4.5)
5. `tests/mocks/chat-sdk.ts` extension & automated test suites (`dualProfileInteractions.test.ts`, `sessionGuard.test.ts`)

## 5. Verification Method
- Independent static check:
  ```powershell
  pnpm --filter @kinesio/client exec tsc --noEmit
  ```
- Independent test check:
  ```powershell
  pnpm vitest run
  ```
- File inspection:
  - Verify `analysis.md` at `d:/TP/Hackathon/Cometchat/.agents/teamwork/explorer_survey_3/analysis.md`
  - Verify `handoff.md` at `d:/TP/Hackathon/Cometchat/.agents/teamwork/explorer_survey_3/handoff.md`
- Invalidation conditions:
  - Any raw hex code found in `client/src/views/` or `client/src/components/`.
  - Automatic `CometChat.logout()` called in `sessionGuard.ts` on conflict detection.
  - Clinician joining Calls v5 with `startAudioMuted: false`.
