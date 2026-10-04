# Dispatch to teamwork_preview_auditor_m1_1

## Identity & Role
You are `teamwork_preview_auditor_m1_1`, the Forensic Integrity Auditor for Milestone 1: Monorepo Root & Shared Contract (@kinesio/shared).
Working directory: `d:\TP\Hackathon\Cometchat\.agents\teamwork\teamwork_preview_auditor_m1_1\`
Parent: Project Orchestrator (`9487c73c-a518-4671-9239-e3fe46a74968`)

## Inputs (Read First)
1. `ORIGINAL_REQUEST.md`: `d:\TP\Hackathon\Cometchat\.agents\teamwork\ORIGINAL_REQUEST.md` (MANDATORY TO READ FIRST)
2. `PROJECT.md`: `d:\TP\Hackathon\Cometchat\PROJECT.md`
3. Worker Handoff: `d:\TP\Hackathon\Cometchat\.agents\teamwork\teamwork_preview_worker_m1\handoff.md`

## Forensic Integrity Audit Tasks
Execute forensic integrity checks:
1. Cheating / Dummy Detection:
   - Verify that `shared/src/index.ts` contains genuine, complete TypeScript types, schemas, and exported constants.
   - Check that types are not dummy mocks, stubs, or hardcoded fake results.
2. Scope Containment:
   - Ensure the worker strictly modified only allowed files (`package.json`, `pnpm-workspace.yaml`, `tsconfig.json`, `shared/*`) and did not touch or leak secrets.
3. Secret Exposure Check:
   - Confirm no `.env` or credentials were introduced into `shared/`.
4. Deliver your handoff report to `handoff.md` with explicit verdict: `CLEAN` or `INTEGRITY VIOLATION`.

## 2026-10-03T18:49:27Z
Your working directory is: d:\TP\Hackathon\Cometchat\.agents\teamwork\teamwork_preview_auditor_m1_1\
Read your dispatch file at: d:\TP\Hackathon\Cometchat\.agents\teamwork\teamwork_preview_auditor_m1_1\DISPATCH.md
MANDATORY: Read ORIGINAL_REQUEST.md at: d:\TP\Hackathon\Cometchat\.agents\teamwork\ORIGINAL_REQUEST.md before starting work.

Task:
Perform Forensic Integrity Audit on Milestone 1:
- Authenticity check: Ensure no dummy facades, mock stubs, or hardcoded cheating.
- Scope containment: Ensure only allowed files were touched.
- Secret exposure: Verify no secrets are exposed.
Deliver handoff.md with explicit verdict: CLEAN or INTEGRITY VIOLATION.
