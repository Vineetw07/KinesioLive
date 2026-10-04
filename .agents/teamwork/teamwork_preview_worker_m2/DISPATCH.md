# Dispatch to teamwork_preview_worker_m2

## Identity & Role
You are `teamwork_preview_worker_m2`, implementing Milestone 2: Express Backend & CometChat REST Token Service (@kinesio/server).
Working directory: `d:\TP\Hackathon\Cometchat\.agents\teamwork\teamwork_preview_worker_m2\`
Parent: Project Orchestrator (`9487c73c-a518-4671-9239-e3fe46a74968`)

## MANDATORY INTEGRITY WARNING
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## Inputs (Read First)
1. `ORIGINAL_REQUEST.md`: `d:\TP\Hackathon\Cometchat\.agents\teamwork\ORIGINAL_REQUEST.md` (MANDATORY TO READ FIRST)
2. `PROJECT.md`: `d:\TP\Hackathon\Cometchat\PROJECT.md`
3. Spec Miner Survey 2 Report: `d:\TP\Hackathon\Cometchat\.agents\teamwork\teamwork_preview_spec_miner_survey_2\handoff.md`
4. E2E Test Suite: `d:\TP\Hackathon\Cometchat\tests\e2e\` and `d:\TP\Hackathon\Cometchat\TEST_READY.md`

## Exclusive Write Ownership
You own and must create/modify files ONLY in `server/`:
- `d:\TP\Hackathon\Cometchat\server\package.json`
- `d:\TP\Hackathon\Cometchat\server\tsconfig.json`
- `d:\TP\Hackathon\Cometchat\server\src\index.ts`
- `d:\TP\Hackathon\Cometchat\server\src\cometchatRest.ts`
- (and any server helper files inside `server/src/`)

DO NOT touch `client/` or modify `shared/src/index.ts`.

## Requirements (per ORIGINAL_REQUEST.md § R2 & TRD § 4)
1. `server/package.json`:
   - Name: `@kinesio/server`
   - Dependencies: `@kinesio/shared: workspace:*`, `express@^4.21.2`, `cors@^2.8.5`, `dotenv@^16.4.7`
   - DevDependencies: `tsx@^4.19.3`, `typescript@^5.7.3`, `@types/express@^5.0.0`, `@types/cors@^2.8.17`, `@types/node@^22.x`
   - Scripts:
     - `"dev": "tsx watch src/index.ts"`
     - `"build": "tsc"`
     - `"start": "node dist/index.js"`
     - `"typecheck": "tsc --noEmit"`
2. `server/tsconfig.json`:
   - Target: `ES2022`, module: `NodeNext`, moduleResolution: `NodeNext`, strict: true, outDir: `./dist`.
3. Boot Credential Diagnostics:
   - On boot, inspect `COMETCHAT_APP_ID`, `COMETCHAT_REGION`, `COMETCHAT_REST_API_KEY`, `COMETCHAT_AUTH_KEY` from root `.env` (use `dotenv.config({ path: path.resolve(__dirname, '../../.env') })` or process.cwd()).
   - If keys are missing or end with `...`, log a user-friendly diagnostic warning (e.g. `[WARN] COMETCHAT_AUTH_KEY appears truncated with '...'. Full key needed for production token minting`).
   - Do NOT crash on boot when keys are truncated; keep server alive so `GET /api/health` functions.
4. Routes:
   - `GET /api/health`: Returns HTTP 200 `{ status: "ok", uptime: process.uptime(), timestamp: Date.now() }`.
   - `POST /api/session`:
     1. Accepts `SessionRequest` (`{ role: "clinician" | "patient", sessionId?: string }`). Validates role (returns HTTP 400 if missing or invalid).
     2. Generates session ID `kine-<timestamp>` if not provided.
     3. Maps role: `clinician` -> `dr-demo` (Dr. Demo), `patient` -> `pt-demo` (Patient Demo).
     4. User Upsert: Calls CometChat REST `POST https://${appId}.api-${region}.cometchat.io/v3/users` with header `apikey: <key>` and body `{ uid, name, role: "default" }` (or omit role). Catch HTTP 400 (duplicate UID) as idempotent success.
     5. Group Upsert: Calls CometChat REST `POST https://${appId}.api-${region}.cometchat.io/v3/groups` (`guid: sessionId`, `name: "Session " + sessionId`, `type: "public"`, `members: { admins: ["dr-demo"], participants: ["pt-demo"] }`). Catch HTTP 400 (`ERR_GUID_ALREADY_EXISTS`) and ensure members added via `/v3/groups/{guid}/members`.
     6. Token Minting: Calls CometChat REST `POST https://${appId}.api-${region}.cometchat.io/v3/users/{uid}/auth_tokens` with header `apikey: process.env.COMETCHAT_REST_API_KEY || process.env.COMETCHAT_AUTH_KEY` and body `{ force: true }`.
     7. Returns sanitized `SessionResponse`: `{ sessionId, authToken, uid, appId, region }`.
     8. Handle graceful offline/development token generation if the upstream CometChat API returns 401 due to the truncated key in `.env`, logging a warning while returning a valid session structure so integration tests and local development can proceed smoothly.
5. Server Port: Default to `5000` (`process.env.PORT || 5000`).

## Verification Requirements
Run and document shell verification:
1. `pnpm install`
2. `pnpm --filter @kinesio/server build`
3. `pnpm --filter @kinesio/server typecheck`
4. Run health & session tests in `tests/e2e/health.test.ts` and `tests/e2e/session.test.ts` or via `npx -y tsx tests/e2e/run-all.ts`.

Write handoff report to `d:\TP\Hackathon\Cometchat\.agents\teamwork\teamwork_preview_worker_m2\handoff.md` and report back when finished.


## 2026-10-03T18:59:34Z
Task:
Implement Milestone 2: Express Backend & CometChat REST Token Service (@kinesio/server):
1. server/package.json, server/tsconfig.json, server/src/index.ts, server/src/cometchatRest.ts.
2. Endpoints: GET /api/health and POST /api/session (user upsert dr-demo/pt-demo, group upsert, auth token minting, sanitized SessionResponse).
3. Boot credential diagnostics: inspects .env, warns if keys missing or truncated (...).
4. Run shell verification: pnpm install, pnpm --filter @kinesio/server build, pnpm --filter @kinesio/server typecheck, test execution.
5. Write handoff.md in your working directory and notify the parent orchestrator.
