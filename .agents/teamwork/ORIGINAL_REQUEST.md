# Original User Request

## 2026-10-04T09:53:27Z

# Teamwork Project Prompt — Phase 5 (D6.1–D7.4): Production Deploy, Repo Polish & Submission

> Status: Launched
> Working directory: d:/TP/Hackathon/Cometchat
> Integrity mode: development

Prepare KinesioLive for hackathon submission. Phase 4 (D5.1–D5.4) is complete and
verified (436 tests, clean typecheck). D5.4 wiring is confirmed done: `isSummaryView`
state in `App.tsx:62` already routes to `<Summary>` on `onEndSession` and `onLeaveSession`.
This phase covers: Render deployment, smoke test, README, bundle secret audit, repo
first commit, micro-interaction polish, and submission materials.

Video recording steps (D6.4, D7.2) are human-only. Agents prepare all pre-flight
materials but do NOT attempt to record. Do NOT mark D6.4 or D7.2 as complete.

---

## Pre-Work: Ground Truth Inspection (Required Before Any Edit)

Read each file listed. Do not assume.

| File / Path | Actual State |
|---|---|
| `render.yaml` | Does NOT exist. Must be created. |
| `README.md` | Does NOT exist at repo root. Must be created. |
| `git log` | **Zero commits.** First commit must be made as part of this phase. |
| `.gitignore` | Exists. `.env` and `dist/` already excluded. `.env.example` is tracked. |
| `server/src/index.ts` | Exists — 93 lines. Already has `fileURLToPath`/`path.dirname`/`__dirname` shim at lines 16-17. Does NOT yet call `express.static()`. |
| `server/package.json` | `"type": "module"`. `"build": "tsc"`. `"start": "node dist/index.js"`. `"tsx"` is listed here as devDependency. |
| Root `package.json` | `"build": "pnpm -r run build"`. Has NO devDependencies except `typescript` and `vitest`. No `tsx` at root. |
| `vitest.config.ts` | Exists. `environment: 'node'`. Aliases `@cometchat/chat-sdk-javascript` → `tests/mocks/chat-sdk.ts` and calls-sdk similarly. |
| `tests/e2e/helpers/specHarness.ts` | Exists — 248 lines. Exports `scanDirectoryForSecrets(dirPath, pattern)` (lines 74-110), `PROJECT_ROOT`, `CLIENT_DIR`, `dispatchHealthRequest()`, `dispatchSessionRequest()`. |
| `tests/mocks/chat-sdk.ts` | Exists — 205 lines. Full mock for `CometChat` including `MockCustomMessage`, `chatMockState`, etc. |
| `client/src/App.tsx` | Exists — 663 lines. `isSummaryView` state at line 62. `<Summary>` already rendered at lines 623-628. `onEndSession` already sets `isSummaryView(true)` at line 633. `onLeaveSession` at line 640. **D5.4 routing is already complete.** |
| `client/vite.config.ts` | Exists. Dev proxy `/api → localhost:5000`. No prod changes needed — Express serves both from same origin. |
| `.env.example` | Exists. Declares `COMETCHAT_APP_ID`, `COMETCHAT_REGION`, `COMETCHAT_AUTH_KEY`, `COMETCHAT_REST_API_KEY`. |
| `COMETCHAT_INTEGRATION.md` | Exists — 69 lines, 24 verified MCP entries. |
| `docs/frontend_architecture_spec.md` | Exists — has ASCII architecture topology in §1. |
| `docs/trd.md` | Exists — has ASCII system topology in §1, API specs in §4. |

---

## Skills to Read Before Implementing

1. **`d:/TP/Hackathon/Cometchat/.agents/skills/cometchat-react-v7-production/SKILL.md`**
   Apply its going-live checklist: server-minted tokens only, env var discipline, bundle hygiene. Verify each item is met before marking D6 done.

2. **`d:/TP/Hackathon/Cometchat/.agents/skills/cometchat-audit/SKILL.md`**
   Read-only audit. Run against the integration before deploy: init→login→render order, no client Auth Key, no raw localization keys, no dead affordances. Log findings.

---

## Requirements

### R1. Express Static File Serving — `server/src/index.ts`

The Express server does not currently serve `client/dist/`. It must do so for single-origin Render deployment.

**Exact placement:** Add the following two blocks immediately after the closing brace of the `app.post('/api/session', ...)` handler (after line 76) and **before** `app.listen(PORT, ...)` (line 80). Do NOT re-declare `__dirname`, `path`, or `fileURLToPath` — they are already imported and defined at lines 10-17.

```typescript
// Serve compiled React SPA — must come AFTER all /api routes
const distPath = path.resolve(__dirname, '../../client/dist');
app.use(express.static(distPath));

// SPA fallback: non-API routes return index.html (client-side routing)
app.get('*', (_req: Request, res: Response) => {
  res.sendFile(path.join(distPath, 'index.html'));
});
```

**Verification (run locally after `pnpm run build`):**
```powershell
node server/dist/index.js
# In another terminal:
Invoke-WebRequest -Uri "http://localhost:5000" -UseBasicParsing | Select-Object -ExpandProperty Content
# Must contain <!DOCTYPE html> or <html
Invoke-WebRequest -Uri "http://localhost:5000/api/health" -UseBasicParsing | Select-Object -ExpandProperty Content
# Must return {"status":"ok",...}
```
Both must pass — the `app.get('*')` fallback must NOT shadow `/api/health`.

### R2. Render Deployment Configuration — `render.yaml`

Create `render.yaml` at the repo root:

```yaml
services:
  - type: web
    name: kinesiolive
    env: node
    region: oregon
    buildCommand: npm install -g pnpm@9 && pnpm install --frozen-lockfile && pnpm -r run build
    startCommand: node server/dist/index.js
    envVars:
      - key: NODE_ENV
        value: production
      - key: PORT
        value: "10000"
      - key: COMETCHAT_APP_ID
        sync: false
      - key: COMETCHAT_REGION
        sync: false
      - key: COMETCHAT_AUTH_KEY
        sync: false
      - key: COMETCHAT_REST_API_KEY
        sync: false
```

**Why `npm install -g pnpm@9` first:** Render's Node 22 environment does not have pnpm pre-installed. `npm install -g pnpm@9` bootstraps it. `sync: false` means the values are set manually in the Render dashboard — they are never stored in this file.

**Security invariant:** Zero credential values in `render.yaml`. The `sync: false` entries are names only.

### R3. Deployed-URL Smoke Test Script — `tests/e2e/smoketest_deployed.ts`

Create a standalone Node script (NOT a Vitest suite). Use only `node:fetch` (native in Node 22) and `node:process` — zero external deps.

```typescript
// tests/e2e/smoketest_deployed.ts
// Run: node --experimental-strip-types tests/e2e/smoketest_deployed.ts
// Or:  DEPLOYED_URL=https://kinesiolive.onrender.com node --experimental-strip-types tests/e2e/smoketest_deployed.ts

const BASE = (process.env.DEPLOYED_URL || 'http://localhost:5000').replace(/\/$/, '');
let passed = 0;
let failed = 0;

async function check(label: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`  ✅ ${label}`);
    passed++;
  } catch (e: any) {
    console.error(`  ❌ ${label} — ${e.message}`);
    failed++;
  }
}

async function run() {
  console.log(`\nKinesioLive Smoke Test → ${BASE}\n`);

  await check('GET /api/health returns 200', async () => {
    const t0 = Date.now();
    const res = await fetch(`${BASE}/api/health`);
    const ms = Date.now() - t0;
    if (res.status !== 200) throw new Error(`HTTP ${res.status}`);
    if (ms > 5000) throw new Error(`Response took ${ms}ms (limit: 5000ms)`);
    const data = await res.json() as any;
    if (data.status !== 'ok') throw new Error(`status is "${data.status}", expected "ok"`);
  });

  await check('GET / returns HTML (SPA served)', async () => {
    const res = await fetch(`${BASE}/`);
    if (res.status !== 200) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    if (!text.includes('<!DOCTYPE html') && !text.includes('<html')) {
      throw new Error('Response does not contain HTML');
    }
  });

  await check('POST /api/session clinician returns authToken + uid=dr-demo', async () => {
    const res = await fetch(`${BASE}/api/session`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ role: 'clinician' }),
    });
    if (res.status !== 200) throw new Error(`HTTP ${res.status}`);
    const data = await res.json() as any;
    if (!data.authToken || data.authToken.length < 5) throw new Error('authToken missing or too short');
    if (data.uid !== 'dr-demo') throw new Error(`uid is "${data.uid}", expected "dr-demo"`);
  });

  await check('POST /api/session response does not leak COMETCHAT_AUTH_KEY value', async () => {
    const authKeyValue = process.env.COMETCHAT_AUTH_KEY;
    if (!authKeyValue) return; // Skip if not set in this environment
    const res = await fetch(`${BASE}/api/session`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ role: 'clinician' }),
    });
    const body = await res.text();
    if (body.includes(authKeyValue)) throw new Error('COMETCHAT_AUTH_KEY value found in response body');
  });

  console.log(`\nResult: ${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((e) => { console.error(e); process.exit(1); });
```

Add to root `package.json` scripts:
```json
"smoketest": "node --experimental-strip-types tests/e2e/smoketest_deployed.ts"
```

**Why `--experimental-strip-types` not `tsx`:** `tsx` is a devDependency of `server/` only — not at root. Node 22 natively supports TypeScript type-stripping via `--experimental-strip-types`. No extra dependency needed.

### R4. Bundle Secret Audit — `tests/e2e/bundle_audit.test.ts`

**Reuse `scanDirectoryForSecrets`** from `tests/e2e/helpers/specHarness.ts` (already exists at lines 74-110). Do NOT re-implement directory walking.

```typescript
import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { scanDirectoryForSecrets, PROJECT_ROOT, CLIENT_DIR } from './helpers/specHarness.js';

const distAssetsPath = path.join(CLIENT_DIR, 'dist', 'assets');
const distExists = existsSync(distAssetsPath);

describe.skipIf(!distExists)('Bundle Secret Audit — client/dist/assets/*.js', () => {
  it('bundle contains no literal COMETCHAT_AUTH_KEY variable name', () => {
    // Checks the variable name — always falsifiable regardless of env
    const matches = scanDirectoryForSecrets(distAssetsPath, /COMETCHAT_AUTH_KEY/);
    expect(matches).toHaveLength(0);
  });

  it('bundle contains no literal COMETCHAT_REST_API_KEY variable name', () => {
    const matches = scanDirectoryForSecrets(distAssetsPath, /COMETCHAT_REST_API_KEY/);
    expect(matches).toHaveLength(0);
  });

  it('bundle contains no "apikey:" REST header pattern', () => {
    // The REST calls use `apikey: apiKey` as a header — must never appear client-side
    const matches = scanDirectoryForSecrets(distAssetsPath, /apikey:/i);
    expect(matches).toHaveLength(0);
  });

  it('bundle contains no actual COMETCHAT_AUTH_KEY value (when available in env)', () => {
    const keyValue = process.env.COMETCHAT_AUTH_KEY;
    if (!keyValue || keyValue.endsWith('...')) return; // Skip if placeholder or unset
    const pattern = new RegExp(keyValue.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const matches = scanDirectoryForSecrets(distAssetsPath, pattern);
    expect(matches).toHaveLength(0);
  });
});
```

**Why `describe.skipIf(!distExists)`:** `client/dist/` only exists after `pnpm run build`. On clean checkout this directory is absent — `.gitignore` excludes it. The suite must not fail in CI before build runs. The three static-string checks (variable names + `apikey:`) are always falsifiable with no env vars required.

### R5. Git First Commit & Security Verification

The repo has zero commits. Execute in order and verify each step:

**Step 1 — Stage all files:**
```powershell
git -C "d:/TP/Hackathon/Cometchat" add .
```

**Step 2 — Inspect staged files BEFORE committing:**
```powershell
git -C "d:/TP/Hackathon/Cometchat" diff --cached --name-only
```

Assert the output:
- ✅ MUST contain: `COMETCHAT_INTEGRATION.md`, `.env.example`, `render.yaml`, `README.md`, `docs/demo_preflight.md`
- ❌ MUST NOT contain: `.env`, any path with `node_modules/`, any path with `dist/`

If `.env` or `dist/` appear, stop and fix `.gitignore` before proceeding.

**Step 3 — Commit:**
```powershell
git -C "d:/TP/Hackathon/Cometchat" commit -m "feat: KinesioLive — CometChat Calls v5 telerehab for #ZeroToChat"
```

**Step 4 — Verify commit:**
```powershell
git -C "d:/TP/Hackathon/Cometchat" show --stat HEAD
```
Output must list `render.yaml`, `README.md`, `COMETCHAT_INTEGRATION.md` and must NOT list `.env`.

### R6. Publication-Grade README — `README.md`

Create `README.md` at the repo root. Required sections in order:

**1. Header:**
```markdown
# KinesioLive — Real-Time Biomechanical Telerehabilitation

[![Built for #ZeroToChat](https://img.shields.io/badge/Built%20for-%23ZeroToChat-lime)](https://cometchat.com)

KinesioLive connects patients and clinicians over a live video session, streaming real-time joint kinematics at 10 Hz so the clinician can detect knee valgus deviation and send instant coaching cues — all persisted in CometChat group message history.
```

**2. Architecture diagram** — copy the ASCII topology verbatim from `docs/trd.md` §1 (lines 12-42). Do not redraw it from memory.

**3. CometChat Integration Table** — derived from `COMETCHAT_INTEGRATION.md` (do not invent):

| CometChat Primitive | How KinesioLive Uses It |
|---|---|
| Calls SDK v5 (`CometChatCalls.joinSession`) | Two-way WebRTC video between patient and clinician |
| Transient Messages (`sendTransientMessage`) | 10 Hz pose telemetry stream to clinician HUD — zero DB writes |
| Custom Messages (`sendCustomMessage`) | Persisted exercise events: `kine.rep`, `kine.alert`, `kine.cue`, `kine.session` |
| Group Message History (`MessagesRequestBuilder.fetchPrevious`) | Post-session summary — group history is the medical exercise log |
| REST Auth Token API (`POST /v3/users/{uid}/auth_tokens`) | Server-minted tokens — `COMETCHAT_AUTH_KEY` never reaches the browser |

**4. Biomechanics Honesty Clause (required — do not omit or soften):**
```markdown
> ⚠️ **Clinical Accuracy Notice:** The valgus deviation calculation uses a calibrated
> standing baseline and frontal-plane landmark projection from MediaPipe BlazePose 3D
> world landmarks. It is an estimate suitable for real-time coaching feedback during a
> hackathon demonstration. It is **not** a validated clinical measurement tool and must
> not be used for medical diagnosis.
```

**5. Local Development:**
```bash
cp .env.example .env   # Fill in your CometChat credentials from dashboard.cometchat.com
pnpm install
pnpm run build
node server/dist/index.js
# Open http://localhost:5000/?role=clinician in Profile A
# Open http://localhost:5000/?role=patient  in Profile B
```

**6. Environment Variables Table** (from `.env.example` — do not add keys not in that file):

| Variable | Purpose | Where to find |
|---|---|---|
| `COMETCHAT_APP_ID` | Your CometChat App ID | CometChat Dashboard → Apps |
| `COMETCHAT_REGION` | App region (`us`, `eu`, `in`) | CometChat Dashboard → Apps |
| `COMETCHAT_AUTH_KEY` | Dev-only auth key (not sent to browser in prod) | CometChat Dashboard → API & Auth Keys |
| `COMETCHAT_REST_API_KEY` | Server-side REST API key | CometChat Dashboard → API & Auth Keys |

**7. Live Demo:** `https://kinesiolive.onrender.com` (update after Render deploy is confirmed live)

**8. MCP Evidence:** `See [COMETCHAT_INTEGRATION.md](./COMETCHAT_INTEGRATION.md) — 24 verified MCP tool calls including list_cometchat_bundles, fetch_cometchat_doc_page, and search_cometchat_docs against the live CometChat documentation server.`

**9. Footer:** `Built with ❤️ for #ZeroToChat by @CometChat`

### R7. Micro-Interaction Polish — Targeted & Verified

Before touching any file, search for these exact strings. Only add code that is confirmed absent.

**Check 1 — Rep badge spring pop (`Patient.tsx`):**
Search `Patient.tsx` for the string `scale: [1.35`. If found: skip entirely.
If NOT found: find the rep count display element (search for `repCount` in JSX) and wrap it in:
```tsx
<motion.span
  key={repCount}
  animate={{ scale: [1.35, 1] }}
  transition={springPresets.snappy}
>
  {repCount}
</motion.span>
```
Import `motion` from `framer-motion` (already imported) and `springPresets` (already imported).

**Check 2 — Focus rings (`client/src/index.css` or global CSS file):**
Search the global CSS entry point for `:focus-visible`. If found: skip entirely.
If NOT found: Add to the end of the file:
```css
:focus-visible {
  outline: 2px solid var(--accent-lime);
  outline-offset: 2px;
  border-radius: var(--radius-control);
}
```
First read `client/src/` to find which file is the global CSS entry (check `client/index.html` for the `<link>` tag to find the correct file path).

**Check 3 — Valgus alert pulse (`Clinician.tsx`):**
Search `Clinician.tsx` for `repeat: Infinity`. If found: skip entirely.
If NOT found: find the valgus alert banner (search `isValgusAlert` in JSX). Wrap the alert container in `motion.div` and add:
```tsx
animate={isValgusAlert ? { opacity: [1, 0.65, 1] } : { opacity: 1 }}
transition={isValgusAlert ? { repeat: Infinity, duration: 1.2, ease: 'easeInOut' } : {}}
```
Zero new hardcoded colors or hex values.

### R8. Demo Pre-Flight Checklist — `docs/demo_preflight.md`

Create `docs/demo_preflight.md`:

```markdown
# KinesioLive Demo Pre-Flight Checklist

## Environment (5 minutes before recording)
- [ ] Render service is warm: `curl https://kinesiolive.onrender.com/api/health` returns `{"status":"ok",...}`
- [ ] Chrome Profile A (Patient): navigate to `https://kinesiolive.onrender.com/?role=patient`
- [ ] Chrome Profile B (Clinician): navigate to `https://kinesiolive.onrender.com/?role=clinician`
- [ ] Both profiles: camera permission granted (HTTPS from Render ensures this works)
- [ ] Clinician: click "Copy Patient Invite Link" — paste URL into Patient tab and confirm matching sessionId
- [ ] Patient: confirm skeleton canvas overlay appears and rep counter reads 0
- [ ] Clinician: confirm "Patient in Session: Active" presence indicator

## Demo Pacing (84s target — 6s safety buffer under 90s hard limit)
| Time | Screen | Action | Narration |
|---|---|---|---|
| 00:00–00:08 | IDE/Console | Show `COMETCHAT_INTEGRATION.md` with MCP tool calls visible | "Our agent verified CometChat APIs directly via the MCP..." |
| 00:08–00:18 | Split screen | Patient joins → Clinician presence flips to Active | "Secure CometChat Calls v5 session begins..." |
| 00:18–00:32 | Patient + Clinician HUD | 2 clean squats → HUD shows real-time joint angles | "10 Hz transient pose telemetry, zero DB overhead..." |
| 00:32–00:48 | Clinician HUD | Patient caves left knee → valgus alert fires "+11.2%" | "Custom message alert with measured deviation value..." |
| 00:48–01:08 | Both screens | Clinician clicks "Knees Out" → Patient sees cyan toast → corrects | "Coaching cue persisted to group history, patient corrects in real time..." |
| 01:08–01:24 | Summary view | Clinician clicks "End Session" → Summary bento renders | "Group history IS the medical log — fetched via fetchPrevious()..." |

## Submission Tweet (post immediately after upload)
```
Just built KinesioLive for #ZeroToChat with @CometChat! 🏋️

Real-time biomechanical telerehab:
→ CometChat Calls v5 WebRTC video
→ 10 Hz transient pose telemetry (no DB overhead)
→ Persisted kine.rep / kine.alert custom messages
→ 24 MCP-verified API calls in COMETCHAT_INTEGRATION.md

[VIDEO LINK] | [GITHUB LINK]

#ZeroToChat @CometChat
```
```

---

## Verification

### Gate 1 — Local build + static serve (must pass before pushing)
```powershell
pnpm run build
node server/dist/index.js
# New terminal:
Invoke-WebRequest -Uri "http://localhost:5000" -UseBasicParsing | Select-Object StatusCode, @{N='isHTML';E={$_.Content -match '<!DOCTYPE html'}}
Invoke-WebRequest -Uri "http://localhost:5000/api/health" -UseBasicParsing | Select-Object -ExpandProperty Content
```
Both must succeed: `StatusCode: 200`, `isHTML: True`, health returns `{"status":"ok",...}`.

### Gate 2 — Full test suite (no regressions)
```powershell
pnpm vitest run
```
All existing suites must pass. New `bundle_audit.test.ts` must pass or be skipped (if `client/dist/` absent). Total: ≥ 436 tests, 0 failures.

### Gate 3 — Typecheck
```powershell
pnpm exec tsc --noEmit
```
Exit code 0 across all packages.

### Gate 4 — Git security check
```powershell
git -C "d:/TP/Hackathon/Cometchat" show --stat HEAD
```
`.env` must NOT appear. `COMETCHAT_INTEGRATION.md`, `render.yaml`, `README.md` must appear.

### Gate 5 — Deployed smoke test (after Render deploy)
```powershell
$env:DEPLOYED_URL = "https://kinesiolive.onrender.com"
pnpm smoketest
# Exit code must be 0
```

---

## Acceptance Criteria

### R1 — Static File Serving
- [ ] `server/src/index.ts` contains `express.static(distPath)` after `/api/session` handler.
- [ ] `app.get('*', ...)` fallback present after `express.static`.
- [ ] `__dirname`, `path`, `fileURLToPath` NOT re-imported (already at lines 10-17).
- [ ] `GET localhost:5000` returns HTML. `GET localhost:5000/api/health` returns JSON. Both verified by shell commands.

### R2 — Render Config
- [ ] `render.yaml` exists at repo root.
- [ ] Build command starts with `npm install -g pnpm@9`.
- [ ] Start command is `node server/dist/index.js`.
- [ ] Credential env var entries use `sync: false` — zero values hardcoded.

### R3 — Smoke Test Script
- [ ] `tests/e2e/smoketest_deployed.ts` exists.
- [ ] Root `package.json` has `"smoketest": "node --experimental-strip-types tests/e2e/smoketest_deployed.ts"`.
- [ ] Running `pnpm smoketest` against `http://localhost:5000` (with server running) exits code 0.
- [ ] Zero new npm dependencies added.

### R4 — Bundle Audit
- [ ] `tests/e2e/bundle_audit.test.ts` imports `scanDirectoryForSecrets` from `./helpers/specHarness.js` (reuse, do not rewrite).
- [ ] Uses `describe.skipIf(!distExists)` guard.
- [ ] Contains 4 test cases as specified.
- [ ] Passes (or skips) with `pnpm vitest run`.

### R5 — Git Commit
- [ ] `git log --oneline` shows at least 1 commit.
- [ ] `git show --stat HEAD` does NOT include `.env`.
- [ ] `git show --stat HEAD` includes `COMETCHAT_INTEGRATION.md`, `render.yaml`, `README.md`.

### R6 — README
- [ ] All 9 sections present.
- [ ] Biomechanics Honesty Clause present verbatim.
- [ ] CometChat table covers all 5 primitives.
- [ ] Architecture diagram copied from `docs/trd.md` (not redrawn from memory).

### R7 — Polish
- [ ] Each of the 3 polish checks performed with exact string search before modifying.
- [ ] Zero raw hex codes introduced.
- [ ] `:focus-visible` rule uses `var(--accent-lime)` only.

### R8 — Pre-flight Docs
- [ ] `docs/demo_preflight.md` exists with checklist, timing table, and tweet template.

### All Gates
- [ ] `pnpm vitest run` → ≥ 436 tests, 0 failures.
- [ ] `pnpm exec tsc --noEmit` → exit code 0.
- [ ] Local static serve verified with shell commands.

---

> ⚠️ **Scope boundary:** Do NOT mark D6.4 (insurance recording) or D7.2 (final video) as complete.
> Do NOT attempt to open a browser or record video. These are human-only steps.
> Prepare all materials so the human can execute them immediately after this phase completes.
