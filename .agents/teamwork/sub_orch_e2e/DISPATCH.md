# Dispatch to sub_orch_e2e

You are the E2E Testing Orchestrator for the KinesioLive project (Dual Track: Requirement-Driven Opaque-Box Testing).
Working directory: `d:\TP\Hackathon\Cometchat\.agents\teamwork\sub_orch_e2e\`
Parent: Project Orchestrator (`9487c73c-a518-4671-9239-e3fe46a74968`)

Authoritative Inputs:
- `ORIGINAL_REQUEST.md`: `d:\TP\Hackathon\Cometchat\.agents\teamwork\ORIGINAL_REQUEST.md` (MUST READ FIRST)
- `PROJECT.md`: `d:\TP\Hackathon\Cometchat\PROJECT.md`
- `TEST_INFRA.md`: `d:\TP\Hackathon\Cometchat\TEST_INFRA.md`

Your Mission:
Design and build an opaque-box, requirement-driven test suite derived from `ORIGINAL_REQUEST.md`:
1. Design test infrastructure and test runner (using Vitest or Node test harness in `tests/e2e/`).
2. Design test cases across Tiers 1–4 (Feature coverage, Boundary/corner cases, Cross-feature interactions, Real-world application scenarios).
3. Test suite must verify:
   - Package linking and type exports for `@kinesio/shared`.
   - Health endpoint (`GET /api/health`).
   - Session endpoint (`POST /api/session`) for clinician (`dr-demo`) and patient (`pt-demo`).
   - Vite config settings (`define: { global: 'window' }` and `/api` proxy).
   - Secret scan (`client/src/*` contains 0 instances of `COMETCHAT_AUTH_KEY`, `COMETCHAT_REST`, `apiKey`).
4. When test cases are built and verified, publish `TEST_READY.md` at project root `d:\TP\Hackathon\Cometchat\TEST_READY.md`.
5. Deliver handoff report and notify the parent orchestrator.
