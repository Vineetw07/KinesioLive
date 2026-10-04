# Local Copy of RULES.md
# Reference: d:/TP/Hackathon/Cometchat/.cometchat/skills/RULES.md
# Verified: 2026-10-03

Key Invariants:
- Auth key is dev-only client-side; teach server-side token exchange for production. Never hardcode.
- Init ordering: init() -> login() -> render/join.
- Single package per platform. Calls SDK is major v5; Chat SDK is major v4.
- Container element MUST have real dimensions (height & width) or call surface collapses to 0px.
- Never guess SDK API methods; fetch from official docs or verify with MCP.
