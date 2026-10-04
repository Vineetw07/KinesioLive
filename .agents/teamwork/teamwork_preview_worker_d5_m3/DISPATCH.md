# DISPATCH: Worker M3 (D5.3 Biomechanical Summary Engine & Unit Tests)

## Working Directory
`d:/TP/Hackathon/Cometchat/.agents/teamwork/teamwork_preview_worker_d5_m3/`

## Role & Type
`teamwork_preview_worker`

## Authoritative Inputs
- Read `d:/TP/Hackathon/Cometchat/.agents/teamwork/ORIGINAL_REQUEST.md` (lines 307–553, specifically § R3, lines 410–470 and § Verification, lines 511–526).
- Read Survey Explorer 2 handoff:
  `d:/TP/Hackathon/Cometchat/.agents/teamwork/teamwork_preview_explorer_d5_survey_2/handoff.md`

## Files You Own Exclusively
- `client/src/engine/buildSummary.ts` (create)
- `client/src/engine/index.ts` (re-export `buildSummary` and `SessionSummary`)
- `tests/summary.test.ts` (create at repo root `tests/`)

You MUST NOT edit any other files.

## MANDATORY INTEGRITY WARNING
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## Tasks to Implement

### 1. `client/src/engine/buildSummary.ts`
Create this file from scratch.
Export:
- `TimelineEvent` interface:
  ```typescript
  export interface TimelineEvent {
    id: string;
    timestamp: number;
    type: 'rep' | 'alert' | 'cue' | 'session';
    title: string;
    detail: string;
    severity?: 'normal' | 'warning' | 'critical';
  }
  ```
- `SessionSummary` interface:
  ```typescript
  export interface SessionSummary {
    sessionId: string;
    durationMs: number;          // end.t - start.t from kine.session markers; 0 if markers absent
    totalReps: number;
    validReps: number;           // reps where depth !== "shallow"
    depthDistribution: { shallow: number; good: number; deep: number };
    tempoDistribution: { fast: number; controlled: number; slow: number };
    averageMinKneeDeg: number;   // arithmetic mean; NaN-safe (return 0 if no reps)
    peakDepthDeg: number;        // minimum minKneeDeg across all reps (deepest angle)
    alertCount: number;
    alertBreakdown: { L: number; R: number };
    maxValgusDevPct: number;     // highest `value` across all kine.alert messages
    cuesCount: number;
    cuesDelivered: Array<{ cue: CoachingCueType; text: string; timestamp: number }>;
    timeline: Array<TimelineEvent>;
  }
  ```
- `buildSummary(sessionId: string, messages: CometChat.BaseMessage[]): SessionSummary`
- Implementation requirements:
  - Pure, deterministic aggregation. No side effects. No network calls.
  - Stage 1 Ingestion Boundary Guard: Check `msg instanceof CometChat.CustomMessage`. Extract `msg.getCustomData()`. Guard against missing or malformed payloads, non-finite numbers, and unrecognized `data.type`. Skip cleanly.
  - CRITIC RUBRIC C1: ZERO `?.` operators at calculation sites. Guard at the ingestion boundary, compute cleanly inside.
  - Math invariants:
    - `averageMinKneeDeg`: sum of `minKneeDeg` / `totalReps`. If `totalReps === 0`, return `0` (no division). Round to 1 decimal place (`Math.round((sum / totalReps) * 10) / 10`) or return float.
    - `peakDepthDeg`: `Math.min(...minKneeDeg)`. If `totalReps === 0`, return `0`.
    - `durationMs`: `Math.max(0, endMarker.t - startMarker.t)`. If either start or end marker is missing, return `0`.
    - `validReps`: count where `depth !== "shallow"`. If `totalReps === 0`, return `0`.
    - `maxValgusDevPct`: highest `value` across `kine.alert`. If `alertCount === 0`, return `0`.
    - `depthDistribution`: `{ shallow, good, deep }`.
    - `tempoDistribution`: `{ fast, controlled, slow }`.
    - `alertBreakdown`: `{ L, R }`.
    - `timeline`: sorted ascending by `timestamp`.

### 2. `client/src/engine/index.ts`
Re-export:
```typescript
export { buildSummary } from './buildSummary';
export type { SessionSummary, TimelineEvent } from './buildSummary';
```

### 3. `tests/summary.test.ts`
Create at repo root `tests/summary.test.ts`.
Implement the full 7 non-tautological test cases required in `ORIGINAL_REQUEST.md`:
1. **Empty session**: 0 messages → all counts 0, `durationMs: 0`, `averageMinKneeDeg: 0`, `peakDepthDeg: 0`, no division-by-zero thrown.
2. **3-rep session** (shallow + good + deep): assert `totalReps: 3`, `validReps: 2`, correct `depthDistribution: { shallow: 1, good: 1, deep: 1 }`.
3. **Valgus alert aggregation**: 2 L-side alerts (values 9.4, 11.2) and 1 R-side (8.3) → `alertBreakdown: { L: 2, R: 1 }`, `maxValgusDevPct: 11.2`.
4. **Cue delivery tracking**: 3 cue messages → `cuesCount: 3`, `cuesDelivered` array has correct `cue` and `text`.
5. **Out-of-order timestamps**: messages provided in reverse chronological order → `timeline` returned sorted ascending.
6. **Malformed message discarding**: inject a `CometChat.BaseMessage` that is NOT a `CometChat.CustomMessage` or has corrupt customData → no crash, skipped cleanly.
7. **Session duration**: inject `kine.session` start (t=1000) and end (t=61000) markers → `durationMs: 60000`.

## Verification Required
Worker must run:
1. `pnpm exec tsc --noEmit`
2. `pnpm vitest run tests/summary.test.ts`
3. `pnpm vitest run`
Document results and commands in your `handoff.md`.

## Output
Write your report to:
`d:/TP/Hackathon/Cometchat/.agents/teamwork/teamwork_preview_worker_d5_m3/handoff.md`
Send completion message back to parent.


## 2026-10-04T08:04:15Z
You are Worker M3 for Phase 4 (Milestone D5.3) of KinesioLive.
Your identity: Worker M3 (teamwork_preview_worker).
Your working directory is:
d:/TP/Hackathon/Cometchat/.agents/teamwork/teamwork_preview_worker_d5_m3/

Read the authoritative requirements first:
d:/TP/Hackathon/Cometchat/.agents/teamwork/ORIGINAL_REQUEST.md
(Pay special attention to lines 307–553, specifically § R3 lines 410–470 and § Verification lines 511–526).

Read Survey Explorer 2 handoff for complete contract specifications and math designs:
d:/TP/Hackathon/Cometchat/.agents/teamwork/teamwork_preview_explorer_d5_survey_2/handoff.md

Read your full dispatch instructions:
d:/TP/Hackathon/Cometchat/.agents/teamwork/teamwork_preview_worker_d5_m3/DISPATCH.md

Files you own exclusively:
- client/src/engine/buildSummary.ts (create)
- client/src/engine/index.ts (re-export buildSummary and SessionSummary)
- tests/summary.test.ts (create at repo root tests/)

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

CRITIC RUBRIC C1 ENFORCEMENT:
Zero `?.` operators at arithmetic and calculation sites. Guard at the ingestion boundary, compute cleanly inside.

Implement the tasks in DISPATCH.md:
1. Create client/src/engine/buildSummary.ts.
2. Re-export in client/src/engine/index.ts.
3. Create tests/summary.test.ts implementing all 7 mandatory non-tautological test cases.
4. Verify with:
   pnpm exec tsc --noEmit
   pnpm vitest run tests/summary.test.ts
   pnpm vitest run

Write your report to:
d:/TP/Hackathon/Cometchat/.agents/teamwork/teamwork_preview_worker_d5_m3/handoff.md
Send a completion message back to parent.
