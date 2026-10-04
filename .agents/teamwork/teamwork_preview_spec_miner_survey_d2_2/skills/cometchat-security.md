# Local Copy of cometchat-security/SKILL.md
# Reference: d:/TP/Hackathon/Cometchat/.cometchat/skills/cometchat-security/SKILL.md
# Verified: 2026-10-03

Key Invariants:
- Three credentials, three homes:
  - Auth Key: client, dev only
  - Auth Token: client, per user, server-minted
  - REST API Key: server only
- Server mints auth token: POST /v3/users/{uid}/auth_tokens with REST API Key
- UID derived on server from role/session, never accepted arbitrarily from client
- Client logs in using auth token: CometChat.login(authToken) and CometChatCalls.loginWithAuthToken(authToken)
