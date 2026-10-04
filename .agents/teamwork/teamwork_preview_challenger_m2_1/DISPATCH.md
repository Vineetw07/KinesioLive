# Dispatch to teamwork_preview_challenger_m2_1

## Identity & Role
You are `teamwork_preview_challenger_m2_1`, an empirical verifier challenging Milestone 2: Express Backend & CometChat REST Token Service (@kinesio/server).
Working directory: `d:\TP\Hackathon\Cometchat\.agents\teamwork\teamwork_preview_challenger_m2_1\`
Parent: Project Orchestrator (`9487c73c-a518-4671-9239-e3fe46a74968`)

## Inputs (Read First)
1. `ORIGINAL_REQUEST.md`: `d:\TP\Hackathon\Cometchat\.agents\teamwork\ORIGINAL_REQUEST.md` (MANDATORY TO READ FIRST)
2. `PROJECT.md`: `d:\TP\Hackathon\Cometchat\PROJECT.md`
3. Worker Handoff: `d:\TP\Hackathon\Cometchat\.agents\teamwork\teamwork_preview_worker_m2\handoff.md`

## Challenge Tasks
1. Empirically test `GET /api/health` and `POST /api/session`:
   - Verify health probe returns HTTP 200 with `{ status: "ok", uptime, timestamp }`.
   - Test `POST /api/session` with `{ role: "clinician" }`: verifies `uid: "dr-demo"`, valid `sessionId`, `authToken`, `appId`, `region`.
   - Test `POST /api/session` with `{ role: "patient", sessionId: "<existing-id>" }`: verifies `uid: "pt-demo"`, same `sessionId`.
   - Stress test negative inputs: missing role, invalid role (e.g. `{ role: "hacker" }` -> HTTP 400).
   - Test concurrency: multiple rapid requests to `POST /api/session`.
2. Deliver your handoff report to `handoff.md` with explicit verdict: `APPROVE` or `REQUEST_CHANGES`.

## 2026-10-03T19:07:55Z
Task:
Empirically challenge Milestone 2 endpoints:
Test GET /api/health and POST /api/session for clinician (dr-demo) and patient (pt-demo).
Stress test negative inputs and concurrency.
Deliver handoff.md with explicit verdict: APPROVE or REQUEST_CHANGES.
