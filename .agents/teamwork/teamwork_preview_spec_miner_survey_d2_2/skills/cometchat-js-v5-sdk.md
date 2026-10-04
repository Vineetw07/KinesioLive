# Local Copy of cometchat-js-v5-sdk/SKILL.md
# Reference: d:/TP/Hackathon/Cometchat/.cometchat/skills/cometchat-js-v5-sdk/SKILL.md
# Verified: 2026-10-03

Key Takeaways:
- Package: @cometchat/calls-sdk-javascript@^5
- Method Map:
  - Init: CometChatCalls.init({ appId, region }) or CometChatCalls.initFromSettings(settings)
  - Auth: CometChatCalls.loginWithAuthToken(token)
  - Session Token: CometChatCalls.generateToken(sessionId) -> Promise<{ token: string }>
  - Join: CometChatCalls.joinSession(token, sessionSettings, containerEl) -> Promise<{ data, error }>
  - Leave: CometChatCalls.leaveSession()
  - Listeners: CometChatCalls.addEventListener(eventName, callback) -> unsubscribe()
- SessionSettings:
  - sessionType: "VIDEO" | "VOICE"
  - layout: "TILE" | "SIDEBAR" | "SPOTLIGHT"
  - startAudioMuted: boolean (true for clinician)
  - startVideoPaused: boolean
