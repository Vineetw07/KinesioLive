# BRIEFING — 2026-10-04T05:43:00Z

## Mission
Implement the Deterministic Rep Counter State Machine & Engine Barrel Export in `client/src/engine/repCounter.ts` and `client/src/engine/index.ts`.

## 🔒 My Identity
- Archetype: worker_d3_m3
- Roles: implementer, qa, specialist
- Working directory: d:/TP/Hackathon/Cometchat/.agents/teamwork/teamwork_preview_worker_d3_m3
- Original parent: b54e93f5-e470-4c09-928a-a4cf3197f4a3
- Milestone: Day 3 Milestone 3 - Deterministic Rep Counter State Machine & Barrel Export

## 🔒 Key Constraints
- EXCLUSIVELY own:
  1. `client/src/engine/repCounter.ts`
  2. `client/src/engine/index.ts`
- DO NOT modify any other files.
- Integrity Mandate: Genuine logic, zero hardcoding, zero facade implementations.
- Zero-DOM: Pure TypeScript mathematics, zero browser globals.
- Verification: `pnpm --filter @kinesio/client exec tsc --noEmit` exit code 0.

## Current Parent
- Conversation ID: b54e93f5-e470-4c09-928a-a4cf3197f4a3
- Updated: 2026-10-04T05:43:00Z

## Task Summary
- **What to build**: `RepCounterStateMachine` in `repCounter.ts` implementing 5 core phases (`standing | descending | bottom | ascending | lost`), state transitions with dead-lock prevention (shallow squat reversal), validation gate (depth <= 105 deg, dur >= 800ms, tempo calculation, depth rating), lost/dropout handling (< 1000ms resume), valgus alert detector (descending/bottom, > +8%, >=3 frames, 4000ms leg cooldowns, KineAlertPayload emission). Unified barrel export `client/src/engine/index.ts`.
- **Success criteria**: Strict TypeScript compilation with zero errors, zero DOM dependencies, adherence to TRD and survey specs. All workspace typechecks passing.
- **Interface contracts**: `packages/shared/src/types/telemetry.ts` and survey handoffs.
- **Code layout**: `client/src/engine/`

## Key Decisions Made
- Flexible input parsing in `RepCounterStateMachine`: seamlessly handles pre-calculated kinematics (`kneeDeg`, `depthRatio`, `valgusDevPctL`/`R`), object structures (`kneeAngle: { L, R }`, `valgusDevPct: { L, R }`), as well as raw fixture frames (`landmarks`, `worldLandmarks`).
- Dual naming compatibility on output: provides both `completedRep` and `repEvent`, `alerts` and `alertEvents`, `reps` and `count`, along with `isShallow` and `isBounce`.
- Dual invocation compatibility: supports both `.update()` and `.processFrame()`, property getters (`.phase`, `.reps`, `.minKneeDeg`), and method getters (`.getPhase()`, `.getReps()`, `.getState()`).
- Long dropout protection: if tracking is lost >= 1000 ms while crouching, resets to standing and requires user to reach upright before triggering a new rep.

## Artifact Index
- `client/src/engine/repCounter.ts` — Deterministic Rep Counter State Machine & Valgus Detector
- `client/src/engine/index.ts` — Engine barrel export
- `d:/TP/Hackathon/Cometchat/.agents/teamwork/teamwork_preview_worker_d3_m3/handoff.md` — Final Handoff report

## Change Tracker
- **Files modified**:
  - `client/src/engine/repCounter.ts` — Full implementation of `RepCounterStateMachine`, `RepCounterOutput`, `RepCounterInput`, valgus detector, and state transitions
  - `client/src/engine/index.ts` — Barrel export for geometry, smoothing, repCounter, and shared contracts
- **Build status**: `pnpm --filter @kinesio/client exec tsc --noEmit` PASS (exit code 0); `pnpm -r run typecheck` PASS (exit code 0); Vitest engine suites PASS (exit code 0)
- **Pending issues**: None

## Quality Status
- **Build/test result**: PASS (exit code 0)
- **Lint status**: Clean (zero TypeScript errors)
- **Tests added/modified**: Milestone 4 owns test suites; current engine suites pass with exit code 0
