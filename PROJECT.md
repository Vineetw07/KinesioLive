# Project: KinesioLive Scaffolding

## Architecture
- Root `pnpm` monorepo configuration (`pnpm-workspace.yaml`, root `package.json`, root `tsconfig.json`) linking 3 workspaces: `shared/`, `server/`, and `client/`.
- Data Flow:
  - Client sends `POST /api/session` (via Vite proxy `http://localhost:5000/api`) with `SessionRequest`.
  - Server validates credentials, performs user upsert for `dr-demo` and `pt-demo` via CometChat REST `POST /v3/users`, creates session group via `POST /v3/groups` and assigns members via `POST /v3/groups/{guid}/members`, mints user auth token via `POST /v3/users/{uid}/auth_tokens`, and returns sanitized `SessionResponse`.
  - Client initializes CometChat Chat & Calls SDKs using `appId`, `region`, and `authToken` (zero server secrets on client).
  - Telemetry and custom events share strict TypeScript schemas defined in `@kinesio/shared`.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Workspace Setup | Root `package.json`, `pnpm-workspace.yaml`, and `tsconfig.json` linking `shared`, `server`, and `client` | M1 | R1, TRD §1 |
| 2 | Biomechanical Contracts | `KinePosePayload` with `kneeFlexionDeg`, `valgusDevPct`, `depthRatio`, `phase`, `reps`, `vis`, `fps`, `seq` in `@kinesio/shared` | M1 | R1, TRD §2 |
| 3 | Message Event Schemas | `KineRepPayload`, `KineAlertPayload`, `KineCuePayload`, `KineSessionMarkerPayload`, and `KineMessage` union | M1 | R1, TRD §2 |
| 4 | Session Types & Constants | `SessionRequest`, `SessionResponse`, `CLINICIAN_UID`, `PATIENT_UID`, `Envelope` in `@kinesio/shared` | M1 | R1, TRD §2 |
| 5 | Shared Package Build | `@kinesio/shared` package build and typecheck with declaration outputs | M1 | Acceptance |
| 6 | Express Backend Setup | Express + TypeScript (`tsx`, `dotenv`, `cors`) server reading `.env` in `@kinesio/server` | M2 | R2 |
| 7 | Health Probe Endpoint | `GET /api/health` returning `{ status: "ok", uptime, timestamp }` | M2 | R2, Acceptance |
| 8 | Boot Credential Diagnostics | Scans `COMETCHAT_APP_ID`, `COMETCHAT_REGION`, and keys; warns if keys are missing or truncated (`...`) | M2 | R2.7 |
| 9 | User Upsert Service | `POST /v3/users` to ensure `dr-demo` and `pt-demo` exist before token minting (handles idempotent duplicate UID) | M2 | R2.3 |
| 10 | Group Upsert Service | `POST /v3/groups` (`guid: sessionId`, `name`, `type: public`) with `dr-demo` and `pt-demo` added | M2 | R2.4 |
| 11 | Auth Token Minting | `POST /v3/users/{uid}/auth_tokens` with `apikey` in headers; returns `SessionResponse` | M2 | R2.5 |
| 12 | Session API Endpoint | `POST /api/session` generating session ID `kine-<timestamp>` if omitted, returning `SessionResponse` | M2 | R2, Acceptance |
| 13 | Client Workspace Setup | React 18/19 + Vite + TypeScript + Vitest + Framer Motion in `@kinesio/client` | M3 | R3 |
| 14 | Client Dependencies | `@cometchat/calls-sdk-javascript@^5`, `@cometchat/chat-sdk-javascript@^4`, `@mediapipe/tasks-vision`, `@kinesio/shared` | M3 | R3 |
| 15 | Vite Proxy Configuration | `vite.config.ts` proxy forwarding `/api` to `http://localhost:5000` | M3 | R3 |
| 16 | Vite Global Define | `vite.config.ts` with `define: { global: 'window' }` to prevent SDK runtime crashes | M3 | R3 |
| 17 | Secret Isolation Boundary | Server REST API Key / Auth Key never imported or referenced in `client/src/*` | M3 | R3, Acceptance |
| 18 | Monorepo Build Verification | All 3 packages compile and typecheck cleanly (`pnpm build`, `pnpm typecheck`) | M4 | Acceptance |
| 19 | Live API Verification | Verification of `GET /api/health` and `POST /api/session` for both clinician and patient | M4 | Acceptance |
| 20 | Secret Scan & Security Audit | Regex scan of `client/src/*` confirms zero secret leakage | M4 | Acceptance |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | Monorepo Root & Shared Contract | Root manifests (`package.json`, `pnpm-workspace.yaml`, `tsconfig.json`) + `@kinesio/shared` contracts | none | DONE |
| 2 | Express Backend & CometChat REST Token Service | `@kinesio/server` setup, `/api/health`, `/api/session`, user/group upsert, boot key diagnostics | M1 | DONE |
| 3 | Client Workspace Scaffolding | `@kinesio/client` setup, Vite config (proxy + global define), React skeleton, zero-secret compliance | M1 | DONE |
| 4 | Integration Verification & Security Audit | Full monorepo build, typechecks, live endpoints verification, secret scan, audit | M1, M2, M3 | DONE |

## Interface Contracts

### `@kinesio/shared` -> `@kinesio/server` & `@kinesio/client`
```typescript
export const SCHEMA_VERSION = 1 as const;
export type Side = "L" | "R";
export type SquatPhase = "standing" | "descending" | "bottom" | "ascending" | "lost";
export type SquatDepthRating = "shallow" | "good" | "deep";
export type SquatTempo = "fast" | "controlled" | "slow";
export type CoachingCueType = "knees_out" | "slower" | "chest_up" | "good_depth";
export type SessionMarkerAction = "start" | "end" | "summary";
export type UserRole = "clinician" | "patient";

export interface Envelope {
  v: typeof SCHEMA_VERSION;
  sid: string;
  t: number;
}

export interface KinePosePayload extends Envelope {
  type: "kine.pose";
  seq: number;
  fps: number;
  phase: SquatPhase;
  kneeFlexionDeg: { L: number | null; R: number | null };
  kneeDeg?: { L: number | null; R: number | null };
  valgusDevPct: { L: number | null; R: number | null };
  depthRatio: number;
  vis: number;
  reps: number;
}

export interface KineRepPayload extends Envelope {
  type: "kine.rep";
  n: number;
  minKneeDeg: number;
  depth: SquatDepthRating;
  durMs: number;
  tempo: SquatTempo;
}

export interface KineAlertPayload extends Envelope {
  type: "kine.alert";
  kind: "knee_valgus";
  side: Side;
  value: number;
  thresholdPct: number;
  repN: number;
  phase: SquatPhase;
  note: "Form alert (biomechanical feedback)";
}

export interface KineCuePayload extends Envelope {
  type: "kine.cue";
  cue: CoachingCueType;
  text: string;
}

export interface KineSessionMarkerPayload extends Envelope {
  type: "kine.session";
  action: SessionMarkerAction;
  clinicianUid: string;
  patientUid: string;
}

export type KineMessage =
  | KinePosePayload
  | KineRepPayload
  | KineAlertPayload
  | KineCuePayload
  | KineSessionMarkerPayload;

export interface SessionRequest {
  role: UserRole;
  sessionId?: string;
}

export interface SessionResponse {
  sessionId: string;
  authToken: string;
  uid: string;
  appId: string;
  region: string;
}

export const CLINICIAN_UID = "dr-demo" as const;
export const PATIENT_UID = "pt-demo" as const;
export const TELEMETRY_RATE_HZ = 10 as const;
export const VALGUS_THRESHOLD_PCT = 8.0 as const;
export const VALGUS_COOLDOWN_MS = 4000 as const;
```

### `@kinesio/server` HTTP API
- `GET /api/health`
  - Response: `{ status: "ok", uptime: number, timestamp: number }`
- `POST /api/session`
  - Request: `SessionRequest` (`{ role: "clinician" | "patient", sessionId?: string }`)
  - Response: `SessionResponse` (`{ sessionId: string, authToken: string, uid: string, appId: string, region: string }`)

## Code Layout
```
d:\TP\Hackathon\Cometchat\
├── package.json
├── pnpm-workspace.yaml
├── tsconfig.json
├── .env
├── shared/
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       └── index.ts
├── server/
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts
│       └── cometchatRest.ts
└── client/
    ├── package.json
    ├── tsconfig.json
    ├── tsconfig.node.json
    ├── vite.config.ts
    ├── index.html
    └── src/
        ├── vite-env.d.ts
        ├── main.tsx
        ├── App.tsx
        └── index.css
```
