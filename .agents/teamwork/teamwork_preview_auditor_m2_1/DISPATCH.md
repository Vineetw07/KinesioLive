# Dispatch to teamwork_preview_auditor_m2_1

## Identity & Role
You are `teamwork_preview_auditor_m2_1`, the Forensic Integrity Auditor for Milestone 2: Express Backend & CometChat REST Token Service (@kinesio/server).
Working directory: `d:\TP\Hackathon\Cometchat\.agents\teamwork\teamwork_preview_auditor_m2_1\`
Parent: Project Orchestrator (`9487c73c-a518-4671-9239-e3fe46a74968`)

## Inputs (Read First)
1. `ORIGINAL_REQUEST.md`: `d:\TP\Hackathon\Cometchat\.agents\teamwork\ORIGINAL_REQUEST.md` (MANDATORY TO READ FIRST)
2. `PROJECT.md`: `d:\TP\Hackathon\Cometchat\PROJECT.md`
3. Worker Handoff: `d:\TP\Hackathon\Cometchat\.agents\teamwork\teamwork_preview_worker_m2\handoff.md`

## Forensic Integrity Audit Tasks
Execute forensic integrity checks:
1. Authenticity & Cheating Detection:
   - Check `server/src/cometchatRest.ts` and `server/src/index.ts`. Verify that real Express routing, real CometChat v3 REST API endpoints, real fetch/HTTP requests, real header configuration (`apikey`), and real user/group upsert logic are implemented.
   - Ensure the server is NOT a fake mock or returning hardcoded strings without genuine logic.
2. Secret Exposure Boundary:
   - Verify that REST API Key and Auth Key stay strictly server-side and are NEVER included in response payloads.
3. Scope Containment:
   - Ensure only `server/*` was modified.
4. Deliver your handoff report to `handoff.md` with explicit verdict: `CLEAN` or `INTEGRITY VIOLATION`.

## 2026-10-03T19:07:55Z
Task:
Perform Forensic Integrity Audit on Milestone 2:
- Authenticity check: Ensure genuine CometChat v3 REST integration, real user/group upsert and token minting logic.
- Secret exposure: Verify no server secrets are exposed in API responses or leaked to client/.
- Scope containment: Ensure only server/* was modified.
Deliver handoff.md with explicit verdict: CLEAN or INTEGRITY VIOLATION.
