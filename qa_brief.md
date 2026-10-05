# KinesioLive Pre-Submission Defect Audit Brief

> **Purpose:** Grounded defect and security audit of the finished KinesioLive monorepo before demo recording.
> **Scope:** Read-only analysis of production code + new tests written into `qa/` only.

---

## 0. Canonical Living Documents (Append-First Protocol)

This brief operates on two canonical living documents. Every finding — no matter how minor — must be written into them **immediately when discovered**, not batched at the end.

| Finding Type | Write to |
|---|---|
| Any runtime defect, logic error, or test failure | **`docs/bugs.md`** — append a new row to the incident log table |
| Any security gap, architecture risk, or performance observation | **`docs/audit.md`** — append under the relevant section |
| Summary index of all findings this session | **`qa/REPORT.md`** — one-line entry per finding, linking back to the canonical doc |

### Append Protocol for `docs/bugs.md`
The last logged bug is **BUG-008**. The next bug is **BUG-009**.
When you find a defect, append a new table row **immediately** in this exact format:

```markdown
| **BUG-009** | <Critical/High/Medium/Low> | <Component> | <What is wrong, one sentence> | <Root cause — where and why invalid state originates> | <Minimal fix description — do NOT apply it> | **ACTIVE** |
```

Increment the ID for each subsequent finding (BUG-010, BUG-011, …).
If you resolve a bug during this session (only possible if the fix is in `qa/` test code, not production code), change status to **RESOLVED** and add the test file that proves it.

### Append Protocol for `docs/audit.md`
Append under the most relevant existing section heading (`## 1`, `## 2`, or `## 3`).
Use this format:

```markdown
### 🔍 Audit Finding [DATE YYYY-MM-DD] — <Short Title>
- **Check:** <Which milestone check triggered this, e.g. M1-B>
- **Observation:** <Exact description. File and line number if applicable.>
- **Severity:** <P0 demo-blocker / P1 functional defect / P2 edge-case / P3 documentation>
- **Recommendation:** <What should be done. Do NOT apply it — describe it only.>
```

If no issues are found in a check, do NOT append anything to these docs. Silence is correct for passing checks.

---

## 1. Hard Rules

1. **Production code is frozen.** Do NOT edit any file under `client/src/`, `server/src/`, `shared/src/`, or `docs/`. Exception: you MAY append new rows to `docs/bugs.md` and `docs/audit.md` — that is the entire point of this audit.
2. **PowerShell 5.1 only.** Use `;` between commands. Never use `&&` or `||`.
3. **Do not touch `.env`.** Never print `.env` to stdout. Never call live CometChat REST endpoints that create or delete users/groups/tokens.
4. **Do not edit `COMETCHAT_INTEGRATION.md`.** It contains 24 historically logged MCP calls that are referenced publicly in the submission.
5. **CometChat surfaces require skill checks.** Before auditing any CometChat code, read the skill file at the exact path listed in the check. Do not guess API signatures from memory or `node_modules`.
6. **No fabricated evidence.** Every finding appended to `docs/bugs.md` must include: (a) exact file and line number, (b) exact mechanism of failure, (c) either a failing shell command output or a path to a new failing test in `qa/` that can be run with `pnpm vitest run qa/<testfile>`.

---

## 2. Milestone M1 — Ground Truth Baseline

Run these two commands first. Record results in `qa/PROGRESS.md` under `## Baseline`.

```powershell
pnpm exec tsc --noEmit
pnpm vitest run
```

**Expected:** tsc exit 0, 28 test files, 445 tests passing.

- If baseline matches: proceed to M2.
- If baseline does NOT match: append the deviation to `docs/bugs.md` as a new `BUG-009` entry (or next available ID). Then proceed — do NOT abort.

---

## 3. Milestone M2 — CometChat Security & Contract Audit

**Persona:** CometChat Protocol Architect

**Skill files to read before starting M2 (exact paths — read them in this order):**
1. `d:\TP\Hackathon\Cometchat\.agents\skills\cometchat-security\SKILL.md`
2. `d:\TP\Hackathon\Cometchat\.agents\skills\cometchat-audit\SKILL.md`
3. `d:\TP\Hackathon\Cometchat\.agents\skills\cometchat-js-v5-sdk\SKILL.md`

### M2-A: Token Boundary — No Key Exposure
- Inspect `server/src/cometchatRest.ts`. Confirm `COMETCHAT_REST_API_KEY` and `COMETCHAT_AUTH_KEY` are read from `process.env` only and are NEVER written into any JSON response body or sent to the client in any form.
- Inspect `client/src/views/Patient.tsx` and `client/src/views/Clinician.tsx`. Confirm neither file imports or references these env vars directly.
- Run: `pnpm vitest run tests/e2e/security.test.ts`
- Run: `pnpm vitest run tests/e2e/bundle_audit.test.ts` (if `client/dist/` exists; skip and note if not)
- **If any check fails:** Append to `docs/audit.md` Section 1 AND `docs/bugs.md`.

### M2-B: Calls v5 Event Teardown — No Listener Leaks
- Read `client/src/views/Patient.tsx`. Find the `useEffect` cleanup. Confirm it:
  1. Cancels the `requestVideoFrameCallback` loop (abort flag or ref set).
  2. Calls `CometChat.removeMessageListener(...)`.
  3. Ends or leaves the Calls v5 session (e.g. `CometChatCalls.endSession()`).
- Repeat for `client/src/views/Clinician.tsx`.
- Document exact line numbers in `qa/PROGRESS.md`.
- **If any teardown step is missing:** Append to `docs/audit.md` Section 3 AND `docs/bugs.md` (severity: High — listener leaks cause stale message delivery after session end).

### M2-C: 10 Hz Rate Cap Correctness
- Read `client/src/spikes/s2-transient/rateCap.ts`.
- Verify the token bucket (a) refills at exactly 10 tokens/second, (b) never grants more than the bucket max in a single frame burst, (c) is deterministic across calls.
- Run: `pnpm vitest run tests/challenger_telemetry_stress.test.ts`
- **If any check fails:** Append to `docs/audit.md` Section 2 AND `docs/bugs.md`.

### M2-D: Session Guard Role Isolation
- Read `client/src/utils/sessionGuard.ts`.
- Confirm `checkSessionGuard` returns a structured conflict object WITHOUT calling `CometChat.logout()`.
- Run: `pnpm vitest run tests/sessionGuard.test.ts tests/sessionGuardAdversarial.test.ts`
- **If any check fails:** Append to `docs/bugs.md` (severity: High — calling logout() would destroy the active session of the other role in the same browser profile).

---

## 4. Milestone M3 — Biomechanics Engine Boundary Audit

**Persona:** Staff Biomechanics Specialist

**Source files:** `client/src/engine/geometry.ts`, `client/src/engine/smoothing.ts`, `client/src/engine/repCounter.ts`

**Fixture files (real recorded MediaPipe landmarks — do NOT generate synthetic data):**
- `tests/fixtures/squats/normal_squat_5reps.json`
- `tests/fixtures/squats/valgus_squat.json`
- `tests/fixtures/squats/shallow_squat.json`
- `tests/fixtures/squats/occluded_jitter.json`
- `tests/fixtures/squats/fast_squat.json`

### M3-A: Denominator Safety (Valgus Calculation)
- In `geometry.ts`, locate the valgus deviation function.
- Confirm the denominator is the **calibrated standing baseline** `L_standing` — a constant stored at session start — and NOT the instantaneous `(y_ankle - y_hip)` measured at runtime.
- If the denominator is a runtime measurement: this is **P0 (demo blocker)**. At squat depth, the instantaneous distance halves, doubling the reported valgus percentage for the same knee position. Append immediately to `docs/bugs.md` and `docs/audit.md` Section 2.

### M3-B: Visibility Gate
- In `repCounter.ts`, confirm that any landmark with `visibility < 0.65` causes phase to transition to `"lost"` rather than continuing calculation.
- Run: `pnpm vitest run tests/repCounterAdversarial.test.ts`
- **If test fails or gate is absent from source:** Append to `docs/bugs.md`.

### M3-C: Polarity Assertion
- In `geometry.ts`, confirm left leg polarity is `−1` and right leg is `+1`, ensuring medial inward collapse always produces a positive deviation value.
- Write a minimal new test at `qa/geometry_polarity.test.ts` that loads 2 frames from `tests/fixtures/squats/valgus_squat.json` and asserts:
  - Left-leg medial collapse → positive deviation.
  - Right-leg medial collapse → positive deviation.
- Run: `pnpm vitest run qa/geometry_polarity.test.ts`
- **If test fails:** Append to `docs/bugs.md` (severity: High — incorrect polarity means left knee valgus would register as negative, not triggering the alert).

### M3-D: Full Engine Suite
- Run: `pnpm vitest run tests/geometry.test.ts tests/smoothing.test.ts tests/repCounter.test.ts tests/repCounterAdversarial.test.ts tests/challenger_d3_1.test.ts`
- Record pass/fail count in `qa/PROGRESS.md`.
- **If any test fails:** Append to `docs/bugs.md`.

---

## 5. Milestone M4 — SRE Production Readiness

**Persona:** Production & WebRTC SRE Veteran

### M4-A: Health Endpoint
- Run: `pnpm vitest run tests/e2e/health.test.ts`
- **If fails:** Append to `docs/audit.md` Section 3 AND `docs/bugs.md`.

### M4-B: Session & Scenario API
- Run: `pnpm vitest run tests/e2e/session.test.ts tests/e2e/scenarios.test.ts tests/e2e/interactions.test.ts`
- **If fails:** Append to `docs/bugs.md`.

### M4-C: Single-Origin Architecture
- Read `server/src/index.ts`. Confirm Express serves both `/api/*` routes AND `dist/` static files from a single process. Note the exact line where static middleware is mounted.
- Confirm `GET /api/health` does NOT crash the process when `.env` values are absent — it must return a 503 JSON response, not throw an unhandled exception.
- If either condition fails: Append to `docs/audit.md` Section 3 AND `docs/bugs.md`.

### M4-D: Static Secret Scan
- Run this PowerShell command:
  ```powershell
  Select-String -Path "client\dist\assets\*.js" -Pattern "AUTH_KEY|REST_API_KEY|apiKey:" -SimpleMatch 2>$null
  ```
  If `client\dist\` does not exist: note "dist not built — scan skipped" in `qa/PROGRESS.md`.
- **If any match is found:** This is **P0 (critical)**. Append immediately to `docs/audit.md` Section 1 AND `docs/bugs.md`.

---

## 6. Progress Tracking & Multi-Account Continuity

After completing each milestone, update `qa/PROGRESS.md` in this exact format:

```markdown
# KinesioLive QA Progress

## Baseline
- tsc exit code: <0 or N>
- vitest: <N tests, M files>

## Milestones
- [x] M1: Ground Truth Baseline — <date, time>
- [x] M2: CometChat Security & Contract Audit — <date, time>
- [ ] M3: Biomechanics Engine Boundary Audit
- [ ] M4: SRE Production Readiness

## Current State
- Last completed step: <exact check ID, e.g. M2-C>
- Next step: <exact check ID, e.g. M2-D>
- Findings logged this session: <list of BUG-IDs or "none">
- Blockers / partial writes: <none or description>
```

**On account switch:** Read `qa/PROGRESS.md` first. Do NOT re-run completed milestones. Resume from "Next step". The canonical findings are in `docs/bugs.md` and `docs/audit.md` — do NOT re-summarize them, just continue.

---

## 7. Final `qa/REPORT.md` Format

After all milestones complete, write a summary-only index. Do NOT duplicate finding details — they are already in the canonical docs.

```markdown
# KinesioLive QA Audit — Summary Index

**Session completed:** <datetime>
**Baseline:** 445 tests / 28 files / tsc exit 0

## Findings This Session

| Bug ID | Severity | Check | One-line summary | Canonical location |
|---|---|---|---|---|
| BUG-009 | High | M2-B | Missing teardown for X listener | docs/bugs.md row BUG-009 |

## Checks With No Findings
- M2-A: Token boundary — PASS
- M3-D: Full engine suite — 445/445 PASS
- ...

## Next Actions
- [ ] <Only list items that are P0 or P1 requiring a code fix before recording>
```
