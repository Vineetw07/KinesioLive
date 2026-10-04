# Dispatch Assignment — Worker Polish & Bundle Audit

## Mission
Implement Testing Hardening (R4 Bundle Secret Audit) and Micro-Interaction Polish (R7).
Exclusively owned files:
- `tests/e2e/bundle_audit.test.ts`
- `client/src/views/Patient.tsx`
- `client/src/views/Clinician.tsx`
- `client/src/index.css`

## Mandatory Integrity Warning
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## Working Directory
`d:/TP/Hackathon/Cometchat/.agents/teamwork/worker_polish/`

## Requirements
1. R4: Create `tests/e2e/bundle_audit.test.ts` with the exact code specified in `ORIGINAL_REQUEST.md:206-241`:
   - Import `scanDirectoryForSecrets`, `PROJECT_ROOT`, `CLIENT_DIR` from `./helpers/specHarness.js` (reuse, do not re-implement).
   - Use `describe.skipIf(!distExists)('Bundle Secret Audit — client/dist/assets/*.js', () => { ... })`.
   - Implement the 4 specified test cases.
2. R7: Micro-Interaction Polish:
   - Check 1: In `client/src/views/Patient.tsx`, update repCount display at lines 916–930:
     Change key to `key={repCount}` and animate to `animate={{ scale: [1.35, 1] }}` with `transition={springPresets.snappy}`.
   - Check 2: In `client/src/index.css`, append:
     ```css
     :focus-visible {
       outline: 2px solid var(--accent-lime);
       outline-offset: 2px;
       border-radius: var(--radius-control);
     }
     ```
     Ensure zero new raw hex values.
   - Check 3: In `client/src/views/Clinician.tsx`, update `isValgusAlert` alert banner at lines 417–423 to include:
     `animate={isValgusAlert ? { opacity: [1, 0.65, 1], y: 0 } : { opacity: 1, y: 0 }}`
     `transition={isValgusAlert ? { repeat: Infinity, duration: 1.2, ease: 'easeInOut' } : {}}`
3. Verification:
   - Run `pnpm run typecheck` (`pnpm -r run typecheck`) → must pass with exit code 0.
   - Run `pnpm vitest run` → must pass all suites, including `bundle_audit.test.ts` (total tests ≥ 440, 0 failures).
4. Produce report in `d:/TP/Hackathon/Cometchat/.agents/teamwork/worker_polish/handoff.md` and message orchestrator when done.

## 2026-10-04T10:33:32Z
Received dispatch from 953cfeaa-2ed0-4ae2-8194-9c90c8580fcf:
You are Worker Polish for Phase 5 of KinesioLive.
Working Directory: d:/TP/Hackathon/Cometchat/.agents/teamwork/worker_polish/
Tasks:
1. R4: Create tests/e2e/bundle_audit.test.ts using exact code from ORIGINAL_REQUEST.md:206-241. Reuse scanDirectoryForSecrets from ./helpers/specHarness.js.
2. R7: Apply Micro-Interaction Polish: Patient.tsx repCount key and scale animation; index.css :focus-visible; Clinician.tsx isValgusAlert animation.
3. Verification: pnpm run typecheck, pnpm vitest run.
4. Handoff report in d:/TP/Hackathon/Cometchat/.agents/teamwork/worker_polish/handoff.md and message orchestrator.
