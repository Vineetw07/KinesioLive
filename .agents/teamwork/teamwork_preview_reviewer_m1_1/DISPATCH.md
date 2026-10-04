# Dispatch to teamwork_preview_reviewer_m1_1

## Identity & Role
You are `teamwork_preview_reviewer_m1_1`, an independent reviewer evaluating Milestone 1: Monorepo Root & Shared Contract (@kinesio/shared).
Working directory: `d:\TP\Hackathon\Cometchat\.agents\teamwork\teamwork_preview_reviewer_m1_1\`
Parent: Project Orchestrator (`9487c73c-a518-4671-9239-e3fe46a74968`)

## Inputs (Read First)
1. `ORIGINAL_REQUEST.md`: `d:\TP\Hackathon\Cometchat\.agents\teamwork\ORIGINAL_REQUEST.md` (MANDATORY TO READ FIRST)
2. `PROJECT.md`: `d:\TP\Hackathon\Cometchat\PROJECT.md`
3. Worker Handoff: `d:\TP\Hackathon\Cometchat\.agents\teamwork\teamwork_preview_worker_m1\handoff.md`

## Review Tasks
1. Verify correctness, completeness, and interface conformance of:
   - `package.json`, `pnpm-workspace.yaml`, `tsconfig.json`
   - `shared/package.json`, `shared/tsconfig.json`, `shared/src/index.ts`
   against `PROJECT.md § Interface Contracts` and `ORIGINAL_REQUEST.md`.
2. Run build and typecheck verification:
   `pnpm install`
   `pnpm --filter @kinesio/shared build`
   `pnpm --filter @kinesio/shared typecheck`
3. Check for any missing types or broken exports.
4. Deliver your handoff report to `handoff.md` with explicit verdict: `APPROVE` or `REQUEST_CHANGES`.

## 2026-10-03T18:49:27Z
Your working directory is: d:\TP\Hackathon\Cometchat\.agents\teamwork\teamwork_preview_reviewer_m1_1\
Read your dispatch file at: d:\TP\Hackathon\Cometchat\.agents\teamwork\teamwork_preview_reviewer_m1_1\DISPATCH.md
MANDATORY: Read ORIGINAL_REQUEST.md at: d:\TP\Hackathon\Cometchat\.agents\teamwork\ORIGINAL_REQUEST.md before starting work.

Task:
Review Milestone 1 implementation (@kinesio/shared and monorepo root) against PROJECT.md § Interface Contracts and ORIGINAL_REQUEST.md.
Run builds and typechecks (pnpm install, pnpm --filter @kinesio/shared build, pnpm --filter @kinesio/shared typecheck).
Deliver handoff.md with explicit verdict: APPROVE or REQUEST_CHANGES.
