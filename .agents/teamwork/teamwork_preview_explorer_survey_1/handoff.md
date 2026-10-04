# Architectural Survey & Monorepo State Report

## 1. Observation

### 1.1 Root Directory State (`d:\TP\Hackathon\Cometchat\`)
A direct inspection via `list_dir` and PowerShell `Get-ChildItem -Force` revealed the following directory layout:

```text
d:\TP\Hackathon\Cometchat\
├── .agents/                    [Directory: Agent metadata and worktrees]
├── .cometchat/                 [Directory: CometChat skills pack and contracts]
├── .git/                       [Directory: Git repository, branch: master, 0 commits]
├── cometchat-skills/           [Directory: Read-only upstream skills reference clone]
├── docs/                       [Directory: 6 canonical lifecycle markdown documents]
│   ├── audit.md                [3,483 bytes: Security & WebRTC audit invariants]
│   ├── bugs.md                 [2,539 bytes: RCA ledger]
│   ├── implementation_plan.md  [28,495 bytes: Master roadmap & milestone breakdown]
│   ├── prd.md                  [4,283 bytes: Product requirements]
│   ├── testing.md              [4,567 bytes: Vitest matrix & smoke spec]
│   └── trd.md                  [9,692 bytes: Technical requirements & schemas]
├── Hackathoninfo/              [Directory: Hackathon assets and empty Hackathondetail.md]
├── .env                        [277 bytes: Local environment configuration]
├── .env.example                [207 bytes: Environment variable template]
├── .gitignore                  [287 bytes: Standard Node/secrets exclusions]
├── AGENTS.md                   [14,251 bytes: Autonomous agent router & RRSI protocol]
├── COMETCHAT_INTEGRATION.md    [7,955 bytes: Real MCP tool execution log]
└── PROJECT_RULES.md            [4,502 bytes: Core project invariants & skill triggers]
```

### 1.2 Missing Files in Current Root
The following required workspace manifests and source directories are **currently non-existent**:
- `package.json` — NOT present in root.
- `pnpm-workspace.yaml` — NOT present in root.
- `tsconfig.json` — NOT present in root.
- `pnpm-lock.yaml` — NOT present in root.
- `shared/` (`@kinesio/shared`) — NOT present.
- `server/` (`@kinesio/server`) — NOT present.
- `client/` (`@kinesio/client`) — NOT present.

### 1.3 Execution Environment & Tooling
- **Node.js**: `v22.19.0` (Verified via `node -v`).
- **NPM**: `11.12.1` (Verified via `npm -v`).
- **PNPM**: Originally failed with `CommandNotFoundException`. Installed globally via `npm install -g pnpm` into `C:\Users\ASUS\AppData\Roaming\npm`. Verified working: `pnpm -v` -> `12.8.1`.
- **Operating System Shell**: Windows PowerShell 5.1 (`powershell.exe`).

### 1.4 Environment Secrets Status (`.env`)
Inspection of `d:\TP\Hackathon\Cometchat\.env` revealed:
```ini
COMETCHAT_APP_ID=168428446858f07fb
COMETCHAT_REGION=IN
COMETCHAT_AUTH_KEY=1d33b8f1dc49d72eb92e20928a5cef60...
```
- Line 5 ends with literal `...` (truncated dashboard overview key).
- `COMETCHAT_REST_API_KEY` is not defined in `.env`.
- Verbatim requirement from `ORIGINAL_REQUEST.md` (R2):
  > *"Validates credentials on boot: logs user-friendly diagnostic warning if keys are missing or truncated (`...`)."*
  > *"apiKey in headers (`apikey: process.env.COMETCHAT_REST_API_KEY || process.env.COMETCHAT_AUTH_KEY`)"*

### 1.5 Contract & Schema Alignment
- `docs/trd.md#Section-2` and `ORIGINAL_REQUEST.md#R1` dictate:
  - `kneeFlexionDeg: { L: number | null; R: number | null }` (representing 3D sagittal flexion from `worldLandmarks`).
  - `valgusDevPct: { L: number | null; R: number | null }` (% medial deviation relative to standing leg length).
  - Note: `docs/implementation_plan.md` in line 156 had a drafting shorthand `kneeDeg`; the authoritative schema defined in TRD Section 2 and explicitly demanded by `ORIGINAL_REQUEST.md#R1` is `kneeFlexionDeg`.
  - Message union: `KineMessage = KinePosePayload | KineRepPayload | KineAlertPayload | KineCuePayload | KineSessionMarkerPayload`.
  - Session contracts:
    - `SessionRequest`: `{ role: "clinician" | "patient", sessionId?: string }`
    - `SessionResponse`: `{ sessionId: string, authToken: string, uid: string, appId: string, region: string }`

---

## 2. Logic Chain

1. **Monorepo Topology:**
   - Per `ORIGINAL_REQUEST.md` R1, the packages must be structured directly under the root directory as `shared/`, `server/`, and `client/` (not inside a nested `packages/` directory).
   - `pnpm-workspace.yaml` must declare:
     ```yaml
     packages:
       - 'shared'
       - 'server'
       - 'client'
     ```
2. **Root Workspace Manifests:**
   - A root `package.json` is required with `"private": true`, defining workspace-wide scripts:
     - `build`: build all workspace packages in topological order.
     - `typecheck`: typecheck all packages via `tsc --noEmit`.
     - `dev:server`: run backend via `pnpm --filter @kinesio/server dev`.
     - `dev:client`: run frontend via `pnpm --filter @kinesio/client dev`.
     - `test`: execute vitest tests in client/packages.
   - A root `tsconfig.json` is required to provide standard ES2022/NodeNext base compiler settings, composite project references, or bundler module resolution across packages.

3. **`@kinesio/shared` Specification:**
   - Folder: `d:\TP\Hackathon\Cometchat\shared\`
   - Package name: `@kinesio/shared`
   - Purpose: Zero-dependency TypeScript data models and contracts imported by both server and client.
   - Files needed:
     - `shared/package.json` (exports `.` pointing to `./src/index.ts`, `types` to `./src/index.ts`)
     - `shared/tsconfig.json`
     - `shared/src/index.ts` containing:
       - `SCHEMA_VERSION = 1 as const`
       - `Side` ("L" | "R")
       - `SquatPhase` ("standing" | "descending" | "bottom" | "ascending" | "lost")
       - `Envelope` (`v`, `sid`, `t`)
       - `KinePosePayload` (`type: "kine.pose"`, `seq`, `fps`, `phase`, `kneeFlexionDeg`, `valgusDevPct`, `depthRatio`, `vis`, `reps`)
       - `KineRepPayload` (`type: "kine.rep"`, `n`, `minKneeDeg`, `depth`, `durMs`, `tempo`)
       - `KineAlertPayload` (`type: "kine.alert"`, `kind: "knee_valgus"`, `side`, `value`, `thresholdPct`, `repN`, `phase`, `note`)
       - `KineCuePayload` (`type: "kine.cue"`, `cue`, `text`)
       - `KineSessionMarkerPayload` (`type: "kine.session"`, `action`, `clinicianUid`, `patientUid`)
       - `KineMessage` union type
       - `SessionRequest`, `SessionResponse`

4. **`@kinesio/server` Specification:**
   - Folder: `d:\TP\Hackathon\Cometchat\server\`
   - Package name: `@kinesio/server`
   - Dependencies: `@kinesio/shared: workspace:*`, `express@^4.21.2`, `cors@^2.8.5`, `dotenv@^16.4.7`
   - DevDependencies: `tsx@^4.19.3`, `typescript@^5.x`, `@types/express@^5.0.0`, `@types/cors@^2.8.17`, `@types/node@^22.x`
   - Files needed:
     - `server/package.json`
     - `server/tsconfig.json`
     - `server/src/index.ts`:
       - Loads `dotenv` pointing to root `.env`.
       - Startup diagnostics: checks `COMETCHAT_APP_ID`, `COMETCHAT_REGION`, `COMETCHAT_REST_API_KEY`, `COMETCHAT_AUTH_KEY`. If key ends with `...` or is missing, logs explicit warning without terminating process.
       - Middleware: `cors()`, `express.json()`.
       - Routes:
         - `GET /api/health` -> `{ status: "ok", uptime: process.uptime(), timestamp: Date.now() }`.
         - `POST /api/session` -> invokes CometChat REST orchestration and returns `SessionResponse`.
     - `server/src/cometchatRest.ts`:
       - Endpoints:
         - User Upsert: `POST https://{APP_ID}.api-{REGION}.cometchat.io/v3/users` (`uid`, `name`, `role`).
         - Group Upsert: `POST https://{APP_ID}.api-{REGION}.cometchat.io/v3/groups` (`guid: sessionId`, `name: "Session " + sessionId`, `type: "public"`). Adds participants (`dr-demo` & `pt-demo`) to group.
         - Token Minting: `POST https://{APP_ID}.api-{REGION}.cometchat.io/v3/users/{uid}/auth_tokens` with header `apikey: process.env.COMETCHAT_REST_API_KEY || process.env.COMETCHAT_AUTH_KEY`.

5. **`@kinesio/client` Specification:**
   - Folder: `d:\TP\Hackathon\Cometchat\client\`
   - Package name: `@kinesio/client`
   - Dependencies:
     - `@kinesio/shared: workspace:*`
     - `@cometchat/chat-sdk-javascript@^4` (`4.2.0`)
     - `@cometchat/calls-sdk-javascript@^5` (`5.0.6`)
     - `@mediapipe/tasks-vision@^0.10.21` (or latest `1.0.1`)
     - `react@^18.3.1`, `react-dom@^18.3.1`
     - `framer-motion@^11.18.2`
   - DevDependencies:
     - `vite@^6.2.0`
     - `@vitejs/plugin-react@^4.3.4`
     - `vitest@^3.0.5`
     - `typescript@^5.x`
     - `@types/react@^18.3.18`, `@types/react-dom@^18.3.5`
   - Files needed:
     - `client/package.json`
     - `client/tsconfig.json`
     - `client/vite.config.ts`:
       - `server.proxy`: `{ '/api': { target: 'http://localhost:5000', changeOrigin: true } }`
       - `define`: `{ global: 'window' }` (Mandatory to prevent Calls SDK runtime failure in Vite)
     - `client/index.html`
     - `client/src/main.tsx`
     - `client/src/App.tsx`
     - `client/src/vite-env.d.ts`

6. **Security Boundary Enforcement:**
   - The REST API Key and Auth Key must reside strictly in `.env` and be accessed solely in `server/`.
   - No `VITE_` prefixed secret variables should exist.
   - Verification command must be able to scan `client/src/*` and find 0 matches for `COMETCHAT_AUTH_KEY`, `COMETCHAT_REST`, or `apiKey`.

---

## 3. Caveats

1. **Truncated Auth Key in `.env`**:
   `COMETCHAT_AUTH_KEY` in `.env` currently ends with `...`. Real network requests to the CometChat v3 REST API will return `401 Unauthorized` or invalid token until the user pastes the complete secret key from the CometChat dashboard. However, the server must boot successfully, provide diagnostic feedback, serve `/api/health`, and pass all local compilation and typecheck criteria.
2. **Frontend UI Gate**:
   Per `PROJECT_RULES.md` (Invariant 9), deep frontend component authoring requires an interactive design template gate with the user. The current phase is strictly restricted to workspace scaffolding and contracts.
3. **CometChat REST Rate & Idempotency**:
   CometChat REST `POST /v3/users` and `POST /v3/groups` may return `400` or `ERR_UID_ALREADY_EXISTS` / `ERR_ALREADY_EXISTS` if the user or group already exists. The server implementation must treat those status codes as successful idempotency confirmations rather than fatal exceptions.

---

## 4. Conclusion

The repository is currently at ground zero: no manifests, no workspace configuration, and no packages exist. The required setup is completely mapped out:
1. Root `package.json`, `pnpm-workspace.yaml`, and `tsconfig.json`.
2. `@kinesio/shared` containing the full TRD Section 2 contracts.
3. `@kinesio/server` providing Express token server, boot key validation, and `/api/health` + `/api/session`.
4. `@kinesio/client` scaffolding Vite, React, Vitest, Framer Motion, and Calls/Chat SDKs with proxy and global define.
5. All three packages linked via `workspace:*` in `pnpm`.

---

## 5. Verification Method

To independently verify the survey findings and subsequent implementation:

1. **Inspect Root Files**:
   ```powershell
   Test-Path package.json, pnpm-workspace.yaml, tsconfig.json, shared/package.json, server/package.json, client/package.json
   ```
2. **Verify Tooling**:
   ```powershell
   node -v; pnpm -v
   ```
   (Expected: `v22.19.0`, `12.8.1`).
3. **Verify Workspace Linking & Compilation**:
   ```powershell
   pnpm install
   pnpm --filter @kinesio/shared build
   pnpm --filter @kinesio/server build
   pnpm --filter @kinesio/client build
   ```
4. **Secret Isolation Check**:
   ```powershell
   Select-String -Path "client/src/*" -Pattern "COMETCHAT_AUTH_KEY|COMETCHAT_REST|apiKey"
   ```
   (Expected: 0 hits).
5. **Boot & Token Server Test**:
   ```powershell
   # In terminal 1:
   pnpm --filter @kinesio/server dev
   # In terminal 2:
   Invoke-RestMethod -Uri "http://localhost:5000/api/health"
   ```
