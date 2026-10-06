# CometChat Integration & Capabilities Architecture

> **Challenge:** CometChat "Zero to Chat" Build Challenge (#ZeroToChat)  
> **Platform:** KinesioLive — Real-Time Biomechanical Telerehabilitation  
> **Live MCP Status:** Verified & Active via CometChat Documentation MCP  

---

## 1. Executive Summary & CometChat Role

**CometChat is the fundamental communication and data backbone of KinesioLive.**

Instead of building fragmented WebRTC plumbing and separate WebSocket servers, KinesioLive leverages CometChat's full-spectrum communications stack:
1. **CometChat Calls SDK v5 (Headless WebRTC):** Provides crystal-clear, low-latency two-way video and audio between patient and clinician with custom embedded UI and moderator controls.
2. **CometChat Chat SDK v4 (Real-Time Message Bus):** Streams high-frequency (10 Hz) pose kinematics across the network via **Transient Messages** without database bloat.
3. **Persisted Custom Messages:** Stores structured clinical workout milestones (`kine.rep`, `kine.alert`, `kine.cue`, `kine.session`) in session chat history.
4. **Group Chat History as Medical Exercise Record:** The persistent group history acts as the permanent medical session ledger, dynamically fetched and aggregated into workout analytics.
5. **Real-Time Presence:** Immediately notifies clinicians when patients join the virtual therapy room.
6. **Server-Side REST Token Architecture:** All user provisioning and token minting are handled strictly on the backend, ensuring zero API keys or credentials reach client bundles.

---

## 2. CometChat Skills & Core Capabilities Employed

### 🎥 1. Headless Calls SDK v5 (`@cometchat/calls-sdk-javascript@5`)
- **Native Video Container Embedding:** Instead of using fixed UI kit modals, Calls SDK v5 is integrated directly into KinesioLive's responsive **Floating Island Bento Canvas**.
- **Group/Meeting Room Architecture:** Calls join sessions dynamically using session GUIDs (`kine-<sessionId>`) via `CometChatCalls.generateToken(sessionId)` and `CometChatCalls.joinSession(token, callSettings, containerElement)`.
- **Acoustic Feedback Protection:** Clinicians join with `startAudioMuted: true` to prevent acoustic howling loops during multi-tab or local evaluation.
- **Moderator Control Actions:** Uses `CometChatCalls.muteParticipant(PATIENT_UID)` allowing clinicians to mute patient audio when necessary.
- **Clean Event Lifecycle:** WebRTC lifecycle hooks (`onSessionJoined`, `onSessionLeft`, `onParticipantJoined`, `onParticipantLeft`, `onAudioMuted`) are registered and cleaned up deterministically within React `useEffect` hooks.

### ⚡ 2. 10 Hz Transient Telemetry Stream (`CometChat.sendTransientMessage`)
- **High-Frequency Kinematic Streaming:** MediaPipe 3D joint angles, knee valgus deviation percentages, and squat depth ratios are streamed at 10 Hz from patient to clinician.
- **Zero Database Bloat:** Uses `CometChat.TransientMessage(guid, RECEIVER_TYPE.GROUP, payload)`. Transient messages are delivered in real time across the WebSocket gateway with zero persistence and zero database writes.
- **Token Bucket Rate Limiting:** Telemetry is capped strictly at 10 Hz via client-side token bucket, preventing network congestion and maintaining smooth 60 FPS rendering.

### 💾 3. Persisted Custom Exercise Messages (`CometChat.sendCustomMessage`)
- **Structured Clinical Schemas:** Persistent exercise events use typed custom payloads conforming to `shared/contract.ts`:
  - `kine.rep`: Emitted upon squat completion with rep number, depth rating, duration, tempo, form score (0–100), and form tier (`excellent` | `good` | `needs_work`).
  - `kine.alert`: Emitted when medial knee valgus deviation exceeds the calibrated threshold (+8.0%) with measured percentage and active side (L/R).
  - `kine.cue`: Dispatched by the clinician (e.g. "Knees Out", "Slow Down") and displayed as an animated real-time coaching cue on the patient's HUD.
  - `kine.session`: Boundary markers for session start, completion, and workout summary.
- **Conversation Preview Cleanliness:** Marked with `customMessage.shouldUpdateConversation(false)` to prevent rapid exercise events from polluting recent conversation list previews.

### 📊 4. Group Message History as the Exercise Record (`MessagesRequestBuilder`)
- **Session-Based Groups:** Every rehabilitation appointment is provisioned with a dedicated CometChat group (`kine-<sessionId>`).
- **Post-Session Analytics Reconstruction:** When a session ends, the client queries group history via:
  ```typescript
  new CometChat.MessagesRequestBuilder()
    .setGUID(sessionId)
    .setCategories(["custom"])
    .setLimit(50)
    .build()
    .fetchPrevious();
  ```
- **Automated Summary Card:** Historical custom messages are chronologically aggregated into comprehensive workout analytics (total completed reps, average peak depth, valgus breakdown incidents, duration, and exercise timeline).

### 🟢 5. Instant Real-Time User Presence (`CometChat.addUserListener`)
- **Live Patient State Detection:** Uses `CometChat.addUserListener` (`onUserOnline` / `onUserOffline`) to immediately update the clinician's studio badge ("Patient in Session: Active") the millisecond the patient connects.

### 🔒 6. Enterprise REST Security & Token Isolation
- **Server-Minted Auth Tokens:** Browser clients never receive the `COMETCHAT_AUTH_KEY` or `COMETCHAT_REST_API_KEY`.
- **Backend Token Server (`/api/session`):** The Express backend securely contacts CometChat REST endpoints:
  - `POST /v3/users`: Idempotently provisions clinician (`dr-demo`) and patient (`pt-demo`) profiles.
  - `POST /v3/groups`: Provisions public session group and seeds participant memberships.
  - `POST /v3/users/{uid}/auth_tokens`: Generates secure, short-lived Auth Tokens passed to the browser.
- **Dual-SDK Login:** Browser uses the server-minted Auth Token to authenticate both the Chat SDK (`CometChat.login(token)`) and the Calls SDK (`CometChatCalls.loginWithAuthToken(token)`).

---

## 3. CometChat Feature Mapping Matrix

| KinesioLive Feature | CometChat Technology & Primitive | Purpose in Application |
|---|---|---|
| **Two-Way Video Telehealth** | `@cometchat/calls-sdk-javascript@5` | Live audio/video consultation between patient and physical therapist |
| **Real-Time Pose Telemetry** | `CometChat.TransientMessage` (Group) | Streams 10 Hz knee angles, depth, and valgus metrics with zero DB writes |
| **Valgus Form Breakdown Alerts** | `CometChat.CustomMessage` (`kine.alert`) | Persisted clinical warning when knee collapses inward > +8.0% |
| **Instant Coaching Cues** | `CometChat.CustomMessage` (`kine.cue`) | Clinician taps quick buttons ("Knees Out"); flashes on patient screen |
| **Rep Counting & Form Score** | `CometChat.CustomMessage` (`kine.rep`) | Records completed reps with 0–100 biomechanical form score in group history |
| **Session Exercise Log** | `MessagesRequestBuilder.fetchPrevious()` | Fetches full workout event history to render post-session summary card |
| **Room Presence Indicator** | `CometChat.addUserListener` | Instant visual indicator confirming patient is active in the clinic room |
| **Moderator Audio Mute** | `CometChatCalls.muteParticipant()` | Clinician can mute patient audio feed during exercise demonstrations |
| **Credential Protection** | REST API `/v3/users/{uid}/auth_tokens` | Server-minted auth tokens; zero API keys exposed in browser or bundles |

---

## 4. Live CometChat MCP Evidence & Verification Log

Every integration decision was validated against live documentation using the **CometChat Documentation MCP Server**.

| # | MCP Tool Used | Target / Query | Verified Finding & Exact Signature | Architectural Decision in KinesioLive |
|---|---|---|---|---|
| 1 | `list_cometchat_bundles` | `{}` | Discovered 10 official implementation bundles across JS SDK, UIKit, Calls, and Moderation. | Selected `@cometchat/chat-sdk-javascript` v4 + `@cometchat/calls-sdk-javascript` v5 headless stack. |
| 2 | `get_cometchat_implementation_bundle` | `bundle: "js-sdk-messaging-basics"` | Init: `new CometChat.AppSettingsBuilder().subscribePresenceForAllUsers().setRegion(REGION).build()`. | Standardized AppSettings initialization and listener cleanup patterns. |
| 3 | `get_cometchat_implementation_bundle` | `bundle: "presence-and-typing"` | User listener: `new CometChat.UserListener({ onUserOnline, onUserOffline })`. | Clinician studio presence badge flips to "Patient Active" immediately. |
| 4 | `fetch_cometchat_doc_page` | `/sdk/javascript/transient-messages` | `new CometChat.TransientMessage(guid, RECEIVER_TYPE.GROUP, data)`. Method: `sendTransientMessage()`. | **Key Discovery:** Transient messages support groups natively. Perfect for 10 Hz pose telemetry. |
| 5 | `fetch_cometchat_doc_page` | `/sdk/javascript/send-message` | `new CometChat.CustomMessage(receiverId, receiverType, customType, customData)`. | Persisted exercise events (`kine.rep`, `kine.alert`, `kine.cue`, `kine.session`). |
| 6 | `fetch_cometchat_doc_page` | `/calls/javascript/overview` | `CometChatCalls` is a singleton tracking one active session per window. | Multi-tab isolation: Clinician and Patient run in separate browser profiles or incognito. |
| 7 | `fetch_cometchat_doc_page` | `/calls/javascript/join-session` | `const { token } = await CometChatCalls.generateToken(sessionId)`. Then `joinSession(token, settings, container)`. | Session GUID doubles as the WebRTC room ID, uniting chat and video. |
| 8 | `fetch_cometchat_doc_page` | `/calls/javascript/session-settings` | Settings: `{ sessionType: "VIDEO", layout: "TILE", startAudioMuted: false, hideControlPanel: true }`. | Embedded directly into Floating Island Bento Canvas; custom UI controls replace default bar. |
| 9 | `fetch_cometchat_doc_page` | `/calls/javascript/authentication` | Calls SDK token login: `await CometChatCalls.loginWithAuthToken(authToken)`. | Client uses single server-minted token to authenticate both Chat and Calls SDKs. |
| 10 | `fetch_cometchat_doc_page` | `/calls/javascript/actions` | Moderator action: `CometChatCalls.muteParticipant(participantId)`. | Clinician possesses moderation controls to mute patient audio during instruction. |
| 11 | `fetch_cometchat_doc_page` | `/calls/javascript/events` | `CometChatCalls.addEventListener("eventName", callback)`. Returns unregister function. | Clean teardown without memory leaks inside React component unmount. |
| 12 | `search_cometchat_docs` | `REST API create group with members` | `POST /v3/groups` with `{ guid, name, type: "public", members: { participants: [...] } }`. | Backend automatically provisions group and adds both participants on session creation. |
| 13 | `fetch_cometchat_doc_page` | `/rest-api/auth-tokens/create` | OpenAPI spec: `POST /v3/users/{uid}/auth_tokens` with header `apikey: <key>`. | Express `/api/session` endpoint mints auth tokens on-demand. |
| 14 | `fetch_cometchat_doc_page` | `/rest-api/users/create` | OpenAPI spec: `POST /v3/users` with header `apikey: <key>`. | Idempotent user upsert ensures `dr-demo` and `pt-demo` exist before token minting. |
| 15 | `fetch_cometchat_doc_page` | `/rest-api/group-members/add-members` | OpenAPI spec: `POST /v3/groups/{guid}/members` with `{ participants: [...] }`. | Ensures participants are joined to session group if group was pre-created. |
| 16 | `search_cometchat_docs` | `Calls SDK v5 generateToken joinSession` | Verified Calls SDK v5 token generation and DOM container attachment requirements. | Established container mounting with explicit CSS dimensions before joining. |
| 17 | `fetch_cometchat_doc_page` | `/calls/javascript/session-settings` | Confirmed `startAudioMuted: true` for clinician profile. | Prevents local acoustic feedback howling loop during multi-window testing. |
| 18 | `fetch_cometchat_doc_page` | `/sdk/javascript/message-filtering` | Exact builder syntax: `new CometChat.MessagesRequestBuilder().setGUID(guid).setCategories(["custom"]).setLimit(limit).build().fetchPrevious()`. | History query fetches custom events in strict chronological order. |
| 19 | `search_cometchat_docs` | `MessageListener onCustomMessageReceived JavaScript SDK` | Discovered `/sdk/javascript/all-real-time-listeners` index page. | Full inventory of real-time message callback types. |
| 20 | `fetch_cometchat_doc_page` | `/sdk/javascript/all-real-time-listeners` | Exact callback signatures: `onCustomMessageReceived()`, `onTransientMessageReceived()`. | Typed callback handlers in React state controllers. |
| 21 | `fetch_cometchat_doc_page` | `/calls/javascript/troubleshooting` | Root causes for container rendering and listener ordering. | Ensured container is mounted and sized before invoking `joinSession`. |
| 22 | `fetch_cometchat_doc_page` | `/calls/javascript/custom-control-panel` | Action APIs for custom buttons: `muteAudio()`, `unmuteAudio()`, `pauseVideo()`, `resumeVideo()`. | Implemented custom bento call controls with animated active states. |
| 23 | `fetch_cometchat_doc_page` | `/sdk/javascript/send-message` | `customMessage.shouldUpdateConversation(false)`. | Prevents 10 Hz exercise events from overwriting conversation previews. |
| 24 | `list_cometchat_bundles` | `{}` | Re-verified bundle inventory and platform support contracts. | Ensured full architecture conformance with official CometChat guidelines. |
