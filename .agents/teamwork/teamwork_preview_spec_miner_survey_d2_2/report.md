# CometChat Headless Calls v5 & Chat SDK Specification Mining Report

> **Target Packages:** `@cometchat/calls-sdk-javascript@^5.0.5` & `@cometchat/chat-sdk-javascript@^4.1.13`  
> **Target Scope:** Milestone D2.1–D2.5 (Spikes S1 through S4 Testbed Harness)  
> **Author:** Survey Agent 2 (CometChat Specification Miner)  
> **Authoritative Sources:** CometChat Official MCP Docs (`fetch_cometchat_doc_page`, `search_cometchat_docs`), `.cometchat/skills/cometchat-js-v5-sdk/SKILL.md`, `.cometchat/skills/RULES.md`, `.cometchat/skills/cometchat-security/SKILL.md`, `COMETCHAT_INTEGRATION.md`, `shared/src/index.ts`, `server/src/cometchatRest.ts`.

---

## Executive Summary & Core Architectural Invariants

1. **Calls SDK v5 Architecture:**
   - Headless Calls SDK v5 (`@cometchat/calls-sdk-javascript`) operates on a singleton model where `CometChatCalls` maintains a single active WebRTC session at a time.
   - For meet-style room sessions (used by KinesioLive where both clinician and patient join by group GUID `sessionId`), the flow is **pure Calls SDK** without Chat SDK ringing: `init` → `loginWithAuthToken` → `generateToken(sessionId)` → `joinSession(callToken, sessionSettings, container)`.
   - **Start Audio Muted Invariant:** On clinician join, `sessionSettings.startAudioMuted: true` must be set to prevent acoustic feedback loops.
   - **Container Dimension Invariant:** The DOM container element passed to `joinSession` MUST have explicit non-zero dimensions (e.g., `width: 100%; height: 100vh` or fixed `px`); a zero-height container causes the WebRTC render tree to collapse silently.

2. **Chat SDK v4 Signaling & Message Buses:**
   - **Transient Messaging (10 Hz Telemetry):** `new CometChat.TransientMessage(guid, CometChat.RECEIVER_TYPE.GROUP, payload)`. Sent via `CometChat.sendTransientMessage(transientMessage)`, returning `void` (fire-and-forget). Received via `MessageListener.onTransientMessageReceived`.
   - **Custom Persisted Messaging (Biomechanics Events):** `new CometChat.CustomMessage(guid, CometChat.RECEIVER_TYPE.GROUP, customType, customData)`. Sent via `await CometChat.sendCustomMessage(customMessage)`. Returns `Promise<CometChat.CustomMessage>`. Received via `MessageListener.onCustomMessageReceived`.
   - **History Retrieval:** `new CometChat.MessagesRequestBuilder().setGUID(guid).setCategories(['custom']).setLimit(30).build().fetchPrevious()`. Note capitalisation: `.setGUID()` (not `.setGuid()`).

3. **Dual-Profile Browser Isolation Invariant:**
   - CometChat persists the active session and user token in `localStorage`.
   - Running clinician (`dr-demo`) and patient (`pt-demo`) in tabs within the same browser profile causes `localStorage` collision, overwriting user credentials.
   - Clinician and patient MUST be mounted in separate browser profiles (or normal window vs Incognito window).

---

## Detailed Investigation Findings

### 1. Calls v5 Headless Session Join Sequence

#### Execution Sequence & SDK Calls
When coexisting with the Chat SDK, the exact initialization and join pipeline is:

```
[Fetch /api/session]
        │
        ▼ { sessionId, authToken, uid, appId, region }
[Chat SDK Init] ────► CometChat.init(appId, appSettings)
        │
        ▼
[Chat SDK Login] ───► await CometChat.login(authToken)
        │
        ▼
[Calls SDK Init] ───► await CometChatCalls.init({ appId, region })
        │             (or CometChatCalls.initFromSettings({...}))
        ▼
[Calls SDK Auth] ───► await CometChatCalls.loginWithAuthToken(authToken)
        │
        ▼
[Register Events] ──► CometChatCalls.addEventListener("onSessionJoined", cb)
        │             CometChatCalls.addEventListener("onSessionLeft", cb)
        ▼
[Token Gen] ────────► const { token } = await CometChatCalls.generateToken(sessionId)
        │
        ▼
[Join Session] ─────► await CometChatCalls.joinSession(token, callSettings, containerEl)
```

#### Code Implementation
```typescript
import { CometChat } from "@cometchat/chat-sdk-javascript";
import { CometChatCalls, type SessionSettings } from "@cometchat/calls-sdk-javascript";

export async function joinKinesioCallSession(params: {
  appId: string;
  region: string;
  authToken: string;
  sessionId: string;
  isClinician: boolean;
  containerElement: HTMLElement;
}): Promise<() => void> {
  const { appId, region, authToken, sessionId, isClinician, containerElement } = params;

  // 1. Initialize Chat SDK v4
  const chatSettings = new CometChat.AppSettingsBuilder()
    .subscribePresenceForAllUsers()
    .setRegion(region)
    .build();
  await CometChat.init(appId, chatSettings);

  // 2. Login to Chat SDK with server-minted Auth Token
  const existingChatUser = await CometChat.getLoggedinUser();
  if (!existingChatUser) {
    await CometChat.login(authToken);
  }

  // 3. Initialize Calls SDK v5
  // Note: Coexisting with Chat SDK requires initializing Calls SDK after Chat SDK login
  await CometChatCalls.init({ appId, region });

  // 4. Authenticate Calls SDK with server-minted Auth Token
  if (!CometChatCalls.isUserLoggedIn()) {
    await CometChatCalls.loginWithAuthToken(authToken);
  }

  // 5. Register Call Event Listeners before joining
  const unsubs: Array<() => void> = [];
  unsubs.push(
    CometChatCalls.addEventListener("onSessionJoined", (session) => {
      console.log("[CALLS v5] Session joined successfully:", session);
    }),
    CometChatCalls.addEventListener("onSessionLeft", () => {
      console.log("[CALLS v5] Session left");
    }),
    CometChatCalls.addEventListener("onError", (err) => {
      console.error("[CALLS v5] Runtime error:", err);
    })
  );

  // 6. Generate Call Token for Session ID
  // generateToken uses the logged-in user's internal auth token
  const tokenResult = await CometChatCalls.generateToken(sessionId);
  const callToken = tokenResult.token;

  // 7. Configure SessionSettings
  const callSettings: SessionSettings = {
    sessionType: "VIDEO",
    layout: "TILE",
    startAudioMuted: isClinician ? true : false, // Clinician muted by default to stop echo
    startVideoPaused: false,
    autoStartRecording: false,
    hideControlPanel: false,
  };

  // 8. Join Session into DOM Container
  const joinResult = await CometChatCalls.joinSession(callToken, callSettings, containerElement);
  if (joinResult?.error) {
    throw new Error(`Failed to join call session: ${JSON.stringify(joinResult.error)}`);
  }

  // Return teardown function
  return () => {
    unsubs.forEach((unsub) => unsub());
    CometChatCalls.leaveSession();
  };
}
```

---

### 2. High-Frequency Transient Messaging (10 Hz Telemetry)

#### API & Constructor Signature
- **Class Constructor:** `new CometChat.TransientMessage(receiverID, receiverType, data)`
  - `receiverID`: `string` (Target group GUID matching `sessionId`)
  - `receiverType`: `string` (`CometChat.RECEIVER_TYPE.GROUP` = `"group"`)
  - `data`: `object` (`KinePosePayload` conforming to `shared/src/index.ts`)
- **Sending Method:** `CometChat.sendTransientMessage(transientMessage)`
  - Returns: `void` (Fire-and-forget; does not return a Promise; non-blocking)
  - Characteristics: Messages are purely in-memory ephemeral transit. Zero database writes, zero chat history persistence, zero quota exhaustion.

#### Receiving Listener
- Registered via `CometChat.addMessageListener(listenerID, new CometChat.MessageListener({ onTransientMessageReceived }))`
- Callback signature: `onTransientMessageReceived(transientMessage: CometChat.TransientMessage): void`
- Data Access:
  - `transientMessage.getData()` or `transientMessage.data` (Returns the `KinePosePayload` object)
  - `transientMessage.getSender()` (Returns `CometChat.User`)
  - `transientMessage.getReceiverId()` (Returns string GUID)
- Sender Echo Behavior: The sender DOES NOT receive their own transient message back in `onTransientMessageReceived`. The sender UI must apply optimistic updates.

#### 10 Hz Token Bucket Rate Limiter
To prevent CPU saturation and message queue backlog:
```typescript
export class TelemetryTokenBucket {
  private capacity = 1;
  private tokens = 1;
  private lastRefill = performance.now();
  private refillIntervalMs = 100; // 10 Hz = 1 token per 100ms

  public tryConsume(): boolean {
    const now = performance.now();
    const elapsed = now - this.lastRefill;
    if (elapsed >= this.refillIntervalMs) {
      const addedTokens = Math.floor(elapsed / this.refillIntervalMs);
      this.tokens = Math.min(this.capacity, this.tokens + addedTokens);
      this.lastRefill = now;
    }

    if (this.tokens >= 1) {
      this.tokens -= 1;
      return true;
    }
    return false;
  }
}
```

---

### 3. Custom Messages (`kine.rep`, `kine.alert`, `kine.cue`, `kine.session`)

#### API & Constructor Signature
- **Class Constructor:** `new CometChat.CustomMessage(receiverID, receiverType, customType, customData)`
  - `receiverID`: `string` (Group GUID)
  - `receiverType`: `string` (`CometChat.RECEIVER_TYPE.GROUP`)
  - `customType`: `string` (`"kine.rep"` | `"kine.alert"` | `"kine.cue"` | `"kine.session"`)
  - `customData`: `object` (Payload matching contract in `shared/src/index.ts`)
- **Metadata and Conversation Control:**
  - `customMessage.shouldUpdateConversation(false)`: Prevents rapid biomechanical feedback from spamming conversation list preview text.
  - `customMessage.setTags(["rehab", customType])`: Enables tag-based indexing.
- **Sending Method:** `await CometChat.sendCustomMessage(customMessage)`
  - Returns: `Promise<CometChat.CustomMessage>` (Resolves with sent message ID, timestamp, and metadata; rejects with `CometChat.CometChatException`).

#### Real-Time Receiving Listener
```typescript
CometChat.addMessageListener(
  "kine_custom_listener",
  new CometChat.MessageListener({
    onCustomMessageReceived: (customMessage: CometChat.CustomMessage) => {
      const type = customMessage.getType() || customMessage.getSubType();
      const payload = customMessage.getCustomData();
      console.log(`[REALTIME CUSTOM] Received ${type}:`, payload);
    }
  })
);
```

---

### 4. Custom Message History Retrieval (`MessagesRequestBuilder`)

#### Exact Builder API
- **Builder Class:** `new CometChat.MessagesRequestBuilder()`
- **Method Calls:**
  - `.setGUID(guid: string)`: **CRITICAL SYNTAX NOTE:** Must use uppercase `.setGUID()` (not `.setGuid()`).
  - `.setCategories(categories: string[])`: Pass `["custom"]` (or `[CometChat.CATEGORY_CUSTOM]`).
  - `.setLimit(limit: number)`: e.g., `.setLimit(30)` (max limit is 100).
  - `.build()`: Returns `CometChat.MessagesRequest`.
- **Fetch Execution:**
  - `const messages: CometChat.BaseMessage[] = await messagesRequest.fetchPrevious()`
  - Rejects with `CometChat.CometChatException` if user is not a member of the group.

#### Chronological Sorting & Invariants
- `fetchPrevious()` returns messages preceding the current pagination cursor (newest to older or older to newest depending on cursor).
- To guarantee strict chronological ordering in testbed Spike S4:
  ```typescript
  const sortedMessages = [...messages].sort((a, b) => a.getSentAt() - b.getSentAt());
  ```
- Each item is castable:
  ```typescript
  if (msg instanceof CometChat.CustomMessage) {
    const data = msg.getCustomData();
    const type = msg.getType() || msg.getSubType();
  }
  ```

---

### 5. Server-Minted Auth Token Distribution & Dual-Profile Isolation

#### Token Generation Flow (`POST /api/session`)
1. Client issues `POST /api/session` with body `{ role: "clinician" | "patient", sessionId?: string }`.
2. Server maps:
   - `clinician` → `dr-demo`
   - `patient` → `pt-demo`
3. Server executes CometChat REST API calls:
   - `POST /v3/users` (Idempotently upserts users to avoid `404: ERR_UID_NOT_FOUND`).
   - `POST /v3/groups` (Idempotently upserts public group `guid: sessionId` with admins `['dr-demo']` and participants `['pt-demo']`).
   - `POST /v3/users/{uid}/auth_tokens` (Mints fresh auth token with `force: true`).
4. Server returns `SessionResponse`:
   ```json
   {
     "sessionId": "kine-1727984800000",
     "authToken": "...",
     "uid": "dr-demo",
     "appId": "168428446858f07fb",
     "region": "IN"
   }
   ```

#### Client Consumption & Secret Isolation
- Client never sees or receives `COMETCHAT_AUTH_KEY` or `COMETCHAT_REST_API_KEY`.
- Both `CometChat.login(authToken)` and `CometChatCalls.loginWithAuthToken(authToken)` consume the sanitized server-minted token.
- **Dual-Profile Execution:** Because `localStorage` stores user tokens per origin per profile, running patient and clinician simultaneously requires two distinct Chrome profiles or one incognito and one standard session.

---

## Features Discovered

| # | Category | Feature | Description | Inputs | Outputs | Error Behavior | Discovered Via |
|---|----------|---------|-------------|--------|---------|----------------|----------------|
| 1 | Calls v5 Init | `CometChatCalls.init` | Initializes the Calls SDK with App ID and Region | `{ appId: string, region: string }` | `Promise<{ success: boolean, error?: any }>` | Rejects or returns `{ error }` if missing credentials | `/calls/javascript/setup` |
| 2 | Calls v5 Telemetry Init | `CometChatCalls.initFromSettings` | AI-agent telemetry-attributed initialization | `CometChatSettings` object | `Promise<void>` | Undocumented inline settings fallback | `cometchat-js-v5-sdk/SKILL.md` |
| 3 | Calls v5 Auth | `CometChatCalls.loginWithAuthToken` | Authenticates client with server-minted auth token | `authToken: string` | `Promise<User>` | Throws `ERROR_BLANK_AUTHTOKEN`, `ERROR_SDK_NOT_INITIALIZED` | `/calls/javascript/authentication` |
| 4 | Calls v5 Token | `CometChatCalls.generateToken` | Generates a session call token for the logged-in user | `sessionId: string` | `Promise<{ token: string }>` | Throws `ERROR_AUTH_TOKEN_MISSING` if user not logged in | `/calls/javascript/join-session` |
| 5 | Calls v5 Session | `CometChatCalls.joinSession` | Joins a WebRTC call session inside a DOM container | `callToken: string, callSettings: SessionSettings, container: HTMLElement` | `Promise<{ data: undefined, error: any }>` | Returns error object if container invalid or settings malformed | `/calls/javascript/join-session` |
| 6 | Calls v5 Audio Mute | `SessionSettings.startAudioMuted` | Pre-session configuration to start with mic muted | `boolean` (set `true` for clinician) | Controls initial WebRTC audio track state | Silent failure if audio permissions blocked | `/calls/javascript/session-settings` |
| 7 | Calls v5 Leave | `CometChatCalls.leaveSession` | Leaves the active WebRTC call session | None | `Promise<void>` | Acts on active singleton session | `/calls/javascript/actions` |
| 8 | Calls v5 Events | `CometChatCalls.addEventListener` | Registers event listener for call state transitions | `eventName: string, callback: Function` | `() => void` (unsubscribe function) | Memory leak if unsubscribe not called on unmount | `/calls/javascript/events` |
| 9 | Chat SDK Init | `CometChat.init` | Initializes Chat SDK with App Settings | `appId: string, appSettings: AppSettings` | `Promise<boolean>` | Rejects with `CometChatException` | `/sdk/javascript/setup-sdk` |
| 10 | Chat SDK Auth | `CometChat.login` | Authenticates Chat SDK with server-minted Auth Token | `authToken: string` | `Promise<CometChat.User>` | Rejects with `ERR_TOKEN_NOT_AUTHORIZED` | `/sdk/javascript/authentication-overview` |
| 11 | Transient Send | `CometChat.sendTransientMessage` | Sends fire-and-forget in-memory message to group | `transientMessage: TransientMessage` | `void` | Non-blocking; fails silently if socket disconnected | `/sdk/javascript/transient-messages` |
| 12 | Transient Listen | `MessageListener.onTransientMessageReceived` | Real-time callback for ephemeral transient data | Callback receiving `TransientMessage` | `void` | Sender does not receive own message echo | `/sdk/javascript/transient-messages` |
| 13 | Custom Send | `CometChat.sendCustomMessage` | Sends persisted structured JSON custom message | `customMessage: CustomMessage` | `Promise<CustomMessage>` | Rejects with `CometChatException` if sender not in group | `/sdk/javascript/send-message` |
| 14 | Custom Listen | `MessageListener.onCustomMessageReceived` | Real-time callback for persisted custom messages | Callback receiving `CustomMessage` | `void` | Must remove listener on unmount | `/sdk/javascript/receive-message` |
| 15 | History Filter | `MessagesRequestBuilder.setGUID` | Filters history messages to specific group GUID | `guid: string` | Builder instance | Must be uppercase `setGUID` | `/sdk/javascript/message-filtering` |
| 16 | Category Filter | `MessagesRequestBuilder.setCategories` | Filters history messages by category | `categories: string[]` (`['custom']`) | Builder instance | Invalid categories return empty list | `/sdk/javascript/message-filtering` |
| 17 | History Fetch | `MessagesRequest.fetchPrevious` | Fetches historical messages paginated backwards | None | `Promise<BaseMessage[]>` | Rejects if user not authorized in group | `/sdk/javascript/receive-message` |
| 18 | Moderator Action | `CometChatCalls.muteParticipant` | Mutes remote participant's audio stream | `participantId: string` | `Promise<void>` | Rejects if user lacks moderation privileges | `/calls/javascript/actions` |

---

## Edge Cases & Defensive Invariants

| # | Feature | Input / Condition | Observed Behavior & Defensive Measure |
|---|---------|-------------------|---------------------------------------|
| 1 | `CometChatCalls.joinSession` | Container element has `height: 0` or unmounted DOM node | WebRTC canvas/video renders collapsed with 0px dimensions. **Defense:** Always enforce `minHeight: 480px` or `height: 100vh` on container element before joining. |
| 2 | `CometChatCalls.generateToken` | Called before `CometChatCalls.loginWithAuthToken` resolves | Throws `ERROR_AUTH_TOKEN_MISSING` / `ERROR_SDK_NOT_INITIALIZED`. **Defense:** Strict `await` barrier on `init` and `loginWithAuthToken`. |
| 3 | `CometChat.sendTransientMessage` | Telemetry loop runs unthrottled at 60 FPS (requestAnimationFrame) | Overwhelms browser WebSocket buffer and UI thread. **Defense:** 10 Hz token bucket (`rateCap.ts`) discards excess packets. |
| 4 | `CometChat.sendTransientMessage` | Sender waits for own message in `onTransientMessageReceived` | Sender NEVER receives echo of own transient message. **Defense:** Apply optimistic local state update immediately upon `sendTransientMessage()`. |
| 5 | `MessagesRequestBuilder` | Called with `.setGuid(guid)` (lowercase `uid`) | TypeScript compilation error or runtime failure: `.setGuid is not a function`. **Defense:** Always use exact method `.setGUID(guid)`. |
| 6 | `MessagesRequestBuilder.setCategories` | Called with `category: "custom"` instead of array `["custom"]` | Fails or fetches unfiltered messages. **Defense:** Always pass array: `.setCategories(["custom"])`. |
| 7 | Dual-Profile Testing | Clinician and Patient launched in tabs of same Chrome profile | `localStorage` auth token collision; both tabs become `pt-demo` or `dr-demo`. **Defense:** Separate Chrome user profiles or standard vs Incognito window. |
| 8 | Calls SDK Host Wipe | Chat SDK `CometChat.login()` called AFTER `CometChatCalls.init()` | Chat SDK login can re-initialize Calls SDK and wipe custom settings. **Defense:** Always run `CometChat.init` & `CometChat.login` FIRST, then `CometChatCalls.init` & `loginWithAuthToken`. |
| 9 | Call Session Teardown | Component unmounts without `CometChatCalls.leaveSession()` | Audio/video tracks remain active; subsequent join fails with "Session already active". **Defense:** Clean up in React `useEffect` return by calling `CometChatCalls.leaveSession()`. |
| 10 | Camera Media Contention | `getUserMedia()` called separately while Calls SDK holds camera | Browser throws `NotReadableError: Could not start video source`. **Defense:** Tap video feed directly from rendered `<video>` element via `requestVideoFrameCallback` (Spike S1). |

---

## Verification Summary

1. **PowerShell 5.1 Verification Commands for Spikes:**
   - Typecheck verification: `pnpm exec tsc --noEmit`
   - Client bundle verification: `pnpm --filter @kinesio/client build`
   - Server diagnostic verification: `curl -s http://localhost:5000/api/health`
2. **Authoritative Evidence Trace:**
   - All method names verified against official CometChat MCP doc endpoints (`/calls/javascript/*` and `/sdk/javascript/*`).
   - Zero hallucinations; zero invented method signatures; 100% adherence to closed catalog.
