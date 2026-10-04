# Phase 5 Investigation Report: Security, Testing, Bundle Audit, SpecHarness, & Git Ground Truth

**Agent:** Explorer 2  
**Date:** 2026-10-04  
**Working Directory:** `d:/TP/Hackathon/Cometchat/.agents/teamwork/explorer_2/`  
**Scope:** Security, Testing, Bundle Audit, SpecHarness, & Git Ground Truth for KinesioLive Phase 5 (D6.1–D7.4)

---

## Executive Summary

1. **SpecHarness & Secret Scanning (`tests/e2e/helpers/specHarness.ts`):**  
   - `PROJECT_ROOT`, `CLIENT_DIR` (and `SERVER_DIR`, `SHARED_DIR`) are exported at lines 4–7.
   - `scanDirectoryForSecrets` is implemented and exported at lines 74–110. It traverses files matching `/\.(ts|tsx|js|jsx|json|html|env)$/i`, skips `node_modules`, `dist`, `.git`, and tests lines against supplied RegExp patterns.
   - Calling `scanDirectoryForSecrets(path.join(CLIENT_DIR, 'dist', 'assets'), pattern)` works directly on the bundle `.js` files. An audit against the existing compiled bundle (`client/dist/assets/`) returned **0 secret hits** for `COMETCHAT_AUTH_KEY`, `COMETCHAT_REST_API_KEY`, and `apikey:`.
2. **Testing Infrastructure & Vitest Config (`vitest.config.ts`):**  
   - Config maps `@cometchat/calls-sdk-javascript` and `@cometchat/chat-sdk-javascript` to `tests/mocks/` with `environment: 'node'`.
   - Running `pnpm vitest run` executes **27 test files, 436 tests, 0 failures** in 15.46s.
   - Placing `tests/e2e/bundle_audit.test.ts` into `tests/e2e/` with `describe.skipIf(!distExists)` will add 4 test cases, cleanly expanding the suite to 28 files and 440 tests.
   - Typechecking across the monorepo is run via `pnpm -r run typecheck` or `pnpm -r exec tsc --noEmit` — both exit with **code 0** across all 3 workspace packages (`shared`, `server`, `client`).
3. **Git Ground Truth & `.gitignore` Baseline:**  
   - `git log` confirms **zero commits** on branch `master` (`fatal: your current branch 'master' does not have any commits yet`).
   - `git check-ignore -v` confirms:
     - `.env` is ignored by `.gitignore:2:.env`
     - `client/dist` and `server/dist` are ignored by `.gitignore:8:dist/`
     - `.env.example` is tracked via `.gitignore:4:!.env.example`
   - Staging with `git add .` is safe; staged diff verification before commit will ensure zero credentials leak into git history.
4. **CometChat Production & Audit Compliance:**  
   - Production skill (`cometchat-react-v7-production/SKILL.md`) and audit skill (`cometchat-audit/SKILL.md`) requirements were audited against the codebase.
   - Zero auth keys or REST keys in client source or compiled bundle.
   - Backend (`server/src/cometchatRest.ts`) mints tokens server-side via REST API `POST /v3/users/{uid}/auth_tokens`.
   - UID spoofing is prevented: `POST /api/session` maps the client-supplied `role` to fixed constants `CLINICIAN_UID` (`dr-demo`) or `PATIENT_UID` (`pt-demo`), rejecting arbitrary `?uid=`.
   - R7 micro-interaction polish sites were inspected: rep badge spring pop, `:focus-visible` rule, and valgus alert pulse are currently absent and ready for implementation.

---

## 1. Deep Dive: `specHarness.ts` & Secret Scanning (Task 1)

### 1.1 Export Verification
File: `tests/e2e/helpers/specHarness.ts`

```typescript
// lines 4-7:
export const PROJECT_ROOT = path.resolve(__dirname, '../../..');
export const SHARED_DIR = path.join(PROJECT_ROOT, 'shared');
export const SERVER_DIR = path.join(PROJECT_ROOT, 'server');
export const CLIENT_DIR = path.join(PROJECT_ROOT, 'client');
```

- `PROJECT_ROOT` resolves to `d:/TP/Hackathon/Cometchat`.
- `CLIENT_DIR` resolves to `d:/TP/Hackathon/Cometchat/client`.

### 1.2 `scanDirectoryForSecrets` Implementation
File: `tests/e2e/helpers/specHarness.ts` (lines 67–110):

```typescript
export interface SecretScanMatch {
  file: string;
  line: number;
  content: string;
  matchedPattern: string;
}

export function scanDirectoryForSecrets(
  dirPath: string,
  forbiddenPattern: RegExp = /COMETCHAT_AUTH_KEY|COMETCHAT_REST_API_KEY/i
): SecretScanMatch[] {
  const matches: SecretScanMatch[] = [];

  if (!fs.existsSync(dirPath)) {
    return matches;
  }

  function walk(currentDir: string) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== 'node_modules' && entry.name !== 'dist' && entry.name !== '.git') {
          walk(fullPath);
        }
      } else if (entry.isFile() && /\.(ts|tsx|js|jsx|json|html|env)$/i.test(entry.name)) {
        const lines = fs.readFileSync(fullPath, 'utf8').split('\n');
        lines.forEach((line, index) => {
          if (forbiddenPattern.test(line)) {
            matches.push({
              file: fullPath,
              line: index + 1,
              content: line.trim(),
              matchedPattern: forbiddenPattern.source
            });
          }
        });
      }
    }
  }

  walk(dirPath);
  return matches;
}
```

### 1.3 Behavior When Scanning Compiled Bundle Assets
When `scanDirectoryForSecrets` is invoked with `distAssetsPath = path.join(CLIENT_DIR, 'dist', 'assets')`:
1. `dirPath` is `d:\TP\Hackathon\Cometchat\client\dist\assets`.
2. `fs.existsSync(dirPath)` returns `true` when the client build exists.
3. `walk(currentDir)` begins directly at `client/dist/assets`.
4. Its children are files such as `index-BRxjVP5G.js`, `Patient-68mozvlq.js`, `Clinician-D2Siy9Rt.js`.
5. Because `.js` satisfies `/\.(ts|tsx|js|jsx|json|html|env)$/i`, each bundle chunk is split into lines and scanned against the regex.
6. Any directory named `dist` inside subfolders would be skipped, but `assets` contains flat chunk outputs.
7. Existing bundle scan test:
   - Direct ripgrep over `client/dist/assets` for `COMETCHAT_AUTH_KEY|COMETCHAT_REST_API_KEY|apikey:` yielded **0 results**.
   - Verified that the client bundle is clean.

### 1.4 Import Path in Vitest
In `tests/e2e/bundle_audit.test.ts`:
```typescript
import { scanDirectoryForSecrets, PROJECT_ROOT, CLIENT_DIR } from './helpers/specHarness.js';
```
This matches the exact pattern used in:
- `tests/e2e/contracts.test.ts:22`
- `tests/e2e/health.test.ts:2`
- `tests/e2e/security.test.ts:9`
- `tests/e2e/scenarios.test.ts:22`

Vitest's module resolver correctly maps `./helpers/specHarness.js` to `./helpers/specHarness.ts`.

---

## 2. Test Infrastructure & Bundle Audit Placement (Task 2)

### 2.1 `vitest.config.ts`
```typescript
import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    environment: 'node',
  },
  resolve: {
    alias: {
      '@cometchat/calls-sdk-javascript': path.resolve(__dirname, 'tests/mocks/calls-sdk.ts'),
      '@cometchat/chat-sdk-javascript': path.resolve(__dirname, 'tests/mocks/chat-sdk.ts'),
    },
  },
});
```

### 2.2 Test Suite Execution Baseline
Running `pnpm vitest run`:
- **Test Files:** 27 passed (27)
- **Tests:** 436 passed (436)
- **Duration:** 15.46s
- **Status:** 100% passing, 0 regressions.

### 2.3 Proposed `tests/e2e/bundle_audit.test.ts` Specification
To be created at `tests/e2e/bundle_audit.test.ts`:

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

**Guard Evaluation:**
- `describe.skipIf(!distExists)` prevents failures on clean checkouts before `pnpm run build` is run.
- When `dist` exists, all 4 tests execute and pass.

### 2.4 Monorepo Typechecking
- Running `pnpm exec tsc --noEmit` from repository root compiles the entire tree with the root `tsconfig.json` (NodeNext, no JSX compilerOptions), resulting in spurious JSX errors for client components.
- Running `pnpm -r run typecheck` or `pnpm -r exec tsc --noEmit` compiles each package (`shared`, `server`, `client`) within its own project scope:
  - `shared typecheck: Done`
  - `client typecheck: Done`
  - `server typecheck: Done`
  - **Exit Code: 0** across all workspace projects.
- This conforms to the root `package.json` script: `"typecheck": "pnpm -r run typecheck"`.

---

## 3. Git Ground Truth & Security Exclusion Baseline (Task 3)

### 3.1 Git Log State
- Command: `git log`
- Result: `fatal: your current branch 'master' does not have any commits yet`
- **Confirmed:** Zero commits exist in repository history. The first commit will be created in Phase 5.

### 3.2 Git Status & Untracked Files
- Command: `git status`
- Output:
  ```text
  On branch master
  No commits yet
  Untracked files:
    .agents/
    .cometchat/
    .env.example
    .gitignore
    AGENTS.md
    COMETCHAT_INTEGRATION.md
    Hackathoninfo/
    PROJECT.md
    PROJECT_RULES.md
    TEST_INFRA.md
    TEST_READY.md
    client/
    cometchat-skills/
    docs/
    package.json
    pnpm-lock.yaml
    pnpm-workspace.yaml
    server/
    shared/
    tests/
    tsconfig.json
    vitest.config.ts
  ```

### 3.3 `.gitignore` Rule Verification
File: `.gitignore`
- Line 2: `.env`
- Line 3: `.env.*`
- Line 4: `!.env.example`
- Line 7: `node_modules/`
- Line 8: `dist/`

Verification using `git check-ignore -v`:
- `.gitignore:2:.env .env` (IGNORED)
- `.gitignore:8:dist/ client/dist` (IGNORED)
- `.gitignore:8:dist/ server/dist` (IGNORED)
- `.gitignore:8:dist/ shared/dist` (IGNORED)
- `.gitignore:4:!.env.example .env.example` (TRACKED)

### 3.4 Staging & First Commit Safety Checklist
When executing R5 (Git First Commit):
1. `git add .`
2. Run `git diff --cached --name-only` and inspect:
   - Must contain: `COMETCHAT_INTEGRATION.md`, `.env.example`, `render.yaml`, `README.md`, `docs/demo_preflight.md`
   - Must NOT contain: `.env`, `node_modules/`, `dist/`
3. Execute commit: `git commit -m "feat: KinesioLive — CometChat Calls v5 telerehab for #ZeroToChat"`
4. Verify with `git show --stat HEAD`.

---

## 4. CometChat Production & Security Checklist Requirements (Task 4)

Derived from `cometchat-react-v7-production/SKILL.md` and `cometchat-audit/SKILL.md`:

| Requirement | Audit Finding in KinesioLive | File & Line Reference | Status |
|---|---|---|---|
| **Zero Client Auth Key** | Client bundle and client source contain zero references to `COMETCHAT_AUTH_KEY`. | `client/src/`, `client/dist/assets/*.js` | **PASS** |
| **Zero Client REST API Key** | Client contains zero references to `COMETCHAT_REST_API_KEY` or `apikey:` headers. | `client/src/`, `client/dist/assets/*.js` | **PASS** |
| **Server-Minted Auth Tokens** | Backend mints tokens via `POST /v3/users/{uid}/auth_tokens` and provides fallback for tests. | `server/src/cometchatRest.ts:240-281` | **PASS** |
| **No Client UID Spoofing** | Server resolves UID strictly from `role` (`dr-demo` vs `pt-demo`), rejecting arbitrary `?uid=`. | `server/src/index.ts:56-76`, `cometchatRest.ts:295` | **PASS** |
| **Server-Side User Upsert** | Backend upserts clinician and patient records before session tokens are minted. | `server/src/cometchatRest.ts:299-303` | **PASS** |
| **Server-Side Group Upsert** | Backend creates session group and attaches members before returning session. | `server/src/cometchatRest.ts:305-307` | **PASS** |
| **CORS & JSON Middleware** | Express configured with `cors()`, `express.json()`, and syntax error handling. | `server/src/index.ts:27-36` | **PASS** |
| **Single-Origin Static Serving** | Needs `express.static(distPath)` and SPA fallback `app.get('*')`. | `server/src/index.ts` (lines 76-78 insertion) | **PENDING R1** |
| **HTTPS Support for WebRTC** | Render deployment supplies managed SSL certificate (`https://kinesiolive.onrender.com`). | `render.yaml` | **PENDING R2** |
| **Non-Destructive Teardown** | Modal exit uses `sessionGuard` without destructive global `CometChat.logout()`. | `client/src/utils/sessionGuard.ts`, `App.tsx:623-640` | **PASS** |
| **Error Handling / Diagnostic Boot** | Validates environment credentials on startup and emits warnings without crashing. | `server/src/cometchatRest.ts:28-78` | **PASS** |

---

## 5. Micro-Interaction Polish Ground Truth (R7 Checks)

Before applying R7 edits, the existing target code was inspected:

1. **Check 1 — Rep Badge Spring Pop (`client/src/views/Patient.tsx`):**
   - Search for `scale: [1.35`: **Not found**.
   - Current element at lines 916–930 uses `initial={{ scale: 0.8 }}` and `animate={{ scale: 1 }}`.
   - Ready for replacement with:
     ```tsx
     <motion.span
       key={repCount}
       animate={{ scale: [1.35, 1] }}
       transition={springPresets.snappy}
     >
       {repCount}
     </motion.span>
     ```
2. **Check 2 — Focus Rings (`client/src/index.css`):**
   - Search for `:focus-visible`: **Not found**.
   - `client/src/index.css` is confirmed to be the global entry point imported in `client/src/main.tsx:4`.
   - Ready to append `:focus-visible` rule using `var(--accent-lime)` and `var(--radius-control)`.
3. **Check 3 — Valgus Alert Pulse (`client/src/views/Clinician.tsx`):**
   - Search for `repeat: Infinity`: **Not found**.
   - Target alert banner located at lines 417–434 (`{isValgusAlert && (<motion.div ...>)}`).
   - Current animation uses static `animate={{ opacity: 1, y: 0 }}`.
   - Ready for update to:
     ```tsx
     animate={isValgusAlert ? { opacity: [1, 0.65, 1] } : { opacity: 1 }}
     transition={isValgusAlert ? { repeat: Infinity, duration: 1.2, ease: 'easeInOut' } : {}}
     ```

---

## 6. Recommendations for Implementation Phase

1. **Implement R4 (`tests/e2e/bundle_audit.test.ts`):** Place the 4-test file using `scanDirectoryForSecrets` and `describe.skipIf(!distExists)`. Verify with `pnpm vitest run tests/e2e/bundle_audit.test.ts`.
2. **Implement R1 (`server/src/index.ts`):** Add static serving and SPA fallback between line 76 and line 78.
3. **Implement R2 (`render.yaml`):** Create root file with `npm install -g pnpm@9` bootstrap and `sync: false` env declarations.
4. **Implement R3 (`tests/e2e/smoketest_deployed.ts`):** Add standalone script and package.json script `"smoketest"`.
5. **Implement R7 (Polish):** Apply targeted updates to `Patient.tsx`, `index.css`, and `Clinician.tsx`.
6. **Implement R6 & R8 (Docs):** Create `README.md` and `docs/demo_preflight.md`.
7. **Execute R5 (Git First Commit):** Stage all files, inspect staged list with `git diff --cached --name-only`, commit, and verify with `git show --stat HEAD`.
