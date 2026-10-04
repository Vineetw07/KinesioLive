# Dispatch to teamwork_preview_spec_miner_survey_2

## Objective
Extract precise specification requirements for CometChat v3 REST API token service backend:
1. Examine `ORIGINAL_REQUEST.md`, `docs/trd.md` (especially Section 2 & Section 4), `docs/audit.md`, `COMETCHAT_INTEGRATION.md`, `.cometchat/skills/RULES.md`, and `.cometchat/skills/cometchat-security/SKILL.md`.
2. Document the exact REST endpoints, headers, request bodies, and response schemas for:
   - User Upsert: `POST https://{APP_ID}.api-{REGION}.cometchat.io/v3/users` (handling existing vs new user, role, uid)
   - Group Upsert: `POST https://{APP_ID}.api-{REGION}.cometchat.io/v3/groups` (`guid`, `name`, `type: "public"`) and adding members (`dr-demo`, `pt-demo`)
   - Auth Token Minting: `POST https://{APP_ID}.api-{REGION}.cometchat.io/v3/users/{uid}/auth_tokens` with `apiKey` in headers (`apikey: process.env.COMETCHAT_REST_API_KEY || process.env.COMETCHAT_AUTH_KEY`)
   - Boot credential validation & diagnostic warnings
3. Check existing root `.env` (without logging full secrets, verify which variable names are present: `COMETCHAT_APP_ID`, `COMETCHAT_REGION`, `COMETCHAT_REST_API_KEY`, `COMETCHAT_AUTH_KEY`).
4. Document expected behavior for `GET /api/health` and `POST /api/session`.

## Constraints & Inputs
- Authoritative user request: `d:\TP\Hackathon\Cometchat\.agents\teamwork\ORIGINAL_REQUEST.md` (MUST READ FIRST)
- Working directory: `d:\TP\Hackathon\Cometchat\.agents\teamwork\teamwork_preview_spec_miner_survey_2\`
- Do NOT write or modify source code. Read-only specification mining.
- Output report: `d:\TP\Hackathon\Cometchat\.agents\teamwork\teamwork_preview_spec_miner_survey_2\handoff.md`


## 2026-10-03T18:35:50Z
Your working directory is: d:\TP\Hackathon\Cometchat\.agents\teamwork\teamwork_preview_spec_miner_survey_2\
Read your dispatch file at: d:\TP\Hackathon\Cometchat\.agents\teamwork\teamwork_preview_spec_miner_survey_2\DISPATCH.md
MANDATORY: Read ORIGINAL_REQUEST.md at: d:\TP\Hackathon\Cometchat\.agents\teamwork\ORIGINAL_REQUEST.md before starting work.

Task:
Extract precise CometChat v3 REST specifications for the token service backend:
1. Read docs/trd.md (Section 2 & 4), docs/audit.md, COMETCHAT_INTEGRATION.md, .cometchat/skills/RULES.md, and .cometchat/skills/cometchat-security/SKILL.md.
2. Determine exact REST endpoints, headers, payloads, query params, and status codes for:
   - User Upsert: POST https://{APP_ID}.api-{REGION}.cometchat.io/v3/users
   - Group Upsert: POST https://{APP_ID}.api-{REGION}.cometchat.io/v3/groups and member assignment
   - Auth Token Minting: POST https://{APP_ID}.api-{REGION}.cometchat.io/v3/users/{uid}/auth_tokens
   - Boot credential diagnostics and error handling
   - Health endpoint: GET /api/health
   - Session endpoint: POST /api/session
Write your complete findings to handoff.md in your working directory and notify the parent orchestrator.
Do not modify or write source code.
