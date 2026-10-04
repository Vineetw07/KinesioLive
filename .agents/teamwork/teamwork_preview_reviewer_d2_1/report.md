# Spikes Architecture & UI Review Report (Reviewer 1)

**Reviewer:** Reviewer 1 (Spikes Architecture & UI Reviewer)  
**Target Milestone:** Spikes S1–S5 (Milestones D2.1–D2.5)  
**Scope Document:** `d:/TP/Hackathon/Cometchat/.agents/teamwork/orchestrator_2/SCOPE.md`  
**Worker Handoff:** `d:/TP/Hackathon/Cometchat/.agents/teamwork/teamwork_preview_worker_spikes/handoff.md`  
**Date:** 2026-10-03  

---

## Review Summary

**Verdict: APPROVE**

The Spikes testbed implementation (`client/src/App.tsx`, `client/src/spikes/SpikesHarness.tsx`, modular spike directories `s1-pose/`, `s2-transient/`, `s3-calls/`, `s4-custom/`, and supporting components/utilities) meets all architectural, modular, and verification requirements defined in `docs/trd.md`, `SCOPE.md`, and the CometChat Calls SDK v5 headless guidelines.

The native pathname router in `App.tsx` enables clean route switching between `/` and `/spikes` without destroying the active session state or polluting the root bundle. Heavy WebAssembly and WebRTC dependencies are strictly code-split into `SpikesHarness` via `React.lazy`. The Kill-Switch Decision Gate (`KillSwitchGateTable.tsx`), master runner, real-time log console, and dark-theme HUD styles in `spikes.css` provide full operational transparency for Milestone D2.5 formal sign-off.

Zero integrity violations (no dummy facades, hardcoded results, or credential leaks) were detected. All 119 automated E2E tests pass, strict workspace typechecking passes with zero errors, and the production client build compiles cleanly with code 0 (`index-CzAqn8LE.js` 362.34 kB, `SpikesHarness-CWI4Vb2q.js` 2,602.77 kB).

---

## Findings

### Minor Finding 1: Single-User Egress Dispatch Sample vs Dual-User RTT Measurement
- **What**: In `client/src/spikes/s2-transient/telemetryRunner.ts`, single-user testing measures egress dispatch latency (`performance.now() - sendTime`) because CometChat group messages do not echo back to the sender.
- **Where**: `client/src/spikes/s2-transient/telemetryRunner.ts:103-108`
- **Why**: While fully functional for benchmarking 10 Hz rate limiter throughput and client dispatch latency without requiring two physical browsers, true network round-trip time (RTT) is only captured when an independent receiver is attached via `onTransientMessageReceived`.
- **Suggestion**: In Day 4 telemetry integration, document the distinction in HUD metrics between `Dispatch Time (ms)` and `Receiver Transit Time (ms)`.

### Minor Finding 2: Master Runner Fixed Timing vs Heavy Network Conditions
- **What**: In `SpikesHarness.tsx`, `handleRunAll()` uses fixed sleep intervals (7s, 11s, 5s, 6s) to sequence S1 through S4.
- **Where**: `client/src/spikes/SpikesHarness.tsx:120-143`
- **Why**: Under severe network throttling, initial MediaPipe WASM asset loading (~30 MB) or WebSocket connection could take longer than 7 seconds, causing tab advancement before benchmark completion.
- **Suggestion**: Consider Promise-based completion gates (`await new Promise((resolve) => { ... })` triggered by `onComplete`) with a defensive timeout fallback.

---

## Verified Claims

| Claim from Worker Handoff | Verification Method | Result | Notes |
|---|---|---|---|
| **Native Pathname Routing** (`/` and `/spikes`) | Inspected `App.tsx:20-44, 110-129` | **PASS** | `pushState` + `popstate` listener + hash fallback. Does not reload page or reset state. |
| **Dynamic Bundle Splitting** | Inspected `App.tsx:11, 142-154` & `dist/assets` | **PASS** | `React.lazy(() => import('./spikes/SpikesHarness'))` successfully isolates ~2.6 MB bundle. |
| **Production Client Build** | Executed `pnpm --filter @kinesio/client build` | **PASS** | Exited code 0 (`dist/assets/index-CzAqn8LE.js` 362.34 kB, `SpikesHarness-CWI4Vb2q.js` 2,602.77 kB). |
| **Camera Contention Defense** | Inspected `s1-pose/poseRunner.ts:146-208` | **PASS** | Taps DOM `<video>` compositor texture via `requestVideoFrameCallback`. No secondary camera track. |
| **3-Tier Video Fallback** | Inspected `s1-pose/syntheticVideo.ts` | **PASS** | Genuine procedural humanoid squat canvas stream (`canvas.captureStream(30)`) enables headless testing. |
| **10 Hz Rate Limiter** | Inspected `s2-transient/rateCap.ts` | **PASS** | `TelemetryTokenBucket` with `refillIntervalMs = 100` strictly limits burst frequency to 10 Hz. |
| **Calls v5 Headless Flow & Role Isolation** | Inspected `s3-calls/callsRunner.ts:30-103` | **PASS** | Exact sequence: `init` → `login` → `Calls.init` → `Calls.loginWithAuthToken` → `generateToken` → `joinSession`. Enforces `startAudioMuted: true` on clinician. |
| **Custom Message History & Ordering** | Inspected `s4-custom/persistenceRunner.ts:143-189` | **PASS** | Queries `MessagesRequestBuilder.setGUID().setCategories(['custom'])` and verifies chronological monotonicity. |
| **Kill-Switch Decision Gate** | Inspected `KillSwitchGateTable.tsx:23-34, 95-107` | **PASS** | Dynamically transitions from `EVALUATION PENDING` to `GATE PASS: GREEN LIGHT` when S1–S4 pass. |
| **Zero Client Secrets** | PowerShell regex search on `client/src` | **PASS** | Zero instances of `COMETCHAT_AUTH_KEY`, `COMETCHAT_REST`, or API keys. Server-minted auth tokens only. |
| **Automated Test Suite (119 Tests)** | `pnpm --filter @kinesio/client exec vitest run --root .. tests/e2e/` | **PASS** | 9 test files passed, 119 tests passed, 0 failures (1.33s). |
| **TypeScript Workspace Typecheck** | `pnpm typecheck` (`pnpm -r run typecheck`) | **PASS** | All workspace packages (`shared`, `server`, `client`) typecheck cleanly with 0 errors. |

---

## Adversarial Challenge Report

### Overall Risk Assessment: LOW

### Stress-Test Dimensions & Counter-Analyses

1. **Memory & Lifecycle Teardown**:
   - *Challenge*: What happens if a user repeatedly navigates between `/` and `/spikes` while a spike is actively executing?
   - *Verification*: `SpikePoseInference.tsx`, `SpikeTelemetryThroughput.tsx`, and `SpikeCallsJoin.tsx` all register cleanup effects in `useEffect(return () => { ... })`. `stopStream()` terminates media tracks and cancels animation frames; `runner.stop()` aborts fetch and removes CometChat listeners; `leaveCall()` unregisters WebRTC listeners and invokes `CometChatCalls.leaveSession()`.
   - *Result*: **PASS**. Teardown is comprehensive and leak-resistant.

2. **Design Tokens & Accessibility**:
   - *Challenge*: Are colors and contrast accessible across status chips and dark HUD cards?
   - *Verification*: Chip text colors (`--accent-emerald`: `#10b981`, `--accent-rose`: `#f43f5e`, `--accent-amber`: `#f59e0b`, `--accent-cyan`: `#06b6d4`) on semi-transparent backgrounds with border outlines meet WCAG 2.1 AA text contrast requirements against the `#0f172a` / `#050811` dark surface.

3. **Integrity & Facade Inspection**:
   - *Challenge*: Are benchmark results hardcoded or simulated with synthetic timers?
   - *Verification*: Evaluated every calculation method. MediaPipe inference uses genuine WASM calls; angle computation uses true 3D vector dot products ($\vec{v}_1 \cdot \vec{v}_2 / (|\vec{v}_1| |\vec{v}_2|)$); statistical percentiles (p50, p95) use standard nearest-rank interpolation; custom messages query the CometChat backend API directly. No hardcoded success mocks exist.

---

## Conclusion

The Spikes testbed architecture, routing, UI components, and Kill-Switch Decision Gate are robust, production-grade, and fully verified. Milestone D2.1 through D2.5 is approved.
