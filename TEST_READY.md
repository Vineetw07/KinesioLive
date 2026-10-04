# TEST_READY — Dual Track E2E Test Suite

**Published By:** `teamwork_preview_test_writer_e2e`  
**Status:** READY / FULLY VERIFIED (Exit Code 0)  
**Date:** 2026-10-03  
**Project:** KinesioLive Tele-Rehabilitation Engine  
**Authoritative Specifications:** `ORIGINAL_REQUEST.md`, `PROJECT.md`, `TEST_INFRA.md`, `docs/trd.md`

---

## 1. Quick Start & Test Runner Commands

The test suite can be executed via either Vitest or the standalone Dual Track test runner:

### Primary Command (Vitest Suite Runner)
```powershell
npx -y vitest run tests/e2e/
```
*Expected output: 6 test files passed, 92 tests passed, exit code 0.*

### Comprehensive Dual Track Runner (with Coverage Breakdown)
```powershell
npx -y tsx tests/e2e/run-all.ts
```
*Expected output: Full 4-Tier matrix table, 92 tests executed, exit code 0.*

### Individual Suite Execution
```powershell
npx -y vitest run tests/e2e/contracts.test.ts
npx -y vitest run tests/e2e/health.test.ts
npx -y vitest run tests/e2e/session.test.ts
npx -y vitest run tests/e2e/security.test.ts
npx -y vitest run tests/e2e/interactions.test.ts
npx -y vitest run tests/e2e/scenarios.test.ts
```

---

## 2. Test Architecture: Dual Track Design

The test suite implements a **Dual Track** methodology that guarantees **Progressive Testability** at any stage of milestone implementation:

- **Track A (Specification & Contract Conformance):**  
  Directly evaluates filesystem structures, package manifests, TypeScript declarations, secret isolation, diagnostic rules, and specification reference request handlers without requiring external background daemons to be online.
- **Track B (Live Network Integration):**  
  Automatically probes `http://localhost:5000/api/health`. When the Express backend is online, seamlessly switches to live HTTP dispatching over the network, validating real endpoints, headers, status codes, and CometChat REST token flows.

---

## 3. Tier & Feature Coverage Matrix

| Feature | Scope / Requirement | Tier 1 (Primary) | Tier 2 (Boundary) | Total Feature Tests |
|---|---|:---:|:---:|:---:|
| **F1** | Workspace Linking & Package Exports (`ORIGINAL_REQUEST §R1`) | 5 | 5 | 10 |
| **F2** | Shared Biomechanical Schemas & Types (`ORIGINAL_REQUEST §R1`) | 6 | 5 | 11 |
| **F3** | Server Health Probe `/api/health` (`ORIGINAL_REQUEST §R2`) | 5 | 5 | 10 |
| **F4** | Session Token Minting `/api/session` (`ORIGINAL_REQUEST §R2`) | 5 | 5 | 10 |
| **F5** | Deterministic User/Role Mapping (`dr-demo`, `pt-demo`) | 5 | 5 | 10 |
| **F6** | Boot Credential Validation & Diagnostics (`ORIGINAL_REQUEST §R2.7`)| 5 | 5 | 10 |
| **F7** | Client Vite Proxy & Global Define (`ORIGINAL_REQUEST §R3`) | 5 | 5 | 10 |
| **F8** | Secret Isolation Boundary (`client/src/*` zero secrets) | 5 | 5 | 10 |
| **T3** | Cross-Feature Interactions (Pairwise combinations) | — | — | 6 |
| **T4** | Real-World Workload Scenarios (5 Realistic Scenarios) | — | — | 5 |
| **TOTAL** | **Full Suite Test Count** | **41** | **40** | **92** |

---

## 4. Test Suite Inventory

### 1. `tests/e2e/contracts.test.ts` (21 Tests)
- **Features Exercised:** F1 (Workspace Linking & Package Exports), F2 (Shared Biomechanical Schemas & Types)
- **Key Assertions:**
  - `pnpm-workspace.yaml` package linking for `shared`, `server`, and `client`.
  - Root `package.json` scripts (`build`, `typecheck`, `test`).
  - `@kinesio/shared/package.json` ESM exports and declaration paths.
  - Root `tsconfig.json` NodeNext compiler options and strict settings.
  - Presence and validity of compiled artifacts in `shared/dist/index.js` and `shared/dist/index.d.ts`.
  - Constants: `SCHEMA_VERSION === 1`, `CLINICIAN_UID === "dr-demo"`, `PATIENT_UID === "pt-demo"`, `TELEMETRY_RATE_HZ === 10`, `VALGUS_THRESHOLD_PCT === 8.0`, `VALGUS_COOLDOWN_MS === 4000`.
  - Envelope verification (`v`, `sid`, `t`).
  - `KinePosePayload` schema validation with `kneeFlexionDeg`, `valgusDevPct`, `depthRatio`, `phase`, `reps`.
  - `KineMessage` discriminated union covering `kine.rep`, `kine.alert`, `kine.cue`, `kine.session`.
  - Boundary: Bilateral nulls for occluded pose keypoints (`{ L: null, R: null }`).
  - Boundary: Negative valgus percentage for varus deviation.
  - Boundary: Extreme depth ratio ratings (`0.0`, `1.0`, `1.25`).
  - Boundary: Squat phase enum states (`standing`, `descending`, `bottom`, `ascending`, `lost`).

### 2. `tests/e2e/health.test.ts` (10 Tests)
- **Features Exercised:** F3 (Server Health Probe)
- **Key Assertions:**
  - HTTP 200 with status `"ok"`.
  - Non-negative finite numeric `uptime`.
  - Epoch timestamp in milliseconds aligned with current time (> 1704067200000).
  - Strict response payload shape containing exactly `{ status, uptime, timestamp }`.
  - Idempotency across sequential requests.
  - Monotonic non-decreasing uptime under successive polling.
  - Robustness against arbitrary query parameters and headers.
  - Response `Content-Type: application/json`.
  - High-frequency burst resilience.

### 3. `tests/e2e/session.test.ts` (20 Tests)
- **Features Exercised:** F4 (Session Token Minting), F5 (Deterministic User/Role Mapping)
- **Key Assertions:**
  - HTTP 200 and complete `SessionResponse` payload (`sessionId`, `authToken`, `uid`, `appId`, `region`).
  - Non-empty `authToken`, `appId`, and `region`.
  - Deterministic clinician mapping: `{ role: "clinician" }` -> `uid: "dr-demo"`.
  - Deterministic patient mapping: `{ role: "patient" }` -> `uid: "pt-demo"`.
  - Strict isolation: Clinician never receives `pt-demo`; Patient never receives `dr-demo`.
  - Zero credential leakage in response (no `apiKey` or `restApiKey` fields).
  - Boundary: Omitted `sessionId` auto-generates with `kine-` prefix.
  - Boundary: Explicit `sessionId` (e.g. `kine-rehab-station-alpha-42`) preserved verbatim.
  - Boundary: Empty string and whitespace-only `sessionId` trigger auto-generation with `kine-` prefix.
  - Boundary: Extraneous unexpected fields in request body do not corrupt output.
  - Boundary: Invalid roles (`"admin"`, `"doctor"`, empty string) rejected with HTTP 400 Bad Request.
  - Boundary: Missing role or non-object request bodies rejected with HTTP 400 Bad Request.

### 4. `tests/e2e/security.test.ts` (30 Tests)
- **Features Exercised:** F6 (Boot Credential Diagnostics), F7 (Client Vite Proxy & Define), F8 (Secret Isolation)
- **Key Assertions:**
  - Detection of `COMETCHAT_APP_ID`, `COMETCHAT_REGION`, and `COMETCHAT_AUTH_KEY` / `COMETCHAT_REST_API_KEY`.
  - Truncated key detection: Strings ending in `...` flagged with diagnostic warning recommending full dashboard key.
  - Full valid 32+ char hex keys without ellipsis pass without warnings.
  - Empty, undefined, or whitespace keys flagged with specific diagnostic notices.
  - Client package specification checks (`@cometchat/calls-sdk-javascript@^5`, `@cometchat/chat-sdk-javascript@^4`, `@mediapipe/tasks-vision`, `@kinesio/shared`).
  - Vite configuration verification (`proxy: { '/api': { target: 'http://localhost:5000' } }`, `define: { global: 'window' }`).
  - Secret scan: 0 occurrences of `COMETCHAT_AUTH_KEY` or `COMETCHAT_REST_API_KEY` across `client/src/`.
  - Secret scan: Absence of `.env` inside `client/`.
  - Root `.gitignore` explicitly includes `.env`.
  - Adversarial scanner verification: Confirmed that synthetic leak injected into temp directory is reliably flagged.

### 5. `tests/e2e/interactions.test.ts` (6 Tests)
- **Features Exercised:** Tier 3 Cross-Feature Interactions
- **Key Assertions:**
  - Clinician creates session -> Patient joins with identical `sessionId` -> Matching `sessionId`, distinct UIDs (`dr-demo` vs `pt-demo`), matching `appId`/`region`.
  - Telemetry envelope constructed with session response `sessionId` validates against `KinePosePayload` schema.
  - Concurrent execution of Health probe and Session token minting without race conditions or deadlock.
  - Resiliency: Diagnostic warning emitted for truncated key while session generation endpoint remains operational.
  - 1:1 route alignment between Vite client proxy (`/api`) and Express server endpoints (`/api/health`, `/api/session`).
  - Session marker payload synchronizes with clinician and patient demo UIDs.

### 6. `tests/e2e/scenarios.test.ts` (5 Tests)
- **Features Exercised:** Tier 4 Real-World Application Workloads
- **Key Scenarios:**
  - **Scenario 1 (Clinician Session Initialization):** Clinician verifies health, requests session, receives `dr-demo` token, validates `kine-` group GUID format.
  - **Scenario 2 (Patient Joins Existing Session):** Patient joins with clinician's invite session ID, verifies `pt-demo` token and identical group GUID.
  - **Scenario 3 (Security & Secret Isolation Invariant):** Complete workspace and artifact audit ensuring zero secret leakage and `.gitignore` safety.
  - **Scenario 4 (MediaPipe Pose Stream Simulation):** 30 consecutive frames at 10 Hz simulating squat descent, knee valgus spike (`11.2% > 8.0%`) triggering form alert, rep completion (`KineRepPayload`), and coaching cue toast (`KineCuePayload`).
  - **Scenario 5 (High-Concurrency Session Burst):** 10 concurrent requests (5 clinicians, 5 patients with custom rooms) proving idempotency, unique session generation, and zero cross-talk.

---

## 5. Verification Evidence

Executed in Windows PowerShell 5.1:
```powershell
pnpm exec vitest run tests/e2e/
# or
npx -y tsx tests/e2e/run-all.ts
```
Result: **92 passed (92), 0 failed, Exit Code 0**.
