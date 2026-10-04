# Dispatch to teamwork_preview_worker_m3

## Identity & Role
You are `teamwork_preview_worker_m3`, implementing Milestone 3: Client Workspace Scaffolding & Proxy Setup (@kinesio/client).
Working directory: `d:\TP\Hackathon\Cometchat\.agents\teamwork\teamwork_preview_worker_m3\`
Parent: Project Orchestrator (`9487c73c-a518-4671-9239-e3fe46a74968`)

## MANDATORY INTEGRITY WARNING
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## Inputs (Read First)
1. `ORIGINAL_REQUEST.md`: `d:\TP\Hackathon\Cometchat\.agents\teamwork\ORIGINAL_REQUEST.md` (MANDATORY TO READ FIRST)
2. `PROJECT.md`: `d:\TP\Hackathon\Cometchat\PROJECT.md`
3. Explorer Survey 3 Report: `d:\TP\Hackathon\Cometchat\.agents\teamwork\teamwork_preview_explorer_survey_3\handoff.md`
4. E2E Test Suite: `d:\TP\Hackathon\Cometchat\tests\e2e\` and `d:\TP\Hackathon\Cometchat\TEST_READY.md`

## Exclusive Write Ownership
You own and must create/modify files ONLY in `client/`:
- `d:\TP\Hackathon\Cometchat\client\package.json`
- `d:\TP\Hackathon\Cometchat\client\tsconfig.json`
- `d:\TP\Hackathon\Cometchat\client\tsconfig.node.json`
- `d:\TP\Hackathon\Cometchat\client\vite.config.ts`
- `d:\TP\Hackathon\Cometchat\client\index.html`
- `d:\TP\Hackathon\Cometchat\client\src\vite-env.d.ts`
- `d:\TP\Hackathon\Cometchat\client\src\main.tsx`
- `d:\TP\Hackathon\Cometchat\client\src\App.tsx`
- `d:\TP\Hackathon\Cometchat\client\src\index.css`

DO NOT touch `server/` or `shared/`.

## Requirements (per ORIGINAL_REQUEST.md § R3 & Acceptance Criteria)
1. `client/package.json`:
   - Name: `@kinesio/client`
   - Version: `0.1.0`
   - Private: `true`
   - Type: `"module"`
   - Scripts:
     - `"dev": "vite"`
     - `"build": "tsc -b && vite build"`
     - `"preview": "vite preview"`
     - `"typecheck": "tsc --noEmit"`
     - `"test": "vitest run"`
   - Dependencies:
     - `@cometchat/calls-sdk-javascript`: `^5.0.5`
     - `@cometchat/chat-sdk-javascript`: `^4.1.13`
     - `@kinesio/shared`: `"workspace:*"`
     - `@mediapipe/tasks-vision`: `^0.10.14`
     - `framer-motion`: `^11.18.2` or `^12.0.0`
     - `react`: `^18.3.1` or `^19.0.0`
     - `react-dom`: `^18.3.1` or `^19.0.0`
   - DevDependencies:
     - `@types/react`: `^18.3.18` or `^19.0.8`
     - `@types/react-dom`: `^18.3.5` or `^19.0.3`
     - `@vitejs/plugin-react`: `^4.3.4`
     - `typescript`: `^5.7.3`
     - `vite`: `^6.1.0`
     - `vitest`: `^3.0.5`
2. `client/vite.config.ts`:
   - Must include `define: { global: 'window' }` (prevents SDK crashes under Vite).
   - Must include `server.proxy`:
     ```typescript
     server: {
       port: 5173,
       proxy: {
         '/api': {
           target: 'http://localhost:5000',
           changeOrigin: true,
         },
       },
     }
     ```
3. TypeScript configuration:
   - `client/tsconfig.json` and `client/tsconfig.node.json` configured properly for React + Vite.
   - `client/src/vite-env.d.ts` containing `/// <reference types="vite/client" />`.
4. Security Boundary (CRITICAL):
   - Never import `COMETCHAT_AUTH_KEY`, `COMETCHAT_REST`, `COMETCHAT_REST_API_KEY`, or reference `apiKey` in `client/src/*`.
   - `Select-String -Path "client/src/*" -Pattern "COMETCHAT_AUTH_KEY|COMETCHAT_REST|apiKey"` MUST produce ZERO hits.
5. Client Code:
   - Clean, lightweight React setup in `client/src/main.tsx` and `client/src/App.tsx`.
   - `client/index.html` with root div `#root`.

## Verification Requirements
Run and document shell verification:
1. `pnpm install`
2. `pnpm --filter @kinesio/client build` (or typecheck) exits with code 0.
3. `pnpm --filter @kinesio/client typecheck` exits with code 0.
4. Secret scan:
   `Select-String -Path "client/src/*" -Pattern "COMETCHAT_AUTH_KEY|COMETCHAT_REST|apiKey"` -> produces ZERO hits.
5. Full E2E test suite:
   `npx -y vitest run tests/e2e/` -> all tests pass (code 0).

Write handoff report to `d:\TP\Hackathon\Cometchat\.agents\teamwork\teamwork_preview_worker_m3\handoff.md` and report back when finished.


## 2026-10-03T19:15:51Z
Your working directory is: d:\TP\Hackathon\Cometchat\.agents\teamwork\teamwork_preview_worker_m3\
Read your dispatch file at: d:\TP\Hackathon\Cometchat\.agents\teamwork\teamwork_preview_worker_m3\DISPATCH.md
MANDATORY: Read ORIGINAL_REQUEST.md at: d:\TP\Hackathon\Cometchat\.agents\teamwork\ORIGINAL_REQUEST.md before starting work.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Task:
Implement Milestone 3: Client Workspace Scaffolding & Proxy Setup (@kinesio/client):
1. Create client/package.json, client/tsconfig.json, client/tsconfig.node.json, client/vite.config.ts, client/index.html, client/src/vite-env.d.ts, client/src/main.tsx, client/src/App.tsx, client/src/index.css.
2. In vite.config.ts: define: { global: 'window' } and proxy /api to http://localhost:5000.
3. Dependencies: @cometchat/calls-sdk-javascript@^5, @cometchat/chat-sdk-javascript@^4, @mediapipe/tasks-vision, @kinesio/shared (workspace:*), framer-motion, react, react-dom, vitest.
4. Secret isolation: ensure zero occurrences of COMETCHAT_AUTH_KEY, COMETCHAT_REST, or apiKey in client/src/*.
5. Run shell verification: pnpm install, pnpm --filter @kinesio/client build, pnpm --filter @kinesio/client typecheck, secret scan, e2e test suite.
6. Write handoff.md in your working directory and notify the parent orchestrator.
