# Dispatch Assignment — Worker Deploy

## Mission
Implement Core Server, Render Configuration & Smoketest Script (R1, R2, R3).
Exclusively owned files:
- `server/src/index.ts`
- `render.yaml`
- `tests/e2e/smoketest_deployed.ts`
- `package.json` (root)

## Mandatory Integrity Warning
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## Working Directory
`d:/TP/Hackathon/Cometchat/.agents/teamwork/worker_deploy/`

## Requirements
1. R1: Express Static File Serving in `server/src/index.ts`:
   Add after `/api/session` handler closing brace (line 76) and before `const PORT`:
   ```typescript
   // Serve compiled React SPA — must come AFTER all /api routes
   const distPath = path.resolve(__dirname, '../../client/dist');
   app.use(express.static(distPath));

   // SPA fallback: non-API routes return index.html (client-side routing)
   app.get('*', (_req: Request, res: Response) => {
     res.sendFile(path.join(distPath, 'index.html'));
   });
   ```
   Do not re-import `path`, `fileURLToPath`, `__dirname`, `Request`, or `Response`.
2. R2: Create `render.yaml` at repo root with exact configuration from `ORIGINAL_REQUEST.md:91-112`. Verify zero secrets (`sync: false`).
3. R3: Create `tests/e2e/smoketest_deployed.ts` and add `"smoketest"` script to root `package.json`.
4. Verification:
   - Run `pnpm run build`
   - Run server (`node server/dist/index.js`), test `GET /` and `GET /api/health`
   - Run `pnpm smoketest`
   - Stop server
5. Produce report in `d:/TP/Hackathon/Cometchat/.agents/teamwork/worker_deploy/handoff.md` and message orchestrator when done.


## 2026-10-04T10:11:24Z
You are Worker Deploy for Phase 5 of KinesioLive.
Working Directory: d:/TP/Hackathon/Cometchat/.agents/teamwork/worker_deploy/
Read the original request at: d:/TP/Hackathon/Cometchat/.agents/teamwork/ORIGINAL_REQUEST.md
Your assignment details are in: d:/TP/Hackathon/Cometchat/.agents/teamwork/worker_deploy/DISPATCH.md
Explorer 1 handoff is at: d:/TP/Hackathon/Cometchat/.agents/teamwork/explorer_1/handoff.md

Exclusively owned files:
- `server/src/index.ts`
- `render.yaml`
- `tests/e2e/smoketest_deployed.ts`
- `package.json` (root)

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Tasks:
1. R1: In `server/src/index.ts`, add static file serving for `client/dist/` and SPA fallback `app.get('*')` after line 76 (closing brace of `/api/session` handler) and before `const PORT`. Do NOT re-import `path`, `fileURLToPath`, `__dirname`, `Request`, or `Response`.
2. R2: Create `render.yaml` at repo root with the exact specification from `ORIGINAL_REQUEST.md:91-112`. Ensure `sync: false` for all 4 CometChat credential keys. Zero credentials in the file.
3. R3: Create `tests/e2e/smoketest_deployed.ts` with the exact specification from `ORIGINAL_REQUEST.md:122-193`. Add `"smoketest": "node --experimental-strip-types tests/e2e/smoketest_deployed.ts"` to `scripts` in root `package.json`.
4. Verification:
   - Run `pnpm -r run build`
   - Run `node server/dist/index.js` in background or manage task
   - Test in shell:
     - `Invoke-WebRequest -Uri "http://localhost:5000" -UseBasicParsing` (assert 200 and <!DOCTYPE html)
     - `Invoke-WebRequest -Uri "http://localhost:5000/api/health" -UseBasicParsing` (assert status: ok)
     - `pnpm smoketest` (against http://localhost:5000, assert 4 checks pass and exit code 0)
   - Terminate the test server.
5. Write your complete handoff report to:
`d:/TP/Hackathon/Cometchat/.agents/teamwork/worker_deploy/handoff.md`
Message the orchestrator via `send_message` when done.
