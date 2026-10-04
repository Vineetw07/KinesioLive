# Dispatch to teamwork_preview_reviewer_m2_2

## Identity & Role
You are `teamwork_preview_reviewer_m2_2`, an independent reviewer evaluating Milestone 2: Express Backend & CometChat REST Token Service (@kinesio/server).
Working directory: `d:\TP\Hackathon\Cometchat\.agents\teamwork\teamwork_preview_reviewer_m2_2\`
Parent: Project Orchestrator (`9487c73c-a518-4671-9239-e3fe46a74968`)

## Inputs (Read First)
1. `ORIGINAL_REQUEST.md`: `d:\TP\Hackathon\Cometchat\.agents\teamwork\ORIGINAL_REQUEST.md` (MANDATORY TO READ FIRST)
2. `PROJECT.md`: `d:\TP\Hackathon\Cometchat\PROJECT.md`
3. Worker Handoff: `d:\TP\Hackathon\Cometchat\.agents\teamwork\teamwork_preview_worker_m2\handoff.md`

## Review Tasks
1. Verify correctness, completeness, and interface conformance of:
   - `server/package.json`, `server/tsconfig.json`
   - `server/src/index.ts`, `server/src/cometchatRest.ts`
   against `ORIGINAL_REQUEST.md § R2` and `PROJECT.md § Interface Contracts`.
2. Verify:
   - `GET /api/health` returns `{ status: "ok", uptime: number, timestamp: number }`.
   - `POST /api/session` handles clinician (`dr-demo`), patient (`pt-demo`), generates session ID if omitted, and sanitizes output.
   - User and group upsert logic handles idempotent duplicate UIDs and GUIDs.
   - Boot credential diagnostics warn on truncated/missing keys without crashing.
   - Zero secrets leaked into responses.
3. Run verification commands:
   `pnpm --filter @kinesio/server build`
   `pnpm --filter @kinesio/server typecheck`
   `npx -y vitest run tests/e2e/health.test.ts tests/e2e/session.test.ts`
4. Deliver your handoff report to `handoff.md` with explicit verdict: `APPROVE` or `REQUEST_CHANGES`.

## 2026-10-03T19:07:55Z
Your working directory is: d:\TP\Hackathon\Cometchat\.agents\teamwork\teamwork_preview_reviewer_m2_2\
Read your dispatch file at: d:\TP\Hackathon\Cometchat\.agents\teamwork\teamwork_preview_reviewer_m2_2\DISPATCH.md
MANDATORY: Read ORIGINAL_REQUEST.md at: d:\TP\Hackathon\Cometchat\.agents\teamwork\ORIGINAL_REQUEST.md before starting work.

Task:
Review Milestone 2 implementation (server/src/index.ts, server/src/cometchatRest.ts, server/package.json, server/tsconfig.json) against ORIGINAL_REQUEST.md § R2 and PROJECT.md § Interface Contracts.
Verify build/typechecks and tests (pnpm --filter @kinesio/server build, pnpm --filter @kinesio/server typecheck, npx vitest run tests/e2e/health.test.ts tests/e2e/session.test.ts).
Deliver handoff.md with explicit verdict: APPROVE or REQUEST_CHANGES.
