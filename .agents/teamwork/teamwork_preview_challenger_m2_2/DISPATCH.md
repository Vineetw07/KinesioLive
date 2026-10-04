# Dispatch to teamwork_preview_challenger_m2_2

## Identity & Role
You are `teamwork_preview_challenger_m2_2`, an empirical verifier challenging Milestone 2: Express Backend & CometChat REST Token Service (@kinesio/server).
Working directory: `d:\TP\Hackathon\Cometchat\.agents\teamwork\teamwork_preview_challenger_m2_2\`
Parent: Project Orchestrator (`9487c73c-a518-4671-9239-e3fe46a74968`)

## Inputs (Read First)
1. `ORIGINAL_REQUEST.md`: `d:\TP\Hackathon\Cometchat\.agents\teamwork\ORIGINAL_REQUEST.md` (MANDATORY TO READ FIRST)
2. `PROJECT.md`: `d:\TP\Hackathon\Cometchat\PROJECT.md`
3. Worker Handoff: `d:\TP\Hackathon\Cometchat\.agents\teamwork\teamwork_preview_worker_m2\handoff.md`

## Challenge Tasks
1. Empirically test boot diagnostics, server configuration, and security:
   - Check that server handles truncated keys in `.env` gracefully, emits diagnostic warning, and does NOT crash.
   - Verify that REST API Key or Auth Key are NEVER returned in `SessionResponse` payload.
   - Verify that CORS and JSON body parser are correctly mounted.
   - Execute the E2E health and session tests (`npx -y vitest run tests/e2e/health.test.ts tests/e2e/session.test.ts`).
2. Deliver your handoff report to `handoff.md` with explicit verdict: `APPROVE` or `REQUEST_CHANGES`.


## 2026-10-03T19:07:55Z
From: 9487c73c-a518-4671-9239-e3fe46a74968
Content: Your working directory is: d:\TP\Hackathon\Cometchat\.agents\teamwork\teamwork_preview_challenger_m2_2\
Read your dispatch file at: d:\TP\Hackathon\Cometchat\.agents\teamwork\teamwork_preview_challenger_m2_2\DISPATCH.md
MANDATORY: Read ORIGINAL_REQUEST.md at: d:\TP\Hackathon\Cometchat\.agents\teamwork\ORIGINAL_REQUEST.md before starting work.

Task:
Empirically test boot diagnostics, server configuration, and secret protection in Milestone 2.
Verify truncated key detection, run test suite, check zero secret leakage.
Deliver handoff.md with explicit verdict: APPROVE or REQUEST_CHANGES.
