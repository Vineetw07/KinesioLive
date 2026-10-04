# Dispatch to teamwork_preview_worker_m1

## Identity & Role
You are `teamwork_preview_worker_m1`, implementing Milestone 1: Monorepo Root & Shared Contract (@kinesio/shared).
Working directory: `d:\TP\Hackathon\Cometchat\.agents\teamwork\teamwork_preview_worker_m1\`
Parent: Project Orchestrator (`9487c73c-a518-4671-9239-e3fe46a74968`)

## MANDATORY INTEGRITY WARNING
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## Inputs (Read First)
1. `ORIGINAL_REQUEST.md`: `d:\TP\Hackathon\Cometchat\.agents\teamwork\ORIGINAL_REQUEST.md` (MANDATORY TO READ FIRST)
2. `PROJECT.md`: `d:\TP\Hackathon\Cometchat\PROJECT.md`
3. Explorer Survey 1 Report: `d:\TP\Hackathon\Cometchat\.agents\teamwork\teamwork_preview_explorer_survey_1\handoff.md`
4. Explorer Survey 3 Report: `d:\TP\Hackathon\Cometchat\.agents\teamwork\teamwork_preview_explorer_survey_3\handoff.md`

## Exclusive Write Ownership
You own and must create/modify ONLY these files:
- `d:\TP\Hackathon\Cometchat\package.json`
- `d:\TP\Hackathon\Cometchat\pnpm-workspace.yaml`
- `d:\TP\Hackathon\Cometchat\tsconfig.json`
- `d:\TP\Hackathon\Cometchat\shared/package.json`
- `d:\TP\Hackathon\Cometchat\shared/tsconfig.json`
- `d:\TP\Hackathon\Cometchat\shared/src/index.ts`

DO NOT touch `server/` or `client/` in this milestone.

## Requirements
1. Monorepo Root:
   - `pnpm-workspace.yaml`:
     ```yaml
     packages:
       - 'shared'
       - 'server'
       - 'client'
     ```
   - Root `package.json`: private workspace root with scripts:
     - `"build": "pnpm -r run build"`
     - `"typecheck": "pnpm -r run typecheck"`
     - `"test": "vitest run"`
   - Root `tsconfig.json`: base TypeScript config for workspace.
2. `@kinesio/shared`:
   - `shared/package.json`:
     - Name: `@kinesio/shared`
     - Version: `0.1.0`
     - Exports mapping `.` to `types: "./dist/index.d.ts"` and `import: "./dist/index.js"`.
     - Scripts: `"build": "tsc"`, `"typecheck": "tsc --noEmit"`.
     - devDependencies: `typescript@~5.7.x`.
   - `shared/tsconfig.json`:
     - Target: `ES2022`, module: `NodeNext`, moduleResolution: `NodeNext`, declaration: `true`, declarationMap: `true`, outDir: `./dist`, rootDir: `./src`, strict: `true`.
   - `shared/src/index.ts`:
     - Implement all interfaces, union types, and constants strictly conforming to `PROJECT.md § Interface Contracts`:
       - `SCHEMA_VERSION = 1 as const`
       - `Side`, `SquatPhase`, `SquatDepthRating`, `SquatTempo`, `CoachingCueType`, `SessionMarkerAction`, `UserRole`
       - `Envelope`
       - `KinePosePayload` (with `kneeFlexionDeg: { L: number | null; R: number | null }`, optional `kneeDeg?: { L: number | null; R: number | null }`, `valgusDevPct: { L: number | null; R: number | null }`, `depthRatio`, `phase`, `reps`, `vis`, `fps`, `seq`)
       - `KineRepPayload`, `KineAlertPayload`, `KineCuePayload`, `KineSessionMarkerPayload`, and `KineMessage` union
       - `SessionRequest`, `SessionResponse`
       - Constants: `CLINICIAN_UID`, `PATIENT_UID`, `TELEMETRY_RATE_HZ`, `VALGUS_THRESHOLD_PCT`, `VALGUS_COOLDOWN_MS`

## Verification Requirements
Run and document shell verification:
1. `pnpm install` (using Windows PowerShell syntax)
2. `pnpm --filter @kinesio/shared build`
3. `pnpm --filter @kinesio/shared typecheck`
All must exit with code 0.

Write report to `d:\TP\Hackathon\Cometchat\.agents\teamwork\teamwork_preview_worker_m1\handoff.md` and report back when finished.


## 2026-10-03T18:45:05Z
[Message] timestamp=2026-10-03T18:45:05Z sender=9487c73c-a518-4671-9239-e3fe46a74968 priority=MESSAGE_PRIORITY_HIGH content=Your working directory is: d:\TP\Hackathon\Cometchat\.agents\teamwork\teamwork_preview_worker_m1\
Read your dispatch file at: d:\TP\Hackathon\Cometchat\.agents\teamwork\teamwork_preview_worker_m1\DISPATCH.md
MANDATORY: Read ORIGINAL_REQUEST.md at: d:\TP\Hackathon\Cometchat\.agents\teamwork\ORIGINAL_REQUEST.md before starting work.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Task:
Implement Milestone 1: Monorepo Root & Shared Contract (@kinesio/shared):
1. Root manifests: package.json, pnpm-workspace.yaml, tsconfig.json.
2. @kinesio/shared: shared/package.json, shared/tsconfig.json, shared/src/index.ts implementing all contracts in PROJECT.md § Interface Contracts.
3. Run verification in PowerShell: pnpm install, pnpm --filter @kinesio/shared build, pnpm --filter @kinesio/shared typecheck.
4. Write handoff.md in your working directory and notify the parent orchestrator.
