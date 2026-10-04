# Scope: Milestone 1 — Monorepo Root & Shared Contract (@kinesio/shared)

## Architecture
- Root pnpm monorepo configuration:
  - `package.json` (private workspace root with build, typecheck, dev scripts)
  - `pnpm-workspace.yaml` (declaring `packages: ['shared', 'server', 'client']`)
  - `tsconfig.json` (base compiler options for workspace)
- `@kinesio/shared`:
  - `shared/package.json` (name: `@kinesio/shared`, exports `./src/index.ts` and `./dist/index.js`, scripts `build` and `typecheck`)
  - `shared/tsconfig.json` (ES2022, NodeNext, declaration: true)
  - `shared/src/index.ts` (complete biomechanical and session contracts)

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Workspace Setup | Root `package.json`, `pnpm-workspace.yaml`, and `tsconfig.json` linking `shared`, `server`, and `client` | M1 | R1, TRD §1 |
| 2 | Biomechanical Contracts | `KinePosePayload` with `kneeFlexionDeg`, `valgusDevPct`, `depthRatio`, `phase`, `reps`, `vis`, `fps`, `seq` in `@kinesio/shared` | M1 | R1, TRD §2 |
| 3 | Message Event Schemas | `KineRepPayload`, `KineAlertPayload`, `KineCuePayload`, `KineSessionMarkerPayload`, and `KineMessage` union | M1 | R1, TRD §2 |
| 4 | Session Types & Constants | `SessionRequest`, `SessionResponse`, `CLINICIAN_UID`, `PATIENT_UID`, `Envelope` in `@kinesio/shared` | M1 | R1, TRD §2 |
| 5 | Shared Package Build | `@kinesio/shared` package build and typecheck with declaration outputs | M1 | Acceptance |

## Code Layout
Exclusive write ownership for M1:
- `d:\TP\Hackathon\Cometchat\package.json`
- `d:\TP\Hackathon\Cometchat\pnpm-workspace.yaml`
- `d:\TP\Hackathon\Cometchat\tsconfig.json`
- `d:\TP\Hackathon\Cometchat\shared/package.json`
- `d:\TP\Hackathon\Cometchat\shared/tsconfig.json`
- `d:\TP\Hackathon\Cometchat\shared/src/index.ts`

Do NOT touch `server/` or `client/` in this milestone.

## Acceptance Criteria
- `pnpm install` links workspace cleanly.
- `pnpm --filter @kinesio/shared build` exits with code 0.
- `pnpm --filter @kinesio/shared typecheck` (or `tsc --noEmit`) exits with code 0.
- All required types and constants from `PROJECT.md § Interface Contracts` are exported.
