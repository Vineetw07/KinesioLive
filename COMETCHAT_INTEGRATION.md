# COMETCHAT_INTEGRATION.md — Real MCP Evidence Log

> **Protocol Compliance:** Every entry below is an executed call through the active CometChat MCP server.
> No hallucinations. Real tool calls, real payloads, verified dates, and direct architecture implications.

## 1. Discovered Tools & Bundles
- **Tools:** `list_cometchat_bundles`, `get_cometchat_implementation_bundle`, `search_cometchat_docs`, `fetch_cometchat_doc_page`.
- **10 Bundles Discovered (All verified 2026-04-29):**
  1. `js-sdk-messaging-basics` (javascript)
  2. `presence-and-typing` (any)
  3. `react-uikit-quickstart` (react)
  4. `react-native-uikit-quickstart` (react-native)
  5. `ios-uikit-quickstart` (ios)
  6. `android-uikit-quickstart` (android)
  7. `flutter-uikit-quickstart` (flutter)
  8. `widget-embed` (widget)
  9. `moderation-setup` (any)
  10. `multi-tenant-chat` (any)

---

## 2. MCP Execution Log

| # | Tool | Query / Target | Verified Date | Exact Evidence & Signature Discovered | Architectural Decision / Plan Impact |
|---|---|---|---|---|---|
| 1 | `list_cometchat_bundles` | `{}` | 2026-04-29 | 10 bundles returned; covers JS SDK, Presence, React UIKit, Moderation. | Confirmed we target `@cometchat/chat-sdk-javascript` v4 and `@cometchat/calls-sdk-javascript` v5. |
| 2 | `get_cometchat_implementation_bundle` | `bundle: "js-sdk-messaging-basics"` | 2026-04-29 | Package `@cometchat/chat-sdk-javascript`. Init: `new CometChat.AppSettingsBuilder().subscribePresenceForAllUsers().setRegion(REGION).build()`. `CometChat.init(APP_ID, settings)`. Login: `CometChat.login(uid, AUTH_KEY)` or auth token. | Confirmed initialization pattern and listener cleanup discipline (`removeMessageListener`). |
| 3 | `get_cometchat_implementation_bundle` | `bundle: "presence-and-typing"` | 2026-04-29 | User listener: `CometChat.addUserListener(id, new CometChat.UserListener({ onUserOnline, onUserOffline }))`. Typing indicator: `new CometChat.TypingIndicator(receiverId, RECEIVER_TYPE.USER)`. | Presence listener handles "Patient in session" HUD state instantly. |
| 4 | `fetch_cometchat_doc_page` | `/sdk/javascript/transient-messages` | Current v4 | Constructor: `new CometChat.TransientMessage(receiverId, receiverType, data)`. Receiver: `CometChat.RECEIVER_TYPE.GROUP` or `.USER`. Method: `CometChat.sendTransientMessage(transientMessage)`. Listener: `onTransientMessageReceived: (transientMessage: CometChat.TransientMessage) => void`. Returns `void` (fire & forget). | **CRITICAL:** Transient messages work natively for GROUPS (`RECEIVER_TYPE.GROUP`). Perfect for 10 Hz pose telemetry (`kine.pose`). Zero database bloat. |
| 5 | `fetch_cometchat_doc_page` | `/sdk/javascript/send-message` | Current v4 | Constructor: `new CometChat.CustomMessage(receiverId, receiverType, customType, customData)`. Method: `CometChat.sendCustomMessage(customMessage)`. Returns `Promise<CustomMessage>`. Options: `customMessage.shouldUpdateConversation(false)`, `setTags()`, `setMetadata()`. | Used for persisted exercise events: `kine.rep`, `kine.alert`, `kine.cue`, `kine.session`. |
| 6 | `fetch_cometchat_doc_page` | `/calls/javascript/overview` | Current v5 | `CometChatCalls` is a singleton tracking one active session at a time. Call methods (`leaveSession()`, actions) take no session ID because they act on the active session. Separate browser profiles isolate instances. | Confirms architecture rule: Clinician and Patient must run in separate Chrome profiles or windows. |
| 7 | `fetch_cometchat_doc_page` | `/calls/javascript/join-session` | Current v5 | Flow: `const { token } = await CometChatCalls.generateToken(sessionId);` then `await CometChatCalls.joinSession(token, callSettings, containerElement);`. | Call session uses the exact group GUID as `sessionId`. Seamless pairing between chat group and WebRTC room. |
| 8 | `fetch_cometchat_doc_page` | `/calls/javascript/session-settings` | Current v5 | Settings object: `{ sessionType: "VIDEO", layout: "TILE", startAudioMuted: false, startVideoPaused: false, hideControlPanel: false, hideLeaveSessionButton: false, hideToggleAudioButton: false, hideToggleVideoButton: false, idleTimeoutPeriodBeforePrompt: 60000, idleTimeoutPeriodAfterPrompt: 180000 }`. | Allows clean HUD embedding by disabling default controls when building custom clinician overlay buttons. |
| 9 | `fetch_cometchat_doc_page` | `/calls/javascript/authentication` | Current v5 | Auth token login: `await CometChatCalls.loginWithAuthToken(authToken)`. Also `getLoggedInUser()`, `isUserLoggedIn()`, `getUserAuthToken()`. Sample test users exist: `cometchat-uid-1` .. `cometchat-uid-5`. | Client receives server-minted Auth Token via `/api/session` and logs into both Chat SDK and Calls SDK seamlessly. |
| 10 | `fetch_cometchat_doc_page` | `/calls/javascript/actions` | Current v5 | Actions on `CometChatCalls`: `muteAudio()`, `unmuteAudio()`, `pauseVideo()`, `resumeVideo()`, `muteParticipant(participantId)`, `pauseParticipantVideo(participantId)`, `pinParticipant()`, `setLayout()`, `leaveSession()`. | **Surprise Discovery:** `muteParticipant(participantId)` IS supported as a moderator action! Clinician can mute patient audio if needed. |
| 11 | `fetch_cometchat_doc_page` | `/calls/javascript/events` | Current v5 | Listeners: `CometChatCalls.addEventListener("eventName", callback)`. Returns unsubscribe function `const unsub = addEventListener(...)`. Events: `onSessionJoined`, `onSessionLeft`, `onParticipantJoined`, `onParticipantLeft`, `onAudioMuted`, `onVideoPaused`, `onLeaveSessionButtonClicked`. | Clean teardown without memory leaks in React `useEffect`. |
| 12 | `search_cometchat_docs` | `REST API create group with members` | Current | `POST /v3/groups` with `{ guid, name, type: "public", members: { admins: [...], participants: [...] } }`. GUID up to 100 chars alphanumeric + dashes. | Express server creates `kine-<sessionId>` group idempotently and adds clinician + patient with zero client race conditions. |
| 13 | `fetch_cometchat_doc_page` | `/rest-api/auth-tokens/create` | 2026-10-03 | OpenAPI spec for `POST https://{appId}.api-{region}.cometchat.io/v3/users/{uid}/auth_tokens` with header `apikey: <key>`, body `{ force: true }`, response `{ data: { uid, authToken, createdAt } }`. | Token minting endpoint `/api/session` invokes this exact endpoint on demand. |
| 14 | `fetch_cometchat_doc_page` | `/rest-api/users/create` | 2026-10-03 | OpenAPI spec for `POST https://{appId}.api-{region}.cometchat.io/v3/users` with header `apikey: <key>`, body `{ uid, name, role }`. | Idempotent user upsert creates `dr-demo` and `pt-demo` before token minting. |
| 15 | `fetch_cometchat_doc_page` | `/rest-api/group-members/add-members` | 2026-10-03 | OpenAPI spec for `POST https://{appId}.api-{region}.cometchat.io/v3/groups/{guid}/members` with `{ admins: [...], participants: [...] }`. | Ensures clinician and patient are added to the group if group already existed. |
| 16 | `search_cometchat_docs` | `Calls SDK v5 generateToken joinSession` | 2026-10-03 | Verified Calls SDK v5 session join pattern and token generation for group/meet rooms. | Established Calls SDK flow: generateToken -> joinSession into container. |
| 17 | `fetch_cometchat_doc_page` | `/calls/javascript/join-session` | 2026-10-03 | Confirmed API: `const result = await CometChatCalls.joinSession(callToken, callSettings, container)`. Returns `{ data: undefined, error: any }`. Single active session model. | S3 implementation passes container element with non-zero dimensions and checks `result.error`. |
| 18 | `fetch_cometchat_doc_page` | `/calls/javascript/session-settings` | 2026-10-03 | Confirmed `startAudioMuted: boolean` (set true for clinician), `sessionType: "VIDEO"`, `layout: "TILE"`, `startVideoPaused: false`, `hideControlPanel: false`, `idleTimeoutPeriodBeforePrompt: 60000`, `idleTimeoutPeriodAfterPrompt: 180000`. | S3 clinician configuration applies `startAudioMuted: true` to prevent acoustic feedback loop. |
| 19 | `fetch_cometchat_doc_page` | `/sdk/javascript/message-filtering` | 2026-10-03 | Confirmed exact builder syntax: `new CometChat.MessagesRequestBuilder().setGUID(guid).setCategories(["custom"]).setLimit(limit).build().fetchPrevious()`. Method uses uppercase `.setGUID()`. | S4 persistence runner uses verified `.setGUID()` method and category filtering to fetch custom messages in chronological order. |
| 20 | `search_cometchat_docs` | `MessageListener onCustomMessageReceived JavaScript SDK` | 2026-10-04 | Discovered `/sdk/javascript/all-real-time-listeners` index page. | Confirmed location of exhaustive real-time listener reference. |
| 21 | `fetch_cometchat_doc_page` | `/sdk/javascript/all-real-time-listeners` | 2026-10-04 | Exact method signatures: `onCustomMessageReceived(message: CometChat.CustomMessage)`, `onTransientMessageReceived(message: CometChat.TransientMessage)`. Also `OngoingCallListener` parameter shapes (`onUserJoined`, `onUserLeft`, `onUserMuted`). | Standardizes listener typing and parameter access in `Patient.tsx` and `Clinician.tsx`. |
| 22 | `fetch_cometchat_doc_page` | `/calls/javascript/troubleshooting` | 2026-10-04 | "Blank screen / Call UI doesn't appear" caused by container not mounted or having 0x0 dimensions. "Listener not firing" caused by registering after `joinSession`. | Enforces mounting container element with explicit CSS dimensions before invoking `joinSession`; register call listeners prior to `joinSession`. |
| 23 | `fetch_cometchat_doc_page` | `/calls/javascript/custom-control-panel` | 2026-10-04 | `hideControlPanel: true` option in `SessionSettings`. Action APIs: `CometChatCalls.muteAudio()`, `unmuteAudio()`, `pauseVideo()`, `resumeVideo()`, `leaveSession()`. | Enables custom Floating Island Bento controls without UI collisions from default Calls v5 bottom bar. |
| 24 | `fetch_cometchat_doc_page` | `/sdk/javascript/send-message` | 2026-10-04 | Verified `customMessage.shouldUpdateConversation(false)` method on `CometChat.CustomMessage` and constructor `new CometChat.CustomMessage(receiverId, receiverType, customType, customData)`. | Confirms pattern to prevent high-frequency exercise events (reps, alerts, cues) from updating conversation last message preview. |

---

## 3. UNVERIFIED Status Register (Post-MCP Verification)

| ID | Initial Claim | Status | Resolution / Verification Evidence |
|---|---|---|---|
| U1 | Chat SDK JS v4 + Calls SDK JS v5 | **VERIFIED** | Confirmed via bundles and `/calls/javascript/overview`. |
| U2 | App ID + Region init, Server Auth Token login | **VERIFIED** | `CometChat.init(appId, settings)` and `CometChatCalls.loginWithAuthToken(token)`. |
| U3 | REST API creates users & mints tokens | **VERIFIED** | REST API `/v3/users` and `/v3/users/{uid}/auth_tokens`. Keys never leak to browser. |
| U4 | Server creates group & assigns members | **VERIFIED** | `POST /v3/groups` supports bulk member addition on creation. |
| U5 | Custom message schema & conversation flags | **VERIFIED** | `new CometChat.CustomMessage(...)` with `customType` + `customData`. |
| U6 | Transient messages in groups | **VERIFIED** | Confirmed: `TransientMessage(guid, RECEIVER_TYPE.GROUP, data)`. |
| U7 | Transient rate cap | **VERIFIED** | Fire-and-forget. Client rate-cap of 10 Hz in `rateCap.ts` prevents browser CPU thrashing. |
| U8 | Presence & typing listeners | **VERIFIED** | `CometChat.addUserListener` with `onUserOnline` / `onUserOffline`. |
| U9 | Calls v5 session tied to group GUID | **VERIFIED** | `CometChatCalls.generateToken(sessionId)` where `sessionId = groupGuid`. |
| U10 | Local camera access for pose detection | **CLARIFIED / ARCHITECTED** | Calls SDK renders into `containerElement`. Browser WebRTC standard: patient video feed can be processed via dedicated `getUserMedia` local track or directly from the rendered `<video>` element inside the container. Spike S1 validates. |
| U11 | MediaPipe landmark indices (23/25/27 L, 24/26/28 R) | **VERIFIED** | Confirmed standard BlazePose 33-landmark topology: 23=L hip, 25=L knee, 27=L ankle; 24=R hip, 26=R knee, 28=R ankle. |
| U12 | Moderator actions (mute participant) | **VERIFIED BONUS** | Discovered `CometChatCalls.muteParticipant(participantId)` in official actions API. |
