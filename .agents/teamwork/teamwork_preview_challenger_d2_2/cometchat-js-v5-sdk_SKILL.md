# cometchat-js-v5-sdk Core Methodology

- Target SDK: `@cometchat/calls-sdk-javascript@5`
- Initialization & Login: `CometChatCalls.init({ appId, region })` (or `initFromSettings`) -> `CometChatCalls.loginWithAuthToken(token)` -> `generateToken(sessionId)` -> `joinSession(token, sessionSettings, containerEl)`
- Strict SessionSettings:
  - `startAudioMuted: boolean` (must be true for clinician to prevent acoustic feedback)
  - `startVideoPaused: boolean`
  - `sessionType: 'VIDEO'`
  - `layout: 'TILE'`
- Container Invariant: Container element must have non-zero dimensions.
- Teardown Invariant: Collect `addEventListener` return unsub functions, execute on cleanup, and invoke `CometChatCalls.leaveSession()`.
