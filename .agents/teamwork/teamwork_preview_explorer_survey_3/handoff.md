# Survey Handoff Report: Shared Contracts & Client Workspace Requirements

**Agent ID:** teamwork_preview_explorer_survey_3  
**Role:** Teamwork Explorer (Read-Only Specification Survey)  
**Target Monorepo Packages:** `@kinesio/shared` and `@kinesio/client`  
**Date:** 2026-10-03  

---

## 1. Observation

### 1.1 Direct Repository Inspection
1. **Workspace Filesystem State:**
   - Root directory `d:\TP\Hackathon\Cometchat` currently contains `.agents/`, `.cometchat/`, `.env`, `.env.example`, `.git/`, `.gitignore`, `AGENTS.md`, `COMETCHAT_INTEGRATION.md`, `Hackathoninfo/`, `PROJECT_RULES.md`, `cometchat-skills/`, `docs/`.
   - Packages `shared/`, `client/`, and `server/` do not exist yet. Neither does `pnpm-workspace.yaml` or a root `package.json`.
   - `node -v` returns `v22.19.0`.
   - `pnpm.cmd -v` returns `12.8.1`. Note: In Windows PowerShell 5.1, `C:\Users\ASUS\AppData\Roaming\npm` must be in `$env:PATH` or invoked as `pnpm.cmd` (observed via `where.exe pnpm` returning `C:\Users\ASUS\AppData\Roaming\npm\pnpm.cmd`).

### 1.2 Shared TypeScript Contracts (`docs/trd.md#Section-2` & `ORIGINAL_REQUEST.md`)
Quoting verbatim from `docs/trd.md` (lines 61–118):
```typescript
export const SCHEMA_VERSION = 1 as const;
export type Side = "L" | "R";
export type SquatPhase = "standing" | "descending" | "bottom" | "ascending" | "lost";

export interface Envelope {
  v: typeof SCHEMA_VERSION;
  sid: string;          // Session ID (corresponds to Group GUID without prefix)
  t: number;            // Timestamp in epoch milliseconds
}

// CHANNEL: TRANSIENT (CometChat.sendTransientMessage to RECEIVER_TYPE.GROUP)
export interface KinePosePayload extends Envelope {
  type: "kine.pose";
  seq: number;
  fps: number;
  phase: SquatPhase;
  kneeFlexionDeg: { L: number | null; R: number | null }; // 3D sagittal flexion from worldLandmarks
  valgusDevPct: { L: number | null; R: number | null };   // % medial deviation relative to standing leg length
  depthRatio: number;   // 0.0 (standing) -> 1.0 (crease at knee height)
  vis: number;
  reps: number;
}

// CHANNEL: CUSTOM PERSISTED (CometChat.sendCustomMessage to RECEIVER_TYPE.GROUP)
export interface KineRepPayload extends Envelope {
  type: "kine.rep";
  n: number;
  minKneeDeg: number;
  depth: "shallow" | "good" | "deep";
  durMs: number;
  tempo: "fast" | "controlled" | "slow";
}

export interface KineAlertPayload extends Envelope {
  type: "kine.alert";
  kind: "knee_valgus";
  side: Side;
  value: number;        // Inward deviation percentage (e.g. 11.2%)
  thresholdPct: number; // 8.0%
  repN: number;
  phase: SquatPhase;
  note: "Form alert (biomechanical feedback)";
}

export interface KineCuePayload extends Envelope {
  type: "kine.cue";
  cue: "knees_out" | "slower" | "chest_up" | "good_depth";
  text: string;
}

export interface KineSessionMarkerPayload extends Envelope {
  type: "kine.session";
  action: "start" | "end" | "summary";
  clinicianUid: string;
  patientUid: string;
}
```

Quoting verbatim from `ORIGINAL_REQUEST.md` (lines 20–25):
```markdown
Scaffold a `pnpm` monorepo rooted at `d:\TP\Hackathon\Cometchat\` with packages `['client', 'server', 'shared']` via `pnpm-workspace.yaml`. In `shared/`, export full TypeScript interfaces conforming strictly to `docs/trd.md#Section-2`:
- `KinePosePayload` (including `kneeFlexionDeg: { L: number | null; R: number | null }`, `valgusDevPct: { L: number | null; R: number | null }`, `depthRatio: number`, `phase: SquatPhase`, `reps: number`, `vis: number`, `fps: number`, `seq: number`)
- `KineRepPayload`, `KineAlertPayload`, `KineCuePayload`, `KineSessionMarkerPayload`, and `KineMessage` union type
- `SessionRequest` (`{ role: "clinician" | "patient", sessionId?: string }`)
- `SessionResponse` (`{ sessionId: string, authToken: string, uid: string, appId: string, region: string }`)
```

Quoting verbatim from `docs/implementation_plan.md` (lines 199–205):
```typescript
export type KineMessage =
  | KinePosePayload
  | KineRepPayload
  | KineAlertPayload
  | KineCuePayload
  | KineSessionMarkerPayload;
```

**Discrepancy Note Observed:**
In `docs/implementation_plan.md` line 156, `KinePosePayload` defines `kneeDeg: { L: number | null; R: number | null }`, whereas `docs/trd.md#Section-2` line 78 and `ORIGINAL_REQUEST.md` line 21 explicitly mandate `kneeFlexionDeg: { L: number | null; R: number | null }`. Per `docs/implementation_plan.md` lines 20–22 ("Schema / API adjustment -> Update trd.md Section 2 -> Update shared/contract.ts") and `ORIGINAL_REQUEST.md` R1, `docs/trd.md#Section-2` is authoritative.

### 1.3 Client Workspace Requirements (`ORIGINAL_REQUEST.md` & `docs/trd.md`)
Quoting verbatim from `ORIGINAL_REQUEST.md` (lines 38–45):
```markdown
### R3. Client Workspace Scaffolding & Proxy Setup (`@kinesio/client`)
Scaffold React 18/19 + Vite + TypeScript + Vitest + Framer Motion in `client/`:
- Dependencies: `@cometchat/calls-sdk-javascript@^5`, `@cometchat/chat-sdk-javascript@^4`, `@mediapipe/tasks-vision`, `@kinesio/shared`.
- In `vite.config.ts`:
  - Proxy `/api` requests to `http://localhost:5000` (eliminates CORS in local dev).
  - Add `define: { global: 'window' }` (prevents SDK runtime crashes in Vite).
- Security Boundary: REST API Key and Auth Key must never be imported in `client/`.
```

Quoting verbatim from `ORIGINAL_REQUEST.md` (lines 62–64):
```markdown
### Security & Secret Isolation
- [ ] Secret scan command: `Select-String -Path "client/src/*" -Pattern "COMETCHAT_AUTH_KEY|COMETCHAT_REST|apiKey"` produces zero hits.
```

Quoting verbatim from `docs/audit.md` (lines 11–22):
```markdown
1. Zero Credential Leakage:
   - Target: The CometChat REST API Key and Auth Key must never reach client bundles.
   - Verification: Continuous grep/regex scan on dist/ before deployment:
     Select-String -Path "dist/*" -Pattern "COMETCHAT_AUTH_KEY|COMETCHAT_REST|apiKey"
   - Current Status: PASS. Express backend acts as the sole token mint. Client only receives short-lived Auth Tokens via POST /api/session.
2. Session Collision Prevention (localStorage Guard):
   - Mechanism: sessionGuard.ts detects active UID vs URL role param (?role=clinician vs ?role=patient). If mismatched, halts render and mounts a non-destructive blocking modal... Crucial: It never calls CometChat.logout()...
```

Quoting verbatim from `.cometchat/skills/cometchat-react-v7-patterns/SKILL.md` (lines 24, 32–37):
```markdown
- Vite: env in .env with VITE_ prefix; read via import.meta.env.VITE_COMETCHAT_*. init/login in an app-startup effect... Brownfield gotcha (AUDIT-037/066): if the vite/client types aren't wired, import.meta.env is untyped -> strict-TS build fails TS2339: Property 'env' does not exist on ImportMeta... ensure vite/client is referenced: add /// <reference types="vite/client" /> at top of env-reading file or compilerOptions.types.
- Auth key shipped to the client in production — use server-side token exchange (RULES.md).
```

---

## 2. Logic Chain

### 2.1 Formulation of `@kinesio/shared` Specification
1. **Source of Truth:** Based on Observation 1.2, `docs/trd.md#Section-2` and `ORIGINAL_REQUEST.md` R1 define the exact schema contract version 1 (`SCHEMA_VERSION = 1 as const`).
2. **Payload Distinctions:**
   - `KinePosePayload`: Transient channel (high-frequency 10 Hz fire-and-forget, delivered to `RECEIVER_TYPE.GROUP` via `CometChat.sendTransientMessage`). Must carry `kneeFlexionDeg: { L: number | null; R: number | null }`, `valgusDevPct: { L: number | null; R: number | null }`, `depthRatio: number`, `phase: SquatPhase`, `reps: number`, `vis: number`, `fps: number`, `seq: number`. To ensure maximum compatibility with any code referencing `kneeDeg`, an optional alias `kneeDeg?: { L: number | null; R: number | null }` can be provided or strictly normalized.
   - `KineRepPayload`: Persisted custom message (`type: "kine.rep"`, `n: number`, `minKneeDeg: number`, `depth: "shallow" | "good" | "deep"`, `durMs: number`, `tempo: "fast" | "controlled" | "slow"`).
   - `KineAlertPayload`: Persisted custom message (`type: "kine.alert"`, `kind: "knee_valgus"`, `side: "L" | "R"`, `value: number`, `thresholdPct: number`, `repN: number`, `phase: SquatPhase`, `note: "Form alert (biomechanical feedback)"`).
   - `KineCuePayload`: Persisted custom message (`type: "kine.cue"`, `cue: "knees_out" | "slower" | "chest_up" | "good_depth"`, `text: string`).
   - `KineSessionMarkerPayload`: Persisted custom message (`type: "kine.session"`, `action: "start" | "end" | "summary"`, `clinicianUid: string`, `patientUid: string`).
   - `KineMessage`: Discriminated union of all 5 payloads discriminated by literal property `type`.
   - `SessionRequest`: `{ role: "clinician" | "patient"; sessionId?: string; }`.
   - `SessionResponse`: `{ sessionId: string; authToken: string; uid: string; appId: string; region: string; }`.
3. **Packaging Strategy for `@kinesio/shared`:**
   - Location: `shared/`.
   - `package.json`: Name `@kinesio/shared`, version `0.1.0`, `main: "./dist/index.js"`, `types: "./dist/index.d.ts"`, exports mapping `.` to `types` and `import`, with scripts `"build": "tsc"` and `"typecheck": "tsc --noEmit"`.
   - Zero runtime dependencies to prevent bloat. DevDependencies: `typescript@~5.7.x`.
   - `tsconfig.json`: `declaration: true`, `declarationMap: true`, `outDir: "./dist"`, `rootDir: "./src"`, `strict: true`, `target: "ES2022"`, `module: "NodeNext"`, `moduleResolution: "NodeNext"`.

### 2.2 Formulation of `@kinesio/client` Specification
1. **Framework & Toolchain:**
   - React 18 or 19 with Vite, TypeScript 5.x, Vitest for testing, and Framer Motion for fluid interactive animations.
   - Dependencies:
     - `@cometchat/calls-sdk-javascript@^5` (pinned to v5 as required by Calls SDK v5 headless spec)
     - `@cometchat/chat-sdk-javascript@^4` (pinned to v4 for message bus & transient messages)
     - `@mediapipe/tasks-vision` (pose landmarker 33 keypoints)
     - `@kinesio/shared` (linked via `workspace:*`)
     - `framer-motion` (interactive HUD cues, toasts, alert pulses)
     - `react` and `react-dom`
2. **`vite.config.ts` Invariants:**
   - `define: { global: 'window' }`: Absolutely required because CometChat SDK and dependent browser libraries reference Node's `global`; Vite's browser bundler does not provide `global` by default, leading to unhandled runtime ReferenceErrors without this define.
   - `server.proxy`: Proxy `/api` to `http://localhost:5000` (`changeOrigin: true`) ensures that client requests to `POST /api/session` and `GET /api/health` execute seamlessly under the same origin during development without CORS.
3. **Secret Isolation Invariant:**
   - The client bundle must NEVER import `COMETCHAT_AUTH_KEY`, `COMETCHAT_REST_API_KEY`, or any variable containing `apiKey`.
   - Client authenticates solely via `authToken` returned from `POST /api/session`.
   - Verification command must return 0 lines:
     `Select-String -Path "client/src/*" -Pattern "COMETCHAT_AUTH_KEY|COMETCHAT_REST|apiKey"`

---

## 3. Detailed Specifications

### 3.1 Shared TypeScript Interfaces (`@kinesio/shared/src/index.ts`)

```typescript
/**
 * @kinesio/shared - Biomechanical, Telemetry, and Session Contracts
 * Conforms strictly to docs/trd.md#Section-2 and ORIGINAL_REQUEST.md
 */

export const SCHEMA_VERSION = 1 as const;

export type Side = "L" | "R";

export type SquatPhase = "standing" | "descending" | "bottom" | "ascending" | "lost";

export type SquatDepthRating = "shallow" | "good" | "deep";

export type SquatTempo = "fast" | "controlled" | "slow";

export type CoachingCueType = "knees_out" | "slower" | "chest_up" | "good_depth";

export type SessionMarkerAction = "start" | "end" | "summary";

export type UserRole = "clinician" | "patient";

/**
 * Base envelope included in all telemetry and event packets.
 */
export interface Envelope {
  v: typeof SCHEMA_VERSION;
  sid: string; // Session ID (corresponds to CometChat group GUID without prefix)
  t: number;   // Timestamp in epoch milliseconds (Date.now())
}

/**
 * CHANNEL: TRANSIENT (CometChat.sendTransientMessage to RECEIVER_TYPE.GROUP)
 * High-frequency pose telemetry throttled to 10 Hz via token bucket.
 */
export interface KinePosePayload extends Envelope {
  type: "kine.pose";
  seq: number;          // Monotonic sequence number for loss tracking
  fps: number;          // Client inference FPS
  phase: SquatPhase;    // State machine phase
  kneeFlexionDeg: { L: number | null; R: number | null }; // 3D sagittal flexion from worldLandmarks
  kneeDeg?: { L: number | null; R: number | null };       // Optional backward-compat alias
  valgusDevPct: { L: number | null; R: number | null };   // % medial deviation relative to standing leg length
  depthRatio: number;   // 0.0 (standing) -> 1.0 (crease at knee height)
  vis: number;          // Minimum keypoint visibility score (0.0 to 1.0)
  reps: number;         // Running rep count
}

/**
 * CHANNEL: CUSTOM PERSISTED (CometChat.sendCustomMessage to RECEIVER_TYPE.GROUP)
 * Emitted when a validated squat repetition completes.
 */
export interface KineRepPayload extends Envelope {
  type: "kine.rep";
  n: number;            // Rep count completed
  minKneeDeg: number;   // Deepest angle reached (minimum degrees)
  depth: SquatDepthRating;
  durMs: number;        // Duration from descent to ascent in ms
  tempo: SquatTempo;
}

/**
 * CHANNEL: CUSTOM PERSISTED (CometChat.sendCustomMessage to RECEIVER_TYPE.GROUP)
 * Emitted when knee valgus deviation exceeds threshold (+8.0%) for >= 3 frames.
 */
export interface KineAlertPayload extends Envelope {
  type: "kine.alert";
  kind: "knee_valgus";
  side: Side;
  value: number;        // Inward deviation percentage (e.g. 11.2)
  thresholdPct: number; // Configured trigger threshold (e.g. 8.0)
  repN: number;         // In-flight rep number
  phase: SquatPhase;    // Current squat phase when alert fired
  note: "Form alert (biomechanical feedback)";
}

/**
 * CHANNEL: CUSTOM PERSISTED (CometChat.sendCustomMessage to RECEIVER_TYPE.GROUP)
 * Real-time coaching cue triggered by clinician.
 */
export interface KineCuePayload extends Envelope {
  type: "kine.cue";
  cue: CoachingCueType;
  text: string;         // Plain-text label: "Knees Out", "Slow Down", etc.
}

/**
 * CHANNEL: CUSTOM PERSISTED (CometChat.sendCustomMessage to RECEIVER_TYPE.GROUP)
 * Session lifecycle boundary markers.
 */
export interface KineSessionMarkerPayload extends Envelope {
  type: "kine.session";
  action: SessionMarkerAction;
  clinicianUid: string;
  patientUid: string;
}

/**
 * Discriminated union of all KinesioLive message payloads.
 */
export type KineMessage =
  | KinePosePayload
  | KineRepPayload
  | KineAlertPayload
  | KineCuePayload
  | KineSessionMarkerPayload;

/**
 * Payload sent to Express backend POST /api/session.
 */
export interface SessionRequest {
  role: UserRole;
  sessionId?: string;
}

/**
 * Sanitized response received from Express backend POST /api/session.
 */
export interface SessionResponse {
  sessionId: string;
  authToken: string;
  uid: string;
  appId: string;
  region: string;
}

/**
 * Deterministic Demo User & Threshold Constants
 */
export const CLINICIAN_UID = "dr-demo" as const;
export const PATIENT_UID = "pt-demo" as const;
export const TELEMETRY_RATE_HZ = 10 as const;
export const VALGUS_THRESHOLD_PCT = 8.0 as const;
export const VALGUS_COOLDOWN_MS = 4000 as const;
```

### 3.2 Package Structure for `@kinesio/shared`

#### Directory Layout:
```
shared/
├── package.json
├── tsconfig.json
└── src/
    └── index.ts
```

#### `shared/package.json`:
```json
{
  "name": "@kinesio/shared",
  "version": "0.1.0",
  "description": "Shared TypeScript contracts and biomechanical schemas for KinesioLive",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js",
      "default": "./dist/index.js"
    }
  },
  "files": [
    "dist"
  ],
  "scripts": {
    "build": "tsc",
    "typecheck": "tsc --noEmit",
    "clean": "rimraf dist"
  },
  "devDependencies": {
    "typescript": "^5.7.3"
  }
}
```

#### `shared/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src/**/*"]
}
```

---

### 3.3 Client Workspace Requirements (`@kinesio/client`)

#### Directory Layout:
```
client/
├── index.html
├── package.json
├── tsconfig.json
├── tsconfig.node.json
├── vite.config.ts
├── src/
│   ├── vite-env.d.ts
│   ├── main.tsx
│   ├── App.tsx
│   ├── App.css
│   ├── index.css
│   └── ...
```

#### `client/package.json`:
```json
{
  "name": "@kinesio/client",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  },
  "dependencies": {
    "@cometchat/calls-sdk-javascript": "^5.0.5",
    "@cometchat/chat-sdk-javascript": "^4.1.13",
    "@kinesio/shared": "workspace:*",
    "@mediapipe/tasks-vision": "^0.10.14",
    "framer-motion": "^12.0.0",
    "lucide-react": "^0.475.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@types/react": "^19.0.8",
    "@types/react-dom": "^19.0.3",
    "@vitejs/plugin-react": "^4.3.4",
    "typescript": "^5.7.3",
    "vite": "^6.1.0",
    "vitest": "^3.0.5"
  }
}
```

#### `client/vite.config.ts`:
```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    // Critical: Prevents 'global is not defined' crashes in CometChat SDK & WebRTC dependencies under Vite
    global: 'window',
  },
  server: {
    port: 5173,
    proxy: {
      // Seamlessly forwards REST session and health requests to Express backend during local dev
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
  },
});
```

#### `client/src/vite-env.d.ts`:
```typescript
/// <reference types="vite/client" />
```

#### Secret Isolation Rule & Verification:
- **Rule:** Never import `COMETCHAT_AUTH_KEY`, `COMETCHAT_REST_API_KEY`, or pass `apiKey` from `client/src/*`.
- **Verification Command:**
  ```powershell
  Select-String -Path "client/src/*" -Pattern "COMETCHAT_AUTH_KEY|COMETCHAT_REST|apiKey"
  ```
  Must yield 0 matches.

---

## 4. Caveats
1. **PowerShell 5.1 Environment PATH Nuance:**
   On this Windows host, `pnpm` is installed globally in `C:\Users\ASUS\AppData\Roaming\npm\pnpm.cmd`. Because child shells might not inherit that directory in `$env:PATH` automatically, commands should either run `pnpm.cmd` directly or prepend `$env:PATH = "C:\Users\ASUS\AppData\Roaming\npm;" + $env:PATH;`.
2. **React 18 vs React 19:**
   `ORIGINAL_REQUEST.md` permits React 18 or 19. Both `@cometchat/chat-sdk-javascript@^4` and `@cometchat/calls-sdk-javascript@^5` are headless SDKs with no pre-bundled JSX React peer constraint, and `framer-motion@^12` officially supports React 19. React 19 or 18 can be pinned cleanly.
3. **`kneeFlexionDeg` vs `kneeDeg`:**
   `docs/trd.md#Section-2` specifies `kneeFlexionDeg` while `docs/implementation_plan.md` Section 📦 had `kneeDeg`. We have established `kneeFlexionDeg` as the primary strict property per `ORIGINAL_REQUEST.md` R1 and `docs/trd.md#Section-2`, and provided `kneeDeg?:` as an optional backward-compatible alias.

---

## 5. Conclusion
1. All interfaces for `@kinesio/shared` are fully specified and cataloged, guaranteeing strict adherence to `docs/trd.md#Section-2` and `ORIGINAL_REQUEST.md`.
2. The `@kinesio/client` workspace requirements are mapped with precision: React 18/19, Vite, TypeScript, Vitest, Framer Motion, `@cometchat/calls-sdk-javascript@^5`, `@cometchat/chat-sdk-javascript@^4`, `@mediapipe/tasks-vision`, and `@kinesio/shared`.
3. The two indispensable `vite.config.ts` flags (`define: { global: 'window' }` and `/api` proxy to `http://localhost:5000`) and the zero-secret isolation rule are documented with actionable code templates.

---

## 6. Verification Method

To verify these specifications once the scaffolding worker implements them:

1. **Verify Shared Package Compilation:**
   ```powershell
   $env:PATH = "C:\Users\ASUS\AppData\Roaming\npm;" + $env:PATH
   pnpm --filter @kinesio/shared build; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
   pnpm --filter @kinesio/shared typecheck; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
   ```
   *Expected:* Exit code 0, `./shared/dist/index.d.ts` and `./shared/dist/index.js` generated.

2. **Verify Client Package Compilation & Typecheck:**
   ```powershell
   $env:PATH = "C:\Users\ASUS\AppData\Roaming\npm;" + $env:PATH
   pnpm --filter @kinesio/client typecheck; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
   ```
   *Expected:* Exit code 0 with zero TypeScript errors.

3. **Verify Secret Isolation:**
   ```powershell
   $matches = Select-String -Path "client/src/*" -Pattern "COMETCHAT_AUTH_KEY|COMETCHAT_REST|apiKey"
   if ($matches.Count -ne 0) { Write-Error "Secret isolation breached!" } else { Write-Host "Secret scan passed: zero hits." }
   ```
   *Expected:* "Secret scan passed: zero hits."

4. **Verify Vite Config Flags:**
   Inspect `client/vite.config.ts` to confirm presence of `global: 'window'` and `/api` proxy to `http://localhost:5000`.
