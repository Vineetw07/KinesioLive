# Scope: Phase 4 (Milestones D5.1–D5.4)

## Architecture
- **Biomechanical Pipeline & Outbox Retry Queue**: `client/src/views/Patient.tsx` dispatches custom messages (`kine.rep`, `kine.alert`) over CometChat without blocking rVFC frame loop. Outbox queue catches send rejections and flushes on `ConnectionListener.onConnected` with max 3 retries.
- **Coaching Cue Pipeline & Semantic Tokens**: `client/src/styles/tokens.css` defines `--accent-cyan`, `--accent-cyan-tint`, `--shadow-glow-cyan`. `client/src/views/Patient.tsx` renders cue toasts with cyan styling and 4000ms dismiss timer.
- **Biomechanical Summary Engine**: `client/src/engine/buildSummary.ts` pure deterministic aggregator operating on CometChat custom messages to compute `SessionSummary` with zero `?.` at calculation sites. Re-exported in `client/src/engine/index.ts`. Tested by `tests/summary.test.ts`.
- **Post-Workout Summary Bento View**: `client/src/views/Summary.tsx` fetches custom messages via `MessagesRequestBuilder`, calls `buildSummary`, and renders 4 stat cards, anchor dark card with inline SVG hatched texture, luminous pills, and scrollable timeline using Framer Motion springs. Plumbed via `onEndSession` in `Clinician.tsx` and `App.tsx`.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Ground Truth Inspection | Inspect existing Patient.tsx, Clinician.tsx, tokens.css, motionPresets.ts, shared/src/index.ts, App.tsx | Survey | ORIGINAL_REQUEST.md §2026-10-04T07:34:42Z |
| 2 | Outbox Retry Queue (D5.1) | In-memory retry queue flushed on onConnected, max 3 retries with warning discard, non-blocking rVFC | M1 | ORIGINAL_REQUEST.md §R1 |
| 3 | Coaching Cue Pipeline Fixes (D5.2) | 4000ms dismiss timing, --accent-cyan / tint / glow tokens in tokens.css, apply to Patient toast | M2 | ORIGINAL_REQUEST.md §R2 |
| 4 | Biomechanical Summary Engine (D5.3) | buildSummary.ts, SessionSummary interface, export in engine/index.ts, pure deterministic math | M3 | ORIGINAL_REQUEST.md §R3 |
| 5 | Summary Engine Unit Tests (D5.3) | tests/summary.test.ts with 7 non-tautological test cases, vitest pass | M3 | ORIGINAL_REQUEST.md §R3 / §Verification |
| 6 | Post-Workout Summary Bento View (D5.4) | client/src/views/Summary.tsx with 4 stat cards, anchor dark card, hatched texture, timeline | M4 | ORIGINAL_REQUEST.md §R4 |
| 7 | Session End Routing Wiring (D5.4) | Plumb onEndSession from Clinician to App.tsx to render Summary view | M4 | ORIGINAL_REQUEST.md §R4 |
| 8 | Monorepo Verification & Audit | pnpm exec tsc --noEmit and vitest run tests/summary.test.ts passing | M5 | ORIGINAL_REQUEST.md §Verification |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M0 | Survey & Inspection | Map ground truth across existing files | none | DONE |
| M1 | Outbox Retry Queue (D5.1) | Patient.tsx outbox retry queue + ConnectionListener | M0 | DONE |
| M2 | Coaching Cue Pipeline Fixes (D5.2) | tokens.css + Patient.tsx toast 4000ms and cyan styling | M0 | DONE |
| M3 | Summary Engine & Tests (D5.3) | buildSummary.ts, engine/index.ts, tests/summary.test.ts | M0 | DONE |
| M4 | Summary Bento View & Routing (D5.4) | Summary.tsx, Clinician.tsx onEndSession, App.tsx navigation | M2, M3 | DONE |
| M5 | Full Verification & Forensic Audit | Typecheck, all tests pass, zero cheating audit | M1, M2, M3, M4 | DONE |

## Interface Contracts
### CometChat Custom Messages ↔ buildSummary
- Discriminator: `data.type` inside `msg.getCustomData()`
- Types: `"kine.rep"`, `"kine.alert"`, `"kine.cue"`, `"kine.session"`
- `SessionSummary`:
  - `sessionId: string`
  - `durationMs: number`
  - `totalReps: number`
  - `validReps: number`
  - `depthDistribution: { shallow: number; good: number; deep: number }`
  - `tempoDistribution: { fast: number; controlled: number; slow: number }`
  - `averageMinKneeDeg: number`
  - `peakDepthDeg: number`
  - `alertCount: number`
  - `alertBreakdown: { L: number; R: number }`
  - `maxValgusDevPct: number`
  - `cuesCount: number`
  - `cuesDelivered: Array<{ cue: CoachingCueType; text: string; timestamp: number }>`
  - `timeline: Array<{ id: string; timestamp: number; type: "rep"|"alert"|"cue"|"session"; title: string; detail: string; severity?: "normal"|"warning"|"critical" }>`

### Clinician ↔ App.tsx ↔ Summary.tsx
- `Clinician` accepts prop `onEndSession?: () => void`
- `App.tsx` manages `isSummaryView` state: when session ends, switches to render `<Summary sessionId={sessionId} guid={sessionId} onBack={() => setIsSummaryView(false)} />`
