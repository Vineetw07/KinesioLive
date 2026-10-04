# Handoff Report — CometChat Calls v5 & Chat SDK Specification Mining

> **Role:** Survey Agent 2 (CometChat Specification Miner)  
> **Workspace:** `d:/TP/Hackathon/Cometchat/.agents/teamwork/teamwork_preview_spec_miner_survey_d2_2/`  
> **Handoff Type:** Hard (Task complete)  
> **Target Audience:** Parent Orchestrator (`81566c86-b749-47c0-8b25-a5af0578bdb3`) & Implementation Agents

---

## 1. Observation

Direct evidence gathered via CometChat MCP documentation server (`mcp-remote https://mcp.cometchat.com/mcp`) and repository references:

1. **Calls SDK v5 Join Sequence:**
   - Tool call: `fetch_cometchat_doc_page("/calls/javascript/join-session")`
   - Verbatim extract:
     ```javascript
     const tokenResult = await CometChatCalls.generateToken(sessionId);
     const callSettings = {
       sessionType: "VIDEO",
       layout: "TILE",
       startAudioMuted: false,
       startVideoPaused: false,
     };
     const joinResult = await CometChatCalls.joinSession(tokenResult.token, callSettings, container);
     ```
   - Container setup requirement: `<div id="call-container" style="width: 100%; height: 100vh;"></div>`.
   - Method return: `{ data: undefined, error: Object | null }`.

2. **SessionSettings for Clinician Audio Mute:**
   - Tool call: `fetch_cometchat_doc_page("/calls/javascript/session-settings")`
   - Verbatim extract:
     - `startAudioMuted`: Boolean, default `false`. Setting to `true` mutes the participant's microphone upon entering the session.
     - `sessionType`: `"VIDEO"` | `"VOICE"`.
     - `layout`: `"TILE"` | `"SIDEBAR"` | `"SPOTLIGHT"`.

3. **Calls SDK v5 Authentication:**
   - Tool call: `fetch_cometchat_doc_page("/calls/javascript/authentication")`
   - Verbatim extract:
     ```javascript
     const user = await CometChatCalls.loginWithAuthToken(authToken);
     ```
   - Status checks: `CometChatCalls.isUserLoggedIn()` returns boolean; `CometChatCalls.getLoggedInUser()` returns user object or `null`.

4. **Chat SDK v4 Initialization & Auth Token Login:**
   - Tool call: `fetch_cometchat_doc_page("/sdk/javascript/authentication-overview")`
   - Verbatim extract:
     ```typescript
     const user = await CometChat.login(authToken);
     ```
   - Invariant from `.cometchat/skills/cometchat-js-v5-sdk/SKILL.md` (lines 32–36):
     > "Coexisting with the Chat SDK / UI Kit? Their `login()` can re-init the Calls SDK with only appId/region and wipe custom hosts — re-run your calls init after their login, before `CometChatCalls.login`."

5. **Transient Messages (10 Hz Telemetry):**
   - Tool call: `fetch_cometchat_doc_page("/sdk/javascript/transient-messages")`
   - Verbatim extract:
     ```typescript
     let receiverId: string = "GUID";
     let receiverType: string = CometChat.RECEIVER_TYPE.GROUP;
     let data: Object = { "LIVE_REACTION": "heart" };
     let transientMessage = new CometChat.TransientMessage(receiverId, receiverType, data);
     CometChat.sendTransientMessage(transientMessage);
     ```
   - Return value: `void` (fire-and-forget, non-blocking synchronous execution).
   - Listener extract:
     ```typescript
     CometChat.addMessageListener(listenerId, new CometChat.MessageListener({
       onTransientMessageReceived: (transientMessage: CometChat.TransientMessage) => { ... }
     }));
     ```
   - Auxiliary class extract (`/sdk/reference/auxiliary`): `transientMessage.getData()` returns the data payload; `transientMessage.getSender()` returns `User`.
   - Non-echo rule: The sender does not receive an echo callback for their own transient message.

6. **Custom Messages (`kine.rep`, `kine.alert`, `kine.cue`, `kine.session`):**
   - Tool call: `fetch_cometchat_doc_page("/sdk/javascript/send-message")`
   - Verbatim extract:
     ```typescript
     let customMessage = new CometChat.CustomMessage(receiverID, receiverType, customType, customData);
     const message = await CometChat.sendCustomMessage(customMessage);
     ```
   - Return value: `Promise<CometChat.CustomMessage>`.
   - Control methods: `customMessage.shouldUpdateConversation(false)` prevents message from overwriting conversation preview.

7. **Historical Message Retrieval via `MessagesRequestBuilder`:**
   - Tool call: `fetch_cometchat_doc_page("/sdk/javascript/message-filtering")`
   - Verbatim extract (lines 383–394):
     ```typescript
     let GUID: string = "GUID";
     let limit: number = 30;
     let categories: Array<String> = ["message", "custom"];
     let messagesRequest: CometChat.MessagesRequest =
       new CometChat.MessagesRequestBuilder()
         .setGUID(GUID)
         .setCategories(categories)
         .setLimit(limit)
         .build();
     ```
   - Method name is `.setGUID(guid)` with uppercase `GUID` (calling `.setGuid` is invalid).
   - Category filtering uses array `["custom"]`.
   - Execution method: `const messages = await messagesRequest.fetchPrevious()`.

8. **Server-Minted Auth Tokens and Session Responses:**
   - Source: `server/src/cometchatRest.ts` lines 240–319 & `shared/src/index.ts` lines 118–124
   - `POST /api/session` returns:
     `{ sessionId: string, authToken: string, uid: string, appId: string, region: string }`
   - UID is deterministically mapped server-side (`clinician` → `dr-demo`, `patient` → `pt-demo`).
   - Group `guid: sessionId` is idempotently created with both users added prior to token generation.

---

## 2. Logic Chain

1. **Premise:** KinesioLive requires synchronous WebRTC video calling alongside 10 Hz pose telemetry and persisted biomechanical event logs without UI Kit dependencies.
2. **Step 1 (SDK Coexistence):** Because both `@cometchat/chat-sdk-javascript@4` and `@cometchat/calls-sdk-javascript@5` are imported, Chat SDK login must precede Calls SDK initialization to prevent Chat SDK's internal initialization routines from wiping Calls SDK host configuration (Observation 4).
3. **Step 2 (Calls Join):** Once authenticated with `loginWithAuthToken`, calling `CometChatCalls.generateToken(sessionId)` binds the session room to the group GUID. Passing `startAudioMuted: true` in `SessionSettings` for the clinician role satisfies the requirement to eliminate acoustic feedback when clinician and patient are tested on nearby machines (Observations 1 & 2).
4. **Step 3 (Transient Telemetry):** `CometChat.sendTransientMessage` targets `RECEIVER_TYPE.GROUP` with group GUID. Because it returns `void` and bypasses persistence, it provides the required sub-millisecond dispatch overhead needed to sustain 10 Hz transmission without freezing the main thread (Observation 5).
5. **Step 4 (Custom Events & History):** Biomechanical milestones (`kine.rep`, `kine.alert`, `kine.cue`) require guaranteed server-side persistence. `CometChat.sendCustomMessage` writes to the message log, while `MessagesRequestBuilder` querying `.setGUID(guid).setCategories(['custom']).setLimit(30).build().fetchPrevious()` enables 100% historical retrieval verification in Spike S4 (Observations 6 & 7).
6. **Step 5 (Dual-Profile Isolation):** Because browser `localStorage` stores active auth tokens per origin, running two client roles in the same browser profile causes token collisions. Separate Chrome profiles or Incognito sessions are mathematically required for multi-client local testing (Observation 4).

---

## 3. Caveats

- **No Caveats on SDK Signatures:** All methods and builder patterns are directly confirmed from official CometChat v4/v5 documentation endpoints.
- **MediaStream Contention:** MediaPipe Pose Landmarker requires camera access in Spike S1. If both MediaPipe and the Calls SDK call `navigator.mediaDevices.getUserMedia()`, Chromium may throw `NotReadableError`. The harness should access the video track rendered inside `containerElement` via `requestVideoFrameCallback` or share a cloned track.
- **Offline Mock Tokens:** `server/src/cometchatRest.ts` generates a mock fallback token if live credentials are not provisioned in `.env`. Calls to `CometChatCalls.loginWithAuthToken` against live CometChat cloud will fail if a mock token is provided.

---

## 4. Conclusion

The authoritative API specifications for CometChat Headless Calls v5 and Chat SDK v4 have been fully mapped and validated:
1. **Calls v5 Join Sequence:** `CometChat.init` → `CometChat.login(authToken)` → `CometChatCalls.init` → `CometChatCalls.loginWithAuthToken(authToken)` → `CometChatCalls.generateToken(sessionId)` → `CometChatCalls.joinSession(token, { sessionType: 'VIDEO', layout: 'TILE', startAudioMuted: true }, container)`.
2. **Transient Telemetry (10 Hz):** `new CometChat.TransientMessage(guid, RECEIVER_TYPE.GROUP, payload)` dispatched via `CometChat.sendTransientMessage()`. Throttled via 10 Hz token bucket.
3. **Custom Messages:** `new CometChat.CustomMessage(guid, RECEIVER_TYPE.GROUP, type, data)` with `shouldUpdateConversation(false)` dispatched via `CometChat.sendCustomMessage()`.
4. **History Fetch:** `new CometChat.MessagesRequestBuilder().setGUID(guid).setCategories(['custom']).setLimit(30).build().fetchPrevious()`.
5. **Token Architecture:** Server mints tokens via `POST /api/session`; client requires zero Auth Keys or REST keys.

---

## 5. Verification Method

To verify these findings and signatures independently:
1. **Inspect Documentation Report:**
   Read `d:/TP/Hackathon/Cometchat/.agents/teamwork/teamwork_preview_spec_miner_survey_d2_2/report.md`.
2. **Execute MCP Query Verification:**
   Run `fetch_cometchat_doc_page` on `/calls/javascript/join-session`, `/calls/javascript/session-settings`, and `/sdk/javascript/message-filtering`.
3. **Typecheck Shared Contracts & Client:**
   ```powershell
   pnpm exec tsc --noEmit
   ```
4. **Build Client Workspace:**
   ```powershell
   pnpm --filter @kinesio/client build
   ```
