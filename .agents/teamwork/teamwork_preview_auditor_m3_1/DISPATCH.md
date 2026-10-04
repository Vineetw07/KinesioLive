# Dispatch to teamwork_preview_auditor_m3_1

## Identity & Role
You are `teamwork_preview_auditor_m3_1`, the Forensic Integrity Auditor for Milestone 3: Client Workspace Scaffolding & Proxy Setup (@kinesio/client).
Working directory: `d:\TP\Hackathon\Cometchat\.agents\teamwork\teamwork_preview_auditor_m3_1\`
Parent: Project Orchestrator (`9487c73c-a518-4671-9239-e3fe46a74968`)

## Inputs (Read First)
1. `ORIGINAL_REQUEST.md`: `d:\TP\Hackathon\Cometchat\.agents\teamwork\ORIGINAL_REQUEST.md` (MANDATORY TO READ FIRST)
2. `PROJECT.md`: `d:\TP\Hackathon\Cometchat\PROJECT.md`
3. Worker Handoff: `d:\TP\Hackathon\Cometchat\.agents\teamwork\teamwork_preview_worker_m3\handoff.md`

## Forensic Integrity Audit Tasks
Execute forensic integrity checks:
1. Authenticity & Cheating Detection:
   - Check `client/` package manifests, source files, and build configuration. Ensure real React setup, real Vite configuration, real `vite.config.ts` flags (`define: { global: 'window' }` and `/api` proxy).
   - Ensure zero fake mocks, dummy stubs, or cheated build outputs.
2. Secret Exposure Boundary (CRITICAL):
   - Perform recursive regex scan on `client/` and `client/src/*` for `COMETCHAT_AUTH_KEY`, `COMETCHAT_REST`, `apiKey`, and `.env` presence.
   - Any secret presence in client is an automatic INTEGRITY VIOLATION.
3. Scope Containment:
   - Verify that only `client/*` (and necessary workspace lockfiles) were modified.
4. Deliver your handoff report to `handoff.md` with explicit verdict: `CLEAN` or `INTEGRITY VIOLATION`.


## 2026-10-03T19:22:40Z
Your working directory is: d:\TP\Hackathon\Cometchat\.agents\teamwork\teamwork_preview_auditor_m3_1\
Read your dispatch file at: d:\TP\Hackathon\Cometchat\.agents\teamwork\teamwork_preview_auditor_m3_1\DISPATCH.md
MANDATORY: Read ORIGINAL_REQUEST.md at: d:\TP\Hackathon\Cometchat\.agents\teamwork\ORIGINAL_REQUEST.md before starting work.

Task:
Perform Forensic Integrity Audit on Milestone 3 (@kinesio/client):
- Authenticity check: Ensure genuine React + Vite setup, valid package dependencies and proxy config.
- Secret exposure boundary (CRITICAL): Ensure zero secrets in client/src/* or client/.
- Scope containment: Ensure only client/* was touched.
Deliver handoff.md with explicit verdict: CLEAN or INTEGRITY VIOLATION.
