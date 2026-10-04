# Task Assignment: Spikes Testbed Implementation (Spikes S1–S5 / D2.1–D2.5)

## Role & Archetype
- TypeName: teamwork_preview_worker
- Role: Spikes Implementation Worker
- Working directory: d:/TP/Hackathon/Cometchat/.agents/teamwork/teamwork_preview_worker_spikes/

## Context & Inputs
- Authoritative User Request: `d:/TP/Hackathon/Cometchat/.agents/teamwork/ORIGINAL_REQUEST.md` (Section `## 2026-10-03T19:41:01Z`)
- Milestone Scope & Contracts: `d:/TP/Hackathon/Cometchat/.agents/teamwork/orchestrator_2/SCOPE.md`
- Survey Reports:
  - Client Architecture & Route Mount: `d:/TP/Hackathon/Cometchat/.agents/teamwork/teamwork_preview_explorer_survey_d2_1/report.md`
  - CometChat Calls v5 & Chat SDK Specs: `d:/TP/Hackathon/Cometchat/.agents/teamwork/teamwork_preview_spec_miner_survey_d2_2/report.md`
  - MediaPipe Pose & Video Element Pipeline: `d:/TP/Hackathon/Cometchat/.agents/teamwork/teamwork_preview_explorer_survey_d2_3/report.md`
- CometChat Rules: `.cometchat/skills/RULES.md`
- CometChat Calls SDK v5 Guide: `.cometchat/skills/cometchat-js-v5-sdk/SKILL.md`
- Shared Contracts: `shared/src/index.ts`
- Verified MCP Integration Log: `COMETCHAT_INTEGRATION.md`

## Mandatory Integrity Warning
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## Write Ownership
You own the following files exclusively:
- All files under `client/src/spikes/`
- `client/src/App.tsx` (surgical diff to add `/spikes` pathname route & nav buttons, retaining existing Live Session view)
- `COMETCHAT_INTEGRATION.md` (log any MCP-verified operations)

## Requirements & Implementation Deliverables

### 1. Route Mounting & Harness Shell (Spike S5 / D2.5)
- In `client/src/App.tsx`, implement the native pathname router (`window.location.pathname` + `popstate`) and `React.lazy(() => import('./spikes/SpikesHarness'))` per Survey 1 recommendations. Provide a clean header navigation toggle between "Live Session" (`/`) and "⚡ Spikes Testbed" (`/spikes`).
- In `client/src/spikes/SpikesHarness.tsx`, build the interactive testbed HUD:
  - Responsive split-tab interface: `[ 📋 Overview & Gate | 🧘 S1: Pose Landmarker | ⚡ S2: 10 Hz Telemetry | 📞 S3: Calls v5 Join | 💾 S4: Custom Message Persistence ]`.
  - Top action bar with master "▶ Run All Spikes" test runner and "↺ Reset All".
  - Live status chips (`PASS`, `FAIL`, `RUNNING`, `IDLE`).
  - Formal D2.5 Kill-Switch Evaluation Gate table summarizing status for all 4 spikes.
  - Scrollable real-time event & telemetry console.

### 2. Spike S1 (D2.1) — MediaPipe Pose Inference on Video Element
- Directory: `client/src/spikes/s1-pose/`
- Initialize `@mediapipe/tasks-vision` `PoseLandmarker` using `FilesetResolver.forVisionTasks` (`https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm`) and `pose_landmarker_lite.task` with GPU delegate (and graceful CPU fallback).
- Camera contention defense: Tap DOM `<video>` element using `requestVideoFrameCallback` (or rAF fallback) — zero second camera track creation.
- 33 keypoints detection: Extract 2D `landmarks` and 3D `worldLandmarks`, draw skeleton overlay on canvas, verify 33 landmarks detected.
- Live FPS benchmark: Sustained inference FPS $\ge 15.0$ with rolling window and sustained accumulator.
- 3-tier video source selector:
  1. Live Webcam (`getUserMedia`).
  2. Reference Video (looping video).
  3. Procedural Canvas Video Generator (`canvas.captureStream(30)`) for automated/headless test environments.

### 3. Spike S3 (D2.2) — Dual-Profile CometChat Calls v5 Session Join
- Directory: `client/src/spikes/s3-calls/`
- Fetch session credentials from `POST /api/session` (`{ role, sessionId }`). Zero Auth Keys or REST Keys on client!
- Execute verified SDK sequence:
  `CometChat.init(...)` -> `CometChat.login(authToken)` -> `CometChatCalls.init({ appId, region })` -> `CometChatCalls.loginWithAuthToken(authToken)` -> `CometChatCalls.generateToken(sessionId)` -> `CometChatCalls.joinSession(token, callSettings, containerElement)`.
- Enforce `startAudioMuted: true` on clinician role.
- Container element sizing: Ensure container has explicit non-zero height (`100%` / fixed min-height).
- Measure connection latency ($< 3.0$ s target) and display live connection state.

### 4. Spike S2 (D2.3) — 10 Hz Transient Message Telemetry Throughput
- Directory: `client/src/spikes/s2-transient/`
- 10 Hz token bucket rate limiter: Transmit 600 `kine.pose` messages at 10 Hz without freezing the UI thread.
- Dispatch: `new CometChat.TransientMessage(guid, CometChat.RECEIVER_TYPE.GROUP, payload)` via `CometChat.sendTransientMessage()`.
- Receiver: `MessageListener.onTransientMessageReceived()` recording received packets.
- Latency & Loss Meter: Compute round-trip / transit latency percentiles (p50, p95 $< 400$ ms) and message drop rate ($< 2.0\%$).

### 5. Spike S4 (D2.4) — Custom Message Persistence & History Retrieval
- Directory: `client/src/spikes/s4-custom/`
- Burst transmission: Send 25 custom messages (`kine.rep`, `kine.alert`, `kine.cue`) using `new CometChat.CustomMessage(guid, CometChat.RECEIVER_TYPE.GROUP, type, data)` with `shouldUpdateConversation(false)`.
- History retrieval: Query `new CometChat.MessagesRequestBuilder().setGUID(guid).setCategories(['custom']).setLimit(30).build().fetchPrevious()`.
- Assert 100% retrieval in strict chronological sequence.

### 6. Styles & Design Tokens
- Style with CSS tokens in `client/src/spikes/spikes.css` conforming to `--bg-surface`, `--accent-cyan`, `--accent-emerald`, `--accent-rose`, `--border-subtle`, and Framer Motion.

## Verification Triad (Mandatory)
Before submitting your report, you MUST run:
```powershell
pnpm exec tsc --noEmit; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
pnpm --filter @kinesio/client build; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
```
Document these commands and their actual outputs in your handoff report.

## Output Requirements
Write `report.md` and `handoff.md` in your working directory. Send a completion message back when complete.


## 2026-10-03T19:51:28Z
You are the Spikes Implementation Worker.
Your working directory is: d:/TP/Hackathon/Cometchat/.agents/teamwork/teamwork_preview_worker_spikes/
Read your task assignment in d:/TP/Hackathon/Cometchat/.agents/teamwork/teamwork_preview_worker_spikes/DISPATCH.md, ORIGINAL_REQUEST.md, SCOPE.md, and the three survey reports:
1. d:/TP/Hackathon/Cometchat/.agents/teamwork/teamwork_preview_explorer_survey_d2_1/report.md
2. d:/TP/Hackathon/Cometchat/.agents/teamwork/teamwork_preview_spec_miner_survey_d2_2/report.md
3. d:/TP/Hackathon/Cometchat/.agents/teamwork/teamwork_preview_explorer_survey_d2_3/report.md

Implement the interactive testbed mounted at /spikes (client/src/spikes/SpikesHarness.tsx) covering Spikes S1 through S4 and the S5/D2.5 Kill-Switch Evaluation Gate, and wire route mounting in client/src/App.tsx.
Follow the mandatory integrity warning:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Execute the verification triad (tsc --noEmit, pnpm --filter @kinesio/client build) and document results in handoff.md.
Send a completion message back with send_message to recipient 81566c86-b749-47c0-8b25-a5af0578bdb3 when done.
