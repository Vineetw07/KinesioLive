# Phase 5 Technical Investigation & Ground Truth Analysis Report
**Explorer 1: Server, Deployment, & Smoketest Ground Truth**
**Date:** 2026-10-04  
**Working Directory:** `d:/TP/Hackathon/Cometchat/.agents/teamwork/explorer_1`

---

## Executive Summary
This report establishes the ground-truth technical baseline for **Phase 5 (D6.1–D7.4)** of KinesioLive, covering the single-origin Express server routing, Render cloud deployment specification, native Node 22 smoketest execution, Vite dev-vs-prod mechanics, and R7 micro-interaction polish invariants.

All findings have been validated by inspecting the source files, testing runtime commands, and inspecting directory outputs.

---

## 1. `server/src/index.ts` Static File Serving & Routing Topology

### 1.1 Existing Imports and Environment Setup (Lines 6–20)
Inspection of `server/src/index.ts` confirms:
- **Line 8:** `import express, { type Express, type Request, type Response, type NextFunction } from 'express';`
- **Line 10:** `import path from 'node:path';`
- **Line 11:** `import { fileURLToPath } from 'node:url';`
- **Line 16:** `const __filename = fileURLToPath(import.meta.url);`
- **Line 17:** `const __dirname = path.dirname(__filename);`
- **Line 18:** `dotenv.config({ path: path.resolve(__dirname, '../../.env') });`
- **Line 19:** `dotenv.config();`

**Finding:** `path`, `fileURLToPath`, and `__dirname` are **already declared and initialized**. Furthermore, TypeScript interfaces `Request` and `Response` are **already imported** from `'express'`.  
**Constraint:** Implementers must **NOT** add redundant import statements or re-declare `__dirname` or `path`.

### 1.2 Route Registration Order & Exact Insertion Point (Lines 42–85)
- **Lines 42–49:** `app.get('/api/health', (req: Request, res: Response) => { ... });`
- **Lines 56–76:** `app.post('/api/session', async (req: Request, res: Response) => { ... });`
- **Line 76:** Closing `});` of `app.post('/api/session')`.
- **Line 78:** `const PORT = Number(process.env.PORT) || 5000;`
- **Lines 80–82:** `export const server: Server = app.listen(PORT, () => { ... });`

**Exact Insertion Location:** Line 77 (immediately after line 76 and before line 78).

**Exact Insertion Code:**
```typescript
// Serve compiled React SPA — must come AFTER all /api routes
const distPath = path.resolve(__dirname, '../../client/dist');
app.use(express.static(distPath));

// SPA fallback: non-API routes return index.html (client-side routing)
app.get('*', (_req: Request, res: Response) => {
  res.sendFile(path.join(distPath, 'index.html'));
});
```

### 1.3 Path Resolution Verification
- When built, `tsc` emits the server to `server/dist/index.js`.
- At runtime:
  - `__filename` = `<repo_root>/server/dist/index.js`
  - `__dirname` = `<repo_root>/server/dist`
  - `path.resolve(__dirname, '../../client/dist')` navigates up two levels (`server/dist` -> `server` -> `<repo_root>`) and enters `client/dist`.
- When run via `tsx watch src/index.ts` during local dev:
  - `__dirname` = `<repo_root>/server/src`
  - Navigating up two levels (`server/src` -> `server` -> `<repo_root>`) resolves to the exact same path: `<repo_root>/client/dist`.
- **Verification:** Both runtime and development modes resolve deterministically to `client/dist`.

### 1.4 Route Collision & Precedence Guarantee
- Express processes route handlers in order of registration.
- Because `/api/health` and `/api/session` are registered above line 77, all API calls match their specific handlers first.
- Only non-matching requests fall through to `app.use(express.static(distPath))` and subsequently to the wildcard `app.get('*')`.
- Hence, the SPA wildcard fallback cannot shadow or intercept `/api/health` or `/api/session`.

---

## 2. Package Scripts, Workspace Builds, and Smoketest Runtime

### 2.1 Monorepo Package Scripts
- **Root `package.json`:**
  - `"build": "pnpm -r run build"`
  - `"typecheck": "pnpm -r run typecheck"`
  - `"test": "vitest run"`
  - `devDependencies`: `typescript` (^5.7.3), `vitest` (^3.2.7).
  - **Notice:** `tsx` is **not** present in root `package.json`.
- **`server/package.json`:**
  - `"dev": "tsx watch src/index.ts"`
  - `"build": "tsc"`
  - `"start": "node dist/index.js"`
  - `"typecheck": "tsc --noEmit"`
  - `devDependencies`: contains `"tsx": "^4.19.3"`.
- **`client/package.json`:**
  - `"build": "tsc -b && vite build"`
  - Output target: `client/dist/` (contains `index.html` and `assets/`).
- **`shared/package.json`:**
  - `"build": "tsc"`
  - Output target: `shared/dist/`.

### 2.2 Workspace Build Flow (`pnpm -r run build`)
`pnpm-workspace.yaml` links `shared`, `server`, and `client`.
When `pnpm -r run build` executes, pnpm resolves the workspace dependency graph topologically:
1. `@kinesio/shared` is built first (`shared/dist/`).
2. `@kinesio/server` builds second (`server/dist/`).
3. `@kinesio/client` builds third (`client/dist/`).
Result: `client/dist/` and `server/dist/` are fully compiled and ready for single-origin execution.

### 2.3 Typecheck Command Discipline
- Running `pnpm run typecheck` invokes `pnpm -r run typecheck`.
  - Verified result: **Exit code 0** across all 3 workspace packages (`shared`, `client`, `server`).
- Running bare root `tsc --noEmit` fails because root `tsconfig.json` lacks project references and JSX compiler options.
- **Rule:** Typecheck verification must be performed via `pnpm run typecheck` or `pnpm -r run typecheck`.

### 2.4 Why `--experimental-strip-types` for `smoketest_deployed.ts`
- Root `package.json` does not include `tsx`. Installing `tsx` at the monorepo root would violate the anti-bloat invariant ("The Ladder of Necessity: reach for standard library and platform primitives first").
- The target environment is Node 22 (local environment is Node `v22.19.0`, Render uses Node 22).
- Node 22 natively supports TypeScript type stripping via the `--experimental-strip-types` flag:
  `node --experimental-strip-types tests/e2e/smoketest_deployed.ts`
- `tests/e2e/smoketest_deployed.ts` relies exclusively on native Node 22 features (`fetch` and `process`), requiring zero npm packages.
- Root `package.json` script to add:
  ```json
  "smoketest": "node --experimental-strip-types tests/e2e/smoketest_deployed.ts"
  ```

---

## 3. `client/vite.config.ts` Dev Proxy vs. Production Architecture

### 3.1 Current Configuration
```typescript
export default defineConfig({
  plugins: [react()],
  define: {
    global: 'window',
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
});
```

### 3.2 Dev vs. Production Behavior
- **Development (`pnpm run dev`):**
  Vite runs a local dev server at `http://localhost:5173`. Any client HTTP requests to `/api/*` are proxied to `http://localhost:5000`.
- **Production (`node server/dist/index.js`):**
  Vite is **not** used at runtime. Instead, Express serves the static production build files from `client/dist/` directly on the main server port (5000 locally, 10000 on Render).
  Because both the HTML/JS application and the `/api/*` endpoints share the exact same host and port, the browser issues same-origin requests (`/api/session`).
- **Conclusion:** No modifications are required in `client/vite.config.ts`.

---

## 4. Render Deployment Architecture & `render.yaml`

### 4.1 Specification
File to create at repo root: `render.yaml`:
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

### 4.2 Port & Environment Alignments
- **Port Handling:**
  - Render dynamically injects `PORT=10000` into Node web service environments.
  - In `server/src/index.ts`: `const PORT = Number(process.env.PORT) || 5000;`.
  - When deployed on Render, `process.env.PORT` parses to `10000`, binding Express to Render's required port.
  - When run locally without `PORT`, it safely defaults to `5000`.
- **Build Command Rationale:**
  - Render's native Node 22 environment ships with `npm`, but not `pnpm`.
  - Prepending `npm install -g pnpm@9` guarantees `pnpm` is available globally in the build container.
  - `--frozen-lockfile` ensures deterministic dependency installation matching `pnpm-lock.yaml`.
- **Credential Security Invariant:**
  - All four CometChat variables (`COMETCHAT_APP_ID`, `COMETCHAT_REGION`, `COMETCHAT_AUTH_KEY`, `COMETCHAT_REST_API_KEY`) declare `sync: false`.
  - Zero sensitive values or keys are written to `render.yaml`. Credentials will be configured through Render's dashboard.

---

## 5. Micro-Interaction Polish (R7) Ground Truth Survey

| Target Check | File | Search Pattern | Current State | Required Modification |
|---|---|---|---|---|
| **Check 1: Rep Badge Pop** | `client/src/views/Patient.tsx` | `scale: [1.35` | **Absent** (currently `initial={{ scale: 0.8 }} animate={{ scale: 1 }}` at lines 916-921) | Update `<motion.span>` wrapping `repCount` to use `key={repCount}`, `animate={{ scale: [1.35, 1] }}`, and `transition={springPresets.snappy}`. |
| **Check 2: Focus Rings** | `client/src/index.css` | `:focus-visible` | **Absent** (verified via grep) | Add `:focus-visible` block at EOF using `var(--accent-lime)` and `var(--radius-control)`. |
| **Check 3: Valgus Alert Pulse** | `client/src/views/Clinician.tsx` | `repeat: Infinity` | **Absent** (currently lines 417-422 have static opacity animation) | Add `animate={isValgusAlert ? { opacity: [1, 0.65, 1] } : { opacity: 1 }}` and `transition={isValgusAlert ? { repeat: Infinity, duration: 1.2, ease: 'easeInOut' } : {}}`. |

---

## 6. Bundle Secret Audit & Git Commit Readiness

### 6.1 `specHarness.ts` Reuse for Bundle Audit
- `tests/e2e/helpers/specHarness.ts` already exports `scanDirectoryForSecrets(dirPath, forbiddenPattern)`.
- It scans `.js` files recursively while ignoring `node_modules` and `.git`.
- In `tests/e2e/bundle_audit.test.ts`:
  - Point to `path.join(CLIENT_DIR, 'dist', 'assets')`.
  - Wrap in `describe.skipIf(!existsSync(distAssetsPath))`.
  - Verify absence of `COMETCHAT_AUTH_KEY`, `COMETCHAT_REST_API_KEY`, and header pattern `apikey:`.

### 6.2 Git Initial Commit State
- Current git status: **0 commits**.
- `.gitignore` ignores `.env`, `.env.*` (while keeping `!.env.example`), and `dist/`, `node_modules/`.
- Staging and committing will include only source code, documentation, and configuration files, with zero leaked secrets.

---

## 7. Next Steps for Implementer
1. Update `server/src/index.ts` with static serving and SPA wildcard at line 77.
2. Create `render.yaml` at repo root.
3. Create `tests/e2e/smoketest_deployed.ts` and add `"smoketest"` script to root `package.json`.
4. Create `tests/e2e/bundle_audit.test.ts` reusing `scanDirectoryForSecrets`.
5. Apply R7 micro-interaction polish to `Patient.tsx`, `Clinician.tsx`, and `index.css`.
6. Create `README.md` and `docs/demo_preflight.md`.
7. Verify all gates (`vitest`, `typecheck`, local server build and smoke).
8. Stage files, inspect diff to ensure `.env` and `dist/` are omitted, and perform first commit.
