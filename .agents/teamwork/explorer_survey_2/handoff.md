# Handoff Report: Phase 3 Codebase Survey (Milestones D4.2 – D4.5)

**Agent:** `explorer_survey_2` (Explorer)  
**Parent Agent:** `parent` (`a77c14a7-77c2-49ff-ac55-3cd4ed6cb622`)  
**Scope:** Survey and analysis of CometChat Auth, Transient Telemetry Rate-Capping, Custom Message Pipelines, and MCP Requirements for Phase 3.  
**Type:** Hard Handoff (Investigation & Survey Complete)

---

## 1. Observation

1. **Authentication & Credential Boundary:**
   - In `server/src/index.ts` lines 52–76, endpoint `POST /api/session` receives `SessionRequest` and calls `createOrJoinSession(role, sessionId)`.
   - In `server/src/cometchatRest.ts` lines 32–65, `validateBootCredentials` validates keys without crashing. In lines 106–153, `upsertUser` idempotently creates users. In lines 240–281, `mintAuthToken` calls `POST /v3/users/{uid}/auth_tokens` with `{ force: true }`, returning ephemeral `authToken` (or deterministic mock in dev fallback).
   - In `shared/src/index.ts` lines 118–124, `SessionResponse` contains only `{ sessionId, authToken, uid, appId, region }`. No Auth Key or REST Key is exposed.
   - In `client/src/spikes/utils/tokenService.ts` lines 8–29, `requestSession(role, sessionId)` contacts `/api/session`.

2. **Transient Telemetry & Rate-Capping:**
   - In `client/src/spikes/s2-transient/rateCap.ts` lines 6–32, `TelemetryTokenBucket` enforces a 100ms refill interval (`refillIntervalMs = 100`) with capacity 1, enforcing strictly 10 Hz rate limiting using `performance.now()`.
   - In `client/src/spikes/s2-transient/telemetryRunner.ts` lines 94–102, messages are constructed with `new CometChat.TransientMessage(sessionId, CometChat.RECEIVER_TYPE.GROUP, payload)` and dispatched via `CometChat.sendTransientMessage(transientMessage)`.
   - In `client/src/spikes/s2-transient/telemetryRunner.ts` line 44, code comments and SDK behavior confirm: *"Sender does not receive own message in group"*.
   - In `docs/frontend_architecture_spec.md` line 515, `useTelemetryStream.ts` parses payload from transient message.

3. **Custom Message Pipeline:**
   - In `client/src/spikes/s4-custom/persistenceRunner.ts` lines 114–124:
     ```typescript
     const customMessage = new CometChat.CustomMessage(
       targetGuid,
       CometChat.RECEIVER_TYPE.GROUP,
       customType,
       payloadData
     );
     customMessage.shouldUpdateConversation(false);
     await CometChat.sendCustomMessage(customMessage);
     ```
   - In `shared/src/index.ts` lines 52–95, schemas for `kine.rep`, `kine.alert`, `kine.cue`, and `kine.session` are formally defined with common base `Envelope { v: 1, sid, t }`.

4. **MCP Document Queries Executed:**
   - Real CometChat MCP tool `search_cometchat_docs` was called for `"MessageListener onCustomMessageReceived JavaScript SDK"`.
   - Real CometChat MCP tool `fetch_cometchat_doc_page` was called for `"/sdk/javascript/all-real-time-listeners"`, returning official definitions for `onCustomMessageReceived(message: CometChat.CustomMessage)` and `onTransientMessageReceived(message: CometChat.TransientMessage)`.
   - Real CometChat MCP tool `fetch_cometchat_doc_page` was called for `"/calls/javascript/troubleshooting"`, returning the requirement that container elements must have non-zero dimensions before calling `joinSession`.
   - Real CometChat MCP tool `fetch_cometchat_doc_page` was called for `"/calls/javascript/custom-control-panel"`, confirming `hideControlPanel: true` in `SessionSettings` and action methods `muteAudio()`, `unmuteAudio()`, `pauseVideo()`, `resumeVideo()`, `leaveSession()`.

5. **Test & Build Verification Results:**
   - Tool `pnpm vitest run` executed with exit code 0: **16 test files passed, 273/273 tests green**.
   - Tool `tsc --noEmit` executed with exit code 0 across `@kinesio/shared`, `@kinesio/server`, and `@kinesio/client`.

---

## 2. Logic Chain

1. **Authentication Safety (Observation 1):**
   Because `server/src/cometchatRest.ts` acts as a reverse proxy for user upsert and token minting, and `SessionResponse` omits `COMETCHAT_REST_API_KEY` and `COMETCHAT_AUTH_KEY`, clients running in browsers are physically incapable of leaking administrative credentials. Client code initializes Chat SDK and Calls SDK using only the short-lived `authToken`.

2. **Telemetry Rate-Limiting & Asymmetry (Observation 2):**
   `TelemetryTokenBucket` limits outgoing transient messages to 1 token per 100ms. Since MediaPipe pose callbacks fire at 30–60 FPS, calling `tryConsume()` on each frame naturally throttles WebSocket transmission to 10 Hz without thread blocking.
   Furthermore, because CometChat group transient messages are not echoed back to the sender, `Patient.tsx` must render its local canvas skeleton and HUD values optimistically from the local inference pipeline, while `Clinician.tsx` reads them via `useTelemetryStream` from `onTransientMessageReceived`.

3. **Custom Message Noise Suppression (Observation 3):**
   Because `customMessage.shouldUpdateConversation(false)` is enforced on all biomechanical events (`kine.rep`, `kine.alert`, `kine.cue`), exercise telemetry persists in the group's message history for post-workout reporting without corrupting or spamming the chat conversation list.

4. **WebRTC UI Embedding (Observation 4):**
   MCP documentation confirms that setting `hideControlPanel: true` hides the default WebRTC bottom bar. This enables building custom, high-contrast overlay controls matching the Floating Island Bento Canvas specification without visual collision.
   Additionally, setting explicit container dimensions prior to calling `joinSession()` prevents the blank screen / 0-dimension failure identified in `/calls/javascript/troubleshooting`.

---

## 3. Caveats

1. **Camera Permission in Headless Test Environments:**
   Real WebRTC video track tapping via `requestVideoFrameCallback` requires a physical or virtual camera stream in a browser with HTTPS or localhost. Automated tests in Vitest run with mock fixtures or headless jsdom, so live camera verification must be executed in the browser runner.
2. **Dual-Profile Chrome Session Isolation:**
   When running Patient and Clinician locally on `http://localhost:5173`, running both in the same Chrome tab or same profile will cause `localStorage` session collisions. As documented, Clinician must be opened in a standard window and Patient in Incognito (or separate Chrome profiles).

---

## 4. Conclusion

The codebase is in an exemplary, verified state. The mathematical biomechanics engine is completely decoupled and tested (273 tests passing). The backend token minting server is verified and secure.
For Phase 3 (D4.2 through D4.5), the implementation team should proceed with:
1. **D4.2:** Establish `client/src/styles/tokens.css` and `client/src/styles/motionPresets.ts`.
2. **D4.3:** Build `client/src/views/Patient.tsx` (Calls v5 mount, zero-contention video tap, optimistic local HUD, 10 Hz `sendTransientMessage`, rep/alert `sendCustomMessage`).
3. **D4.4:** Build `client/src/views/Clinician.tsx` (Calls v5 mount with `startAudioMuted: true`, `useTelemetryStream` with `useSpring` dampers, coaching cue pad dispatching `kine.cue`).
4. **D4.5:** Build `client/src/utils/sessionGuard.ts` (safe URL parameter parsing and non-destructive role conflict modal).
5. Append discovered MCP tool calls (#20 through #23) to `COMETCHAT_INTEGRATION.md`.

---

## 5. Verification Method

To independently verify all claims made in this report, run:

```powershell
# 1. Verify TypeScript compilation across all packages
pnpm --filter @kinesio/shared exec tsc --noEmit; pnpm --filter @kinesio/server exec tsc --noEmit; pnpm --filter @kinesio/client exec tsc --noEmit

# 2. Verify complete automated test suite (273 tests)
pnpm vitest run

# 3. Inspect survey analysis artifact
Get-Content d:/TP/Hackathon/Cometchat/.agents/teamwork/explorer_survey_2/analysis.md
```

Invalidation Conditions:
- Any `tsc --noEmit` compilation error.
- Any test failure in `pnpm vitest run`.
- Presence of `COMETCHAT_AUTH_KEY` or `REST_KEY` in `client/` or `shared/`.
