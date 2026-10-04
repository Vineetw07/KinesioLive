# Phase 5 Execution Plan: Production Deploy, Repo Polish & Submission

## Overview
Phase 5 transitions KinesioLive from a verified development baseline (436 tests, clean typecheck) to a fully deployed, publication-grade hackathon submission for #ZeroToChat.

## Milestones & Work Breakdown

### Milestone 1: Technical Exploration & Ground Truth Survey
- Dispatch an Explorer (`teamwork_preview_explorer`) to:
  1. Inspect existing files: `server/src/index.ts`, `server/package.json`, root `package.json`, `tests/e2e/helpers/specHarness.ts`, `client/src/App.tsx`, `client/src/Patient.tsx`, `client/src/Clinician.tsx`, `client/src/index.css` (or global styles), `client/index.html`.
  2. Inspect git status (`git status`, `git log`).
  3. Verify exact strings for R7:
     - Check 1: `scale: [1.35` in `Patient.tsx`
     - Check 2: `:focus-visible` in CSS
     - Check 3: `repeat: Infinity` in `Clinician.tsx`
  4. Verify exact lines in `server/src/index.ts` for R1 placement (after `app.post('/api/session', ...)` and before `app.listen`).
  5. Confirm `scanDirectoryForSecrets` signature in `tests/e2e/helpers/specHarness.ts`.
  6. Produce comprehensive report in `.agents/teamwork/explorer_1/analysis.md`.

### Milestone 2: Core Server, Deployment Config & Smoketest Implementation
- Dispatch a Worker (`teamwork_preview_worker`) to:
  1. R1: Update `server/src/index.ts` with `express.static(distPath)` and SPA fallback `app.get('*')`.
  2. R2: Create `render.yaml` with zero credentials (`sync: false`) and `npm install -g pnpm@9`.
  3. R3: Create `tests/e2e/smoketest_deployed.ts` and add `"smoketest"` script to root `package.json`.
  4. Run build and verify static serving locally (`GET /` returns HTML, `GET /api/health` returns JSON).
  5. Report diffs and execution results in `.agents/teamwork/worker_deploy/handoff.md`.

### Milestone 3: Testing Hardening & Micro-Interaction Polish
- Dispatch a Worker (`teamwork_preview_worker`) to:
  1. R4: Create `tests/e2e/bundle_audit.test.ts` (reusing `scanDirectoryForSecrets` and `describe.skipIf(!distExists)`).
  2. R7: Apply Micro-Interaction Polish:
     - If `scale: [1.35` absent: wrap rep count display in `Patient.tsx` with snappy spring pop.
     - If `:focus-visible` absent: add `:focus-visible` rule with `var(--accent-lime)` to global CSS.
     - If `repeat: Infinity` absent: add pulse animation to `Clinician.tsx` valgus alert banner.
  3. Run build, run `pnpm vitest run`, and run `pnpm exec tsc --noEmit`.
  4. Report diffs and test results in `.agents/teamwork/worker_polish/handoff.md`.

### Milestone 4: Publication Docs & Pre-Flight Materials
- Dispatch a Worker (`teamwork_preview_worker`) to:
  1. R6: Create `README.md` at repo root with all 9 required sections in order (Header with shield, verbatim ASCII architecture from `docs/trd.md`, CometChat table with 5 primitives, verbatim Biomechanics Honesty Clause, local dev instructions, env vars table, live demo URL, MCP evidence referencing 24 calls in `COMETCHAT_INTEGRATION.md`, footer).
  2. R8: Create `docs/demo_preflight.md` with 5-minute pre-recording checklist, 84s timed demo pacing table (6s safety buffer), and submission tweet template.
  3. Report in `.agents/teamwork/worker_docs/handoff.md`.

### Milestone 5: Verification Triad & Forensic Audit
- Dispatch Reviewer (`teamwork_preview_reviewer`): Check completeness, correctness, code cleanliness, build/test passes, no regressions.
- Dispatch Challenger (`teamwork_preview_challenger`): Execute local smoketest against running server, verify `bundle_audit.test.ts` against compiled `dist/assets/`, test static routes and 404/SPA behavior.
- Dispatch Forensic Auditor (`teamwork_preview_auditor`):
  1. Strict credential check: Zero hardcoded secrets, no `.env` staged, no Auth Key in `render.yaml` or client bundle.
  2. Authentic implementation: No dummy facades, no tautological tests.
  3. CometChat Production & Audit skill compliance: init->login->render order, server tokens only.

### Milestone 6: Git Staging, Security Audit & First Commit
- Dispatch a Worker (`teamwork_preview_worker`) to:
  1. R5: Stage all files (`git add .`).
  2. Inspect staged files (`git diff --cached --name-only`).
  3. Assert required files present (`COMETCHAT_INTEGRATION.md`, `.env.example`, `render.yaml`, `README.md`, `docs/demo_preflight.md`) and forbidden files absent (`.env`, `node_modules/`, `dist/`).
  4. Make first commit: `feat: KinesioLive — CometChat Calls v5 telerehab for #ZeroToChat`.
  5. Verify commit with `git show --stat HEAD`.
  6. Run final gates and handoff.

### Milestone 7: Final Synthesis & Reporting
- Synthesize all subagent results.
- Record final verification status across Gates 1-5.
- Transmit completion report to Sentinel via `send_message`.
