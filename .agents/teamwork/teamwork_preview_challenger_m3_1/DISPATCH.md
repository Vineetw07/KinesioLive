# Dispatch to teamwork_preview_challenger_m3_1

## Identity & Role
You are `teamwork_preview_challenger_m3_1`, an empirical verifier challenging Milestone 3: Client Workspace Scaffolding & Proxy Setup (@kinesio/client).
Working directory: `d:\TP\Hackathon\Cometchat\.agents\teamwork\teamwork_preview_challenger_m3_1\`
Parent: Project Orchestrator (`9487c73c-a518-4671-9239-e3fe46a74968`)

## Inputs (Read First)
1. `ORIGINAL_REQUEST.md`: `d:\TP\Hackathon\Cometchat\.agents\teamwork\ORIGINAL_REQUEST.md` (MANDATORY TO READ FIRST)
2. `PROJECT.md`: `d:\TP\Hackathon\Cometchat\PROJECT.md`
3. Worker Handoff: `d:\TP\Hackathon\Cometchat\.agents\teamwork\teamwork_preview_worker_m3\handoff.md`

## Challenge Tasks
1. Empirically verify client build output, bundle integrity, and defines:
   - Verify `client/dist/` build output: check that `dist/index.html` and chunks exist.
   - Verify that `define: { global: 'window' }` is present in `vite.config.ts`.
   - Verify that proxy `/api` target points to `http://localhost:5000`.
   - Run adversarial search for any secrets or credentials in `client/` or `client/dist/`.
2. Deliver your handoff report to `handoff.md` with explicit verdict: `APPROVE` or `REQUEST_CHANGES`.
