# Survey Explorer 2 Report: Biomechanical Summary Engine & Test Ground Truth (Milestone D5.3)

**Author:** Survey Explorer 2 (`teamwork_preview_explorer`)  
**Scope:** Milestone D5.3 (`client/src/engine/buildSummary.ts`, `client/src/engine/index.ts`, `tests/summary.test.ts`)  
**Date:** 2026-10-04T07:48:00Z  

---

## 1. Observation

### 1.1 Authoritative Requirements & Context
From `d:/TP/Hackathon/Cometchat/.agents/teamwork/ORIGINAL_REQUEST.md`:
- **Line 330**: "`client/src/engine/index.ts`: Exists — exports `geometry.ts`, `repCounter.ts`, `smoothing.ts`. No `buildSummary`."
- **Line 333**: "`client/src/engine/buildSummary.ts`: Does NOT exist. Must be created."
- **Line 335**: "`tests/summary.test.ts`: Does NOT exist. Must be created at `tests/` repo root (alongside `tests/geometry.test.ts`, etc.)."
- **Lines 414–470**: Exact specification for `SessionSummary`, `buildSummary`, extraction boundary contract, and math invariants.
- **Lines 511–526**: Exact requirements for 7 non-tautological test cases in `tests/summary.test.ts`.

### 1.2 Contracts Ground Truth (`shared/src/index.ts`)
Inspection of `shared/src/index.ts` lines 1–134 revealed:
- **Line 6**: `export const SCHEMA_VERSION = 1 as const;`
- **Line 8**: `export type Side = "L" | "R";`
- **Line 10**: `export type SquatPhase = "standing" | "descending" | "bottom" | "ascending" | "lost";`
- **Line 12**: `export type SquatDepthRating = "shallow" | "good" | "deep";`
- **Line 14**: `export type SquatTempo = "fast" | "controlled" | "slow";`
- **Line 16**: `export type CoachingCueType = "knees_out" | "slower" | "chest_up" | "good_depth";`
- **Line 18**: `export type SessionMarkerAction = "start" | "end" | "summary";`
- **Lines 25–29**:
  ```typescript
  export interface Envelope {
    v: typeof SCHEMA_VERSION;
    sid: string;
    t: number;
  }
  ```
- **Lines 52–59**:
  ```typescript
  export interface KineRepPayload extends Envelope {
    type: "kine.rep";
    n: number;
    minKneeDeg: number;
    depth: SquatDepthRating;
    durMs: number;
    tempo: SquatTempo;
  }
  ```
- **Lines 65–74**:
  ```typescript
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
  ```
- **Lines 80–84**:
  ```typescript
  export interface KineCuePayload extends Envelope {
    type: "kine.cue";
    cue: CoachingCueType;
    text: string;
  }
  ```
- **Lines 90–95**:
  ```typescript
  export interface KineSessionMarkerPayload extends Envelope {
    type: "kine.session";
    action: SessionMarkerAction;
    clinicianUid: string;
    patientUid: string;
  }
  ```
- **Lines 129–130**: `CLINICIAN_UID = "dr-demo" as const;`, `PATIENT_UID = "pt-demo" as const;`

### 1.3 Message Ingestion Pattern (`client/src/spikes/s4-custom/persistenceRunner.ts`)
Inspection of `persistenceRunner.ts` lines 160–167 observed:
```typescript
for (const msg of fetchedMessages) {
  if (msg instanceof CometChat.CustomMessage) {
    const id = msg.getId();
    const sentAt = msg.getSentAt();
    const type = msg.getType() || msg.getSubType() || 'custom';
    const sender = msg.getSender()?.getUid() || 'unknown';
    const data = (msg.getCustomData() || {}) as Record<string, unknown>;
    // ...
  }
}
```
This confirms that `msg instanceof CometChat.CustomMessage` and `msg.getCustomData()` is the established pattern across the project.

### 1.4 Test Mock Environment & Configuration
- In `vitest.config.ts`:
  ```typescript
  resolve: {
    alias: {
      '@cometchat/calls-sdk-javascript': path.resolve(__dirname, 'tests/mocks/calls-sdk.ts'),
      '@cometchat/chat-sdk-javascript': path.resolve(__dirname, 'tests/mocks/chat-sdk.ts'),
    },
  }
  ```
- In `tests/mocks/chat-sdk.ts`:
  - `MockCustomMessage` constructor signature:
    `constructor(receiverId: string, receiverType: string, type: string, customData: Record<string, unknown>)`
  - Methods on `MockCustomMessage`:
    `getCustomData()`, `getId(): number`, `getSentAt(): number`, `setSentAt(t: number)`, `getType(): string`.
  - Exported `CometChat` object contains `CustomMessage: MockCustomMessage`.
  - NOTE: `CometChat.BaseMessage` is currently not exported as a value in `tests/mocks/chat-sdk.ts` (it exists only in TypeScript types of `@cometchat/chat-sdk-javascript`).

### 1.5 Current Compilation & Test Execution
- Command `pnpm -r run typecheck`: Exited with code 0 across `shared`, `client`, and `server`.
- Command `pnpm vitest run tests/repCounter.test.ts`: 9 tests passed in 69ms.
- Command `pnpm vitest run tests/sessionGuard.test.ts`: 15 tests passed in 4ms.

---

## 2. Logic Chain

1. **Interface Contract Alignment**:
   `SessionSummary` is consumed by the downstream bento component `Summary.tsx` (Milestone D5.4). It requires aggregated rep counts, depth breakdown, tempo breakdown, arithmetic mean knee angle, deepest knee angle (min of angles), alert counts/breakdown, highest valgus deviation, cue history, session duration from start/end markers, and a chronological event timeline.
   Every property in `SessionSummary` directly maps to an element of the D5.4 UI.

2. **Critic Rubric C1 & Zero `?.` Invariant**:
   Antigravity Master Engineering Protocol strictly prohibits inserting optional chaining (`?.`) or fallback coalescing (`??`) at calculation sites to mask null/undefined crash sites.
   Therefore, message parsing must occur in two discrete stages:
   - **Stage 1 (Boundary Ingestion & Type Discrimination)**: Inspect incoming `msg: CometChat.BaseMessage`. Guard against non-`CustomMessage` instances, absent or invalid `customData`, missing required payload fields, or non-finite numbers (`NaN`, `Infinity`). Corrupted or unrecognized packets return `null` and are discarded before reaching calculation logic.
   - **Stage 2 (Pure Deterministic Arithmetic)**: Compute all summary metrics using strictly typed, non-nullable intermediate records (`ExtractedRep`, `ExtractedAlert`, `ExtractedCue`, `ExtractedSessionMarker`). Because the ingestion boundary guarantees validity and finiteness, arithmetic operations (`sum / totalReps`, `Math.min`, `Math.max`, `end.t - start.t`) are 100% clean with zero `?.` or `??`.

3. **Division-by-Zero & NaN Defense**:
   If an empty session or a session with 0 reps is provided, computing `sum / totalReps` directly would yield `NaN`. Checking `totalReps === 0 ? 0 : sum / totalReps` guarantees numeric safety. Similarly, `Math.min` on an empty array produces `Infinity`; guarding with `totalReps === 0 ? 0 : Math.min(...)` ensures `peakDepthDeg` evaluates to `0`. `maxValgusDevPct` evaluates to `0` when `alertCount === 0`.

4. **Session Duration Logic**:
   A workout session can have multiple markers or out-of-order markers. The session duration is defined as `endMarker.t - startMarker.t`. If either marker is absent, `durationMs` must be `0`. Clamping with `Math.max(0, endMarker.t - startMarker.t)` prevents negative duration in the presence of unsynchronized clocks.

5. **Chronological Monotonicity**:
   CometChat message pagination (`fetchPrevious()`) and network delivery can return messages in reverse order or out of order. While count aggregations are commutative (order-independent), `timeline` and `cuesDelivered` require chronological sequence. Sorting `timeline` ascending by `timestamp` satisfies the chronological requirement.

6. **Test Mock Construction**:
   Because `vitest.config.ts` aliases `@cometchat/chat-sdk-javascript` to `tests/mocks/chat-sdk.ts`, test cases can instantiate `new CometChat.CustomMessage(sessionId, CometChat.RECEIVER_TYPE.GROUP, type, payload)` directly in memory without running an Express server or making CometChat network calls.
   For test case 6 (malformed / non-CustomMessage), passing a plain object or a mock `TextMessage` / `TransientMessage` triggers `msg instanceof CometChat.CustomMessage === false`, verifying the boundary guard cleanly.

---

## 3. Caveats

1. **`MockBaseMessage` in `tests/mocks/chat-sdk.ts`**:
   `tests/mocks/chat-sdk.ts` currently does not export a `BaseMessage` class on the `CometChat` object. However, in TypeScript, `CometChat.BaseMessage` is a type. When writing tests, injecting a non-custom message can be done via `{ getId: () => 101, getSentAt: () => 1000 } as unknown as CometChat.BaseMessage` or `new CometChat.TransientMessage(...) as unknown as CometChat.BaseMessage`. Alternatively, adding `MockBaseMessage` to `tests/mocks/chat-sdk.ts` is recommended for maximum fidelity.
2. **`averageMinKneeDeg` Floating Point Precision**:
   The specification states: "`sum of all repPayload.minKneeDeg divided by totalReps. If totalReps === 0, return 0 — no division.`" In JavaScript, dividing floats can produce precision artifacts (e.g., `80.33333333333333`). In our test fixtures, choosing rep angles that divide cleanly (e.g. `110 + 95 + 80 = 285; 285 / 3 = 95.0`) ensures assertions pass regardless of whether exact or rounded to 1 decimal place. In `buildSummary`, rounding to 1 decimal place (`Math.round((sum / totalReps) * 10) / 10`) matches the `repCounter.ts` convention (`Math.round(this._minKneeDeg * 10) / 10`). Both exact and 1-decimal rounding are analyzed in Section 4.
3. **No Direct Source Modification**:
   As Survey Explorer 2, all source trees (`client/`, `shared/`, `tests/`) have been left untouched. Implementation will be executed by the designated implementer.

---

## 4. Conclusion & Concrete Ground Truth Specification

### 4.1 Exact Types & Contracts (`shared/src/index.ts`)
The required types are already exported from `@kinesio/shared`:
- `KineRepPayload`: `{ v: 1, sid: string, t: number, type: "kine.rep", n: number, minKneeDeg: number, depth: SquatDepthRating, durMs: number, tempo: SquatTempo }`
- `KineAlertPayload`: `{ v: 1, sid: string, t: number, type: "kine.alert", kind: "knee_valgus", side: Side, value: number, thresholdPct: number, repN: number, phase: SquatPhase, note: "Form alert (biomechanical feedback)" }`
- `KineCuePayload`: `{ v: 1, sid: string, t: number, type: "kine.cue", cue: CoachingCueType, text: string }`
- `KineSessionMarkerPayload`: `{ v: 1, sid: string, t: number, type: "kine.session", action: SessionMarkerAction, clinicianUid: string, patientUid: string }`
- Enums:
  - `CoachingCueType = "knees_out" | "slower" | "chest_up" | "good_depth"`
  - `SquatDepthRating = "shallow" | "good" | "deep"`
  - `SquatTempo = "fast" | "controlled" | "slow"`
  - `Side = "L" | "R"`
  - `SessionMarkerAction = "start" | "end" | "summary"`

### 4.2 Exact Signatures for `client/src/engine/buildSummary.ts`
```typescript
import { CometChat } from '@cometchat/chat-sdk-javascript';
import type {
  CoachingCueType,
  SquatDepthRating,
  SquatTempo,
  Side,
  KineRepPayload,
  KineAlertPayload,
  KineCuePayload,
  KineSessionMarkerPayload,
} from '@kinesio/shared';

export interface TimelineEvent {
  id: string;
  timestamp: number;
  type: "rep" | "alert" | "cue" | "session";
  title: string;
  detail: string;
  severity?: "normal" | "warning" | "critical";
}

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

export function buildSummary(
  sessionId: string,
  messages: CometChat.BaseMessage[]
): SessionSummary;
```

### 4.3 Proposed Implementation of `client/src/engine/buildSummary.ts`
```typescript
/**
 * client/src/engine/buildSummary.ts
 *
 * Deterministic Biomechanical Summary Engine for KinesioLive.
 * Ingests raw CometChat.BaseMessage[] history from MessagesRequestBuilder.fetchPrevious(),
 * filters and validates persisted custom messages at the boundary, and compiles comprehensive
 * session analytics with zero ?. at calculation sites.
 *
 * Strictly adheres to:
 * - ORIGINAL_REQUEST.md § R3
 * - docs/trd.md § Section-2
 * - Antigravity Master Engineering Protocol § Critic Rubric C1
 */

import { CometChat } from '@cometchat/chat-sdk-javascript';
import type {
  CoachingCueType,
  SquatDepthRating,
  SquatTempo,
  Side,
  SessionMarkerAction,
} from '@kinesio/shared';

export interface TimelineEvent {
  id: string;
  timestamp: number;
  type: 'rep' | 'alert' | 'cue' | 'session';
  title: string;
  detail: string;
  severity?: 'normal' | 'warning' | 'critical';
}

export interface SessionSummary {
  sessionId: string;
  durationMs: number;
  totalReps: number;
  validReps: number;
  depthDistribution: { shallow: number; good: number; deep: number };
  tempoDistribution: { fast: number; controlled: number; slow: number };
  averageMinKneeDeg: number;
  peakDepthDeg: number;
  alertCount: number;
  alertBreakdown: { L: number; R: number };
  maxValgusDevPct: number;
  cuesCount: number;
  cuesDelivered: Array<{ cue: CoachingCueType; text: string; timestamp: number }>;
  timeline: Array<TimelineEvent>;
}

// ----------------------------------------------------------------------------
// Internal Validated Types (Guaranteed non-null, primitive fields)
// ----------------------------------------------------------------------------
interface ValidatedRep {
  id: string;
  t: number;
  n: number;
  minKneeDeg: number;
  depth: SquatDepthRating;
  durMs: number;
  tempo: SquatTempo;
}

interface ValidatedAlert {
  id: string;
  t: number;
  side: Side;
  value: number;
  thresholdPct: number;
  repN: number;
}

interface ValidatedCue {
  id: string;
  t: number;
  cue: CoachingCueType;
  text: string;
}

interface ValidatedSessionMarker {
  id: string;
  t: number;
  action: SessionMarkerAction;
  clinicianUid: string;
  patientUid: string;
}

type ExtractedRecord =
  | { kind: 'rep'; data: ValidatedRep }
  | { kind: 'alert'; data: ValidatedAlert }
  | { kind: 'cue'; data: ValidatedCue }
  | { kind: 'session'; data: ValidatedSessionMarker };

// ----------------------------------------------------------------------------
// Boundary Ingestion Guard (All validation happens here)
// ----------------------------------------------------------------------------
function extractRecord(msg: CometChat.BaseMessage, index: number): ExtractedRecord | null {
  if (!msg || !(msg instanceof CometChat.CustomMessage)) {
    return null;
  }

  const rawCustomData = msg.getCustomData();
  if (!rawCustomData || typeof rawCustomData !== 'object' || Array.isArray(rawCustomData)) {
    return null;
  }

  const data = rawCustomData as Record<string, unknown>;
  if (typeof data.type !== 'string') {
    return null;
  }

  const rawId = typeof msg.getId === 'function' ? msg.getId() : null;
  const id = rawId != null ? String(rawId) : `msg-${index}`;

  const rawT = data.t;
  const t = typeof rawT === 'number' && Number.isFinite(rawT)
    ? rawT
    : (typeof msg.getSentAt === 'function' && Number.isFinite(msg.getSentAt()) ? msg.getSentAt() : 0);

  switch (data.type) {
    case 'kine.rep': {
      if (
        typeof data.n !== 'number' || !Number.isFinite(data.n) ||
        typeof data.minKneeDeg !== 'number' || !Number.isFinite(data.minKneeDeg) ||
        (data.depth !== 'shallow' && data.depth !== 'good' && data.depth !== 'deep') ||
        typeof data.durMs !== 'number' || !Number.isFinite(data.durMs) ||
        (data.tempo !== 'fast' && data.tempo !== 'controlled' && data.tempo !== 'slow')
      ) {
        return null;
      }
      return {
        kind: 'rep',
        data: {
          id,
          t,
          n: data.n,
          minKneeDeg: data.minKneeDeg,
          depth: data.depth,
          durMs: data.durMs,
          tempo: data.tempo,
        },
      };
    }

    case 'kine.alert': {
      if (
        (data.side !== 'L' && data.side !== 'R') ||
        typeof data.value !== 'number' || !Number.isFinite(data.value)
      ) {
        return null;
      }
      const thresholdPct = typeof data.thresholdPct === 'number' && Number.isFinite(data.thresholdPct)
        ? data.thresholdPct
        : 8.0;
      const repN = typeof data.repN === 'number' && Number.isFinite(data.repN) ? data.repN : 0;
      return {
        kind: 'alert',
        data: {
          id,
          t,
          side: data.side,
          value: data.value,
          thresholdPct,
          repN,
        },
      };
    }

    case 'kine.cue': {
      if (
        (data.cue !== 'knees_out' && data.cue !== 'slower' && data.cue !== 'chest_up' && data.cue !== 'good_depth') ||
        typeof data.text !== 'string'
      ) {
        return null;
      }
      return {
        kind: 'cue',
        data: {
          id,
          t,
          cue: data.cue,
          text: data.text,
        },
      };
    }

    case 'kine.session': {
      if (data.action !== 'start' && data.action !== 'end' && data.action !== 'summary') {
        return null;
      }
      return {
        kind: 'session',
        data: {
          id,
          t,
          action: data.action,
          clinicianUid: typeof data.clinicianUid === 'string' ? data.clinicianUid : '',
          patientUid: typeof data.patientUid === 'string' ? data.patientUid : '',
        },
      };
    }

    default:
      return null;
  }
}

// ----------------------------------------------------------------------------
// Pure Summary Builder (Zero ?. at calculation sites)
// ----------------------------------------------------------------------------
export function buildSummary(
  sessionId: string,
  messages: CometChat.BaseMessage[]
): SessionSummary {
  const reps: ValidatedRep[] = [];
  const alerts: ValidatedAlert[] = [];
  const cues: ValidatedCue[] = [];
  const timeline: TimelineEvent[] = [];

  let startMarkerT: number | null = null;
  let endMarkerT: number | null = null;

  // Stage 1: Extraction & Categorization
  for (let i = 0; i < messages.length; i++) {
    const item = extractRecord(messages[i]!, i);
    if (!item) continue;

    switch (item.kind) {
      case 'rep': {
        const r = item.data;
        reps.push(r);
        timeline.push({
          id: r.id,
          timestamp: r.t,
          type: 'rep',
          title: `Rep #${r.n} (${r.depth})`,
          detail: `${r.depth.toUpperCase()} depth (${r.minKneeDeg}°) • ${r.durMs}ms • ${r.tempo}`,
          severity: 'normal',
        });
        break;
      }
      case 'alert': {
        const a = item.data;
        alerts.push(a);
        timeline.push({
          id: a.id,
          timestamp: a.t,
          type: 'alert',
          title: `Knee Valgus Alert (${a.side})`,
          detail: `${a.side === 'L' ? 'Left' : 'Right'} knee deviation +${a.value}% (threshold ${a.thresholdPct}%)`,
          severity: 'critical',
        });
        break;
      }
      case 'cue': {
        const c = item.data;
        cues.push(c);
        timeline.push({
          id: c.id,
          timestamp: c.t,
          type: 'cue',
          title: `Coaching Cue: ${c.cue.replace('_', ' ')}`,
          detail: c.text,
          severity: 'normal',
        });
        break;
      }
      case 'session': {
        const s = item.data;
        if (s.action === 'start') {
          if (startMarkerT === null || s.t < startMarkerT) {
            startMarkerT = s.t;
          }
        } else if (s.action === 'end') {
          if (endMarkerT === null || s.t > endMarkerT) {
            endMarkerT = s.t;
          }
        }
        timeline.push({
          id: s.id,
          timestamp: s.t,
          type: 'session',
          title: `Session ${s.action.charAt(0).toUpperCase() + s.action.slice(1)}`,
          detail: s.clinicianUid && s.patientUid ? `Clinician: ${s.clinicianUid} • Patient: ${s.patientUid}` : `Session marker: ${s.action}`,
          severity: 'normal',
        });
        break;
      }
    }
  }

  // Stage 2: Pure Calculations
  const totalReps = reps.length;
  let validReps = 0;
  const depthDistribution = { shallow: 0, good: 0, deep: 0 };
  const tempoDistribution = { fast: 0, controlled: 0, slow: 0 };
  let repSum = 0;
  let peakDepthDeg = 0;

  if (totalReps > 0) {
    let minKneeFound = reps[0]!.minKneeDeg;
    for (let i = 0; i < reps.length; i++) {
      const r = reps[i]!;
      if (r.depth !== 'shallow') {
        validReps++;
      }
      depthDistribution[r.depth]++;
      tempoDistribution[r.tempo]++;
      repSum += r.minKneeDeg;
      if (r.minKneeDeg < minKneeFound) {
        minKneeFound = r.minKneeDeg;
      }
    }
    peakDepthDeg = minKneeFound;
  }

  const averageMinKneeDeg = totalReps === 0
    ? 0
    : Math.round((repSum / totalReps) * 10) / 10;

  const alertCount = alerts.length;
  const alertBreakdown = { L: 0, R: 0 };
  let maxValgusDevPct = 0;

  if (alertCount > 0) {
    let maxValgusFound = alerts[0]!.value;
    for (let i = 0; i < alerts.length; i++) {
      const a = alerts[i]!;
      alertBreakdown[a.side]++;
      if (a.value > maxValgusFound) {
        maxValgusFound = a.value;
      }
    }
    maxValgusDevPct = maxValgusFound;
  }

  const cuesCount = cues.length;
  const cuesDelivered = cues
    .map((c) => ({ cue: c.cue, text: c.text, timestamp: c.t }))
    .sort((a, b) => a.timestamp - b.timestamp);

  // Chronological sort on timeline
  timeline.sort((a, b) => a.timestamp - b.timestamp);

  // Duration calculation
  let durationMs = 0;
  if (startMarkerT !== null && endMarkerT !== null && endMarkerT >= startMarkerT) {
    durationMs = endMarkerT - startMarkerT;
  }

  return {
    sessionId,
    durationMs,
    totalReps,
    validReps,
    depthDistribution,
    tempoDistribution,
    averageMinKneeDeg,
    peakDepthDeg,
    alertCount,
    alertBreakdown,
    maxValgusDevPct,
    cuesCount,
    cuesDelivered,
    timeline,
  };
}
```

### 4.4 Barrel Export Updates (`client/src/engine/index.ts`)
Append section 5 to `client/src/engine/index.ts`:
```typescript
// ============================================================================
// 5. Biomechanical Summary Engine (./buildSummary)
// ============================================================================
export {
  buildSummary,
  type SessionSummary,
  type TimelineEvent,
} from './buildSummary';
```

---

### 4.5 Non-Tautological Test Suite (`tests/summary.test.ts`)
Below is the full design for `tests/summary.test.ts` satisfying all 7 mandatory test cases without network dependencies:

```typescript
/**
 * tests/summary.test.ts
 *
 * Non-tautological unit test suite for Milestone D5.3 Biomechanical Summary Engine.
 * Verifies buildSummary aggregation, math formulas, out-of-order sorting,
 * and boundary discarding without network dependencies.
 */

import { describe, it, expect } from 'vitest';
import { CometChat } from '@cometchat/chat-sdk-javascript';
import { buildSummary, type SessionSummary } from '../client/src/engine/buildSummary';
import {
  SCHEMA_VERSION,
  CLINICIAN_UID,
  PATIENT_UID,
  type KineRepPayload,
  type KineAlertPayload,
  type KineCuePayload,
  type KineSessionMarkerPayload,
} from '../shared/src/index';

// ----------------------------------------------------------------------------
// Deterministic Fixture Helpers
// ----------------------------------------------------------------------------
function makeRepMessage(sessionId: string, payload: KineRepPayload): CometChat.CustomMessage {
  const msg = new CometChat.CustomMessage(
    sessionId,
    CometChat.RECEIVER_TYPE.GROUP,
    'kine.rep',
    payload as unknown as Record<string, unknown>
  );
  if (typeof (msg as any).setSentAt === 'function') {
    (msg as any).setSentAt(payload.t);
  }
  return msg;
}

function makeAlertMessage(sessionId: string, payload: KineAlertPayload): CometChat.CustomMessage {
  const msg = new CometChat.CustomMessage(
    sessionId,
    CometChat.RECEIVER_TYPE.GROUP,
    'kine.alert',
    payload as unknown as Record<string, unknown>
  );
  if (typeof (msg as any).setSentAt === 'function') {
    (msg as any).setSentAt(payload.t);
  }
  return msg;
}

function makeCueMessage(sessionId: string, payload: KineCuePayload): CometChat.CustomMessage {
  const msg = new CometChat.CustomMessage(
    sessionId,
    CometChat.RECEIVER_TYPE.GROUP,
    'kine.cue',
    payload as unknown as Record<string, unknown>
  );
  if (typeof (msg as any).setSentAt === 'function') {
    (msg as any).setSentAt(payload.t);
  }
  return msg;
}

function makeSessionMessage(
  sessionId: string,
  payload: KineSessionMarkerPayload
): CometChat.CustomMessage {
  const msg = new CometChat.CustomMessage(
    sessionId,
    CometChat.RECEIVER_TYPE.GROUP,
    'kine.session',
    payload as unknown as Record<string, unknown>
  );
  if (typeof (msg as any).setSentAt === 'function') {
    (msg as any).setSentAt(payload.t);
  }
  return msg;
}

describe('Biomechanical Summary Engine (D5.3) - buildSummary()', () => {
  const SID = 'kine-test-room-42';

  // 1. Empty session
  it('handles empty session: 0 messages -> all counts 0, durationMs 0, no division-by-zero thrown', () => {
    const summary = buildSummary(SID, []);

    expect(summary.sessionId).toBe(SID);
    expect(summary.durationMs).toBe(0);
    expect(summary.totalReps).toBe(0);
    expect(summary.validReps).toBe(0);
    expect(summary.depthDistribution).toEqual({ shallow: 0, good: 0, deep: 0 });
    expect(summary.tempoDistribution).toEqual({ fast: 0, controlled: 0, slow: 0 });
    expect(summary.averageMinKneeDeg).toBe(0);
    expect(summary.peakDepthDeg).toBe(0);
    expect(summary.alertCount).toBe(0);
    expect(summary.alertBreakdown).toEqual({ L: 0, R: 0 });
    expect(summary.maxValgusDevPct).toBe(0);
    expect(summary.cuesCount).toBe(0);
    expect(summary.cuesDelivered).toEqual([]);
    expect(summary.timeline).toEqual([]);
  });

  // 2. 3-rep session (shallow + good + deep)
  it('aggregates 3-rep session (shallow + good + deep) with correct distributions and math', () => {
    const rep1: KineRepPayload = {
      v: SCHEMA_VERSION,
      sid: SID,
      t: 10000,
      type: 'kine.rep',
      n: 1,
      minKneeDeg: 110.0,
      depth: 'shallow',
      durMs: 1100,
      tempo: 'fast',
    };
    const rep2: KineRepPayload = {
      v: SCHEMA_VERSION,
      sid: SID,
      t: 20000,
      type: 'kine.rep',
      n: 2,
      minKneeDeg: 95.0,
      depth: 'good',
      durMs: 2200,
      tempo: 'controlled',
    };
    const rep3: KineRepPayload = {
      v: SCHEMA_VERSION,
      sid: SID,
      t: 30000,
      type: 'kine.rep',
      n: 3,
      minKneeDeg: 80.0,
      depth: 'deep',
      durMs: 3600,
      tempo: 'slow',
    };

    const messages = [
      makeRepMessage(SID, rep1),
      makeRepMessage(SID, rep2),
      makeRepMessage(SID, rep3),
    ];

    const summary = buildSummary(SID, messages);

    expect(summary.totalReps).toBe(3);
    expect(summary.validReps).toBe(2); // shallow rep excluded from valid reps
    expect(summary.depthDistribution).toEqual({ shallow: 1, good: 1, deep: 1 });
    expect(summary.tempoDistribution).toEqual({ fast: 1, controlled: 1, slow: 1 });
    expect(summary.averageMinKneeDeg).toBe(95.0); // (110 + 95 + 80) / 3 = 95.0
    expect(summary.peakDepthDeg).toBe(80.0); // deepest angle = Math.min(110, 95, 80)
    expect(summary.timeline.length).toBe(3);
  });

  // 3. Valgus alert aggregation
  it('aggregates valgus alerts: 2 L-side (9.4, 11.2) and 1 R-side (8.3) -> breakdown {L:2, R:1}, maxValgusDevPct 11.2', () => {
    const alert1: KineAlertPayload = {
      v: SCHEMA_VERSION,
      sid: SID,
      t: 12000,
      type: 'kine.alert',
      kind: 'knee_valgus',
      side: 'L',
      value: 9.4,
      thresholdPct: 8.0,
      repN: 1,
      phase: 'descending',
      note: 'Form alert (biomechanical feedback)',
    };
    const alert2: KineAlertPayload = {
      v: SCHEMA_VERSION,
      sid: SID,
      t: 22000,
      type: 'kine.alert',
      kind: 'knee_valgus',
      side: 'L',
      value: 11.2,
      thresholdPct: 8.0,
      repN: 2,
      phase: 'bottom',
      note: 'Form alert (biomechanical feedback)',
    };
    const alert3: KineAlertPayload = {
      v: SCHEMA_VERSION,
      sid: SID,
      t: 22500,
      type: 'kine.alert',
      kind: 'knee_valgus',
      side: 'R',
      value: 8.3,
      thresholdPct: 8.0,
      repN: 2,
      phase: 'bottom',
      note: 'Form alert (biomechanical feedback)',
    };

    const messages = [
      makeAlertMessage(SID, alert1),
      makeAlertMessage(SID, alert2),
      makeAlertMessage(SID, alert3),
    ];

    const summary = buildSummary(SID, messages);

    expect(summary.alertCount).toBe(3);
    expect(summary.alertBreakdown).toEqual({ L: 2, R: 1 });
    expect(summary.maxValgusDevPct).toBe(11.2);
    expect(summary.timeline.length).toBe(3);
    expect(summary.timeline.every((e) => e.severity === 'critical')).toBe(true);
  });

  // 4. Cue delivery tracking
  it('tracks cue deliveries: 3 cue messages -> cuesCount 3, correct cue enums and text', () => {
    const cue1: KineCuePayload = {
      v: SCHEMA_VERSION,
      sid: SID,
      t: 15000,
      type: 'kine.cue',
      cue: 'knees_out',
      text: 'Drive knees outward over toes',
    };
    const cue2: KineCuePayload = {
      v: SCHEMA_VERSION,
      sid: SID,
      t: 25000,
      type: 'kine.cue',
      cue: 'slower',
      text: 'Slow down descent',
    };
    const cue3: KineCuePayload = {
      v: SCHEMA_VERSION,
      sid: SID,
      t: 35000,
      type: 'kine.cue',
      cue: 'chest_up',
      text: 'Keep chest upright',
    };

    const messages = [
      makeCueMessage(SID, cue1),
      makeCueMessage(SID, cue2),
      makeCueMessage(SID, cue3),
    ];

    const summary = buildSummary(SID, messages);

    expect(summary.cuesCount).toBe(3);
    expect(summary.cuesDelivered).toHaveLength(3);
    expect(summary.cuesDelivered[0]).toEqual({
      cue: 'knees_out',
      text: 'Drive knees outward over toes',
      timestamp: 15000,
    });
    expect(summary.cuesDelivered[1]).toEqual({
      cue: 'slower',
      text: 'Slow down descent',
      timestamp: 25000,
    });
    expect(summary.cuesDelivered[2]).toEqual({
      cue: 'chest_up',
      text: 'Keep chest upright',
      timestamp: 35000,
    });
  });

  // 5. Out-of-order timestamps
  it('sorts timeline chronologically when messages arrive in reverse order', () => {
    const rep3 = makeRepMessage(SID, {
      v: SCHEMA_VERSION,
      sid: SID,
      t: 50000,
      type: 'kine.rep',
      n: 3,
      minKneeDeg: 85.0,
      depth: 'good',
      durMs: 2000,
      tempo: 'controlled',
    });
    const cue1 = makeCueMessage(SID, {
      v: SCHEMA_VERSION,
      sid: SID,
      t: 30000,
      type: 'kine.cue',
      cue: 'knees_out',
      text: 'Push knees out',
    });
    const sessionStart = makeSessionMessage(SID, {
      v: SCHEMA_VERSION,
      sid: SID,
      t: 10000,
      type: 'kine.session',
      action: 'start',
      clinicianUid: CLINICIAN_UID,
      patientUid: PATIENT_UID,
    });
    const sessionEnd = makeSessionMessage(SID, {
      v: SCHEMA_VERSION,
      sid: SID,
      t: 60000,
      type: 'kine.session',
      action: 'end',
      clinicianUid: CLINICIAN_UID,
      patientUid: PATIENT_UID,
    });

    // Provide in reverse order
    const messages = [sessionEnd, rep3, cue1, sessionStart];

    const summary = buildSummary(SID, messages);

    expect(summary.timeline).toHaveLength(4);
    expect(summary.timeline[0]!.timestamp).toBe(10000);
    expect(summary.timeline[1]!.timestamp).toBe(30000);
    expect(summary.timeline[2]!.timestamp).toBe(50000);
    expect(summary.timeline[3]!.timestamp).toBe(60000);

    for (let i = 1; i < summary.timeline.length; i++) {
      expect(summary.timeline[i]!.timestamp).toBeGreaterThanOrEqual(
        summary.timeline[i - 1]!.timestamp
      );
    }
  });

  // 6. Malformed message discarding
  it('discards malformed messages, non-CustomMessage instances, and corrupted payloads cleanly', () => {
    // A non-CustomMessage base message
    const nonCustomMsg = {
      getId: () => 999,
      getSentAt: () => 1000,
      getType: () => 'text',
    } as unknown as CometChat.BaseMessage;

    // CustomMessage with null customData
    const emptyCustomMsg = new CometChat.CustomMessage(
      SID,
      CometChat.RECEIVER_TYPE.GROUP,
      'kine.empty',
      null as any
    );

    // CustomMessage with unknown type
    const unknownTypeMsg = new CometChat.CustomMessage(
      SID,
      CometChat.RECEIVER_TYPE.GROUP,
      'unknown.type',
      { type: 'kine.unknown', foo: 'bar' }
    );

    // Corrupted rep payload (missing minKneeDeg, invalid tempo)
    const corruptedRepMsg = new CometChat.CustomMessage(
      SID,
      CometChat.RECEIVER_TYPE.GROUP,
      'kine.rep',
      { type: 'kine.rep', n: 1, minKneeDeg: NaN, depth: 'invalid_depth', durMs: -10 }
    );

    // Corrupted alert payload (invalid side)
    const corruptedAlertMsg = new CometChat.CustomMessage(
      SID,
      CometChat.RECEIVER_TYPE.GROUP,
      'kine.alert',
      { type: 'kine.alert', side: 'CENTER', value: 12.0 }
    );

    // Exactly one valid rep
    const validRep = makeRepMessage(SID, {
      v: SCHEMA_VERSION,
      sid: SID,
      t: 15000,
      type: 'kine.rep',
      n: 1,
      minKneeDeg: 90.0,
      depth: 'good',
      durMs: 1800,
      tempo: 'controlled',
    });

    const messages = [
      nonCustomMsg,
      emptyCustomMsg,
      unknownTypeMsg,
      corruptedRepMsg,
      corruptedAlertMsg,
      validRep,
    ];

    expect(() => {
      const summary = buildSummary(SID, messages);
      expect(summary.totalReps).toBe(1);
      expect(summary.validReps).toBe(1);
      expect(summary.alertCount).toBe(0);
      expect(summary.timeline).toHaveLength(1);
    }).not.toThrow();
  });

  // 7. Session duration calculation
  it('computes session duration: start (t=1000) and end (t=61000) -> durationMs 60000; 0 if either missing', () => {
    const startMsg = makeSessionMessage(SID, {
      v: SCHEMA_VERSION,
      sid: SID,
      t: 1000,
      type: 'kine.session',
      action: 'start',
      clinicianUid: CLINICIAN_UID,
      patientUid: PATIENT_UID,
    });
    const endMsg = makeSessionMessage(SID, {
      v: SCHEMA_VERSION,
      sid: SID,
      t: 61000,
      type: 'kine.session',
      action: 'end',
      clinicianUid: CLINICIAN_UID,
      patientUid: PATIENT_UID,
    });

    // Both markers present
    const summary = buildSummary(SID, [startMsg, endMsg]);
    expect(summary.durationMs).toBe(60000);

    // End marker only -> durationMs 0
    const endOnlySummary = buildSummary(SID, [endMsg]);
    expect(endOnlySummary.durationMs).toBe(0);

    // Start marker only -> durationMs 0
    const startOnlySummary = buildSummary(SID, [startMsg]);
    expect(startOnlySummary.durationMs).toBe(0);
  });
});
```

---

## 5. Verification Method

Once implemented, independently verify via the following commands in Windows PowerShell 5.1:

1. **Compilation & Typecheck across all workspaces**:
   ```powershell
   pnpm -r run typecheck
   ```
   **Expected Result**: Scope: 3 of 4 workspace projects (`shared`, `client`, `server`) compile with exit code 0 and zero TypeScript diagnostics.

2. **Run the new test suite**:
   ```powershell
   pnpm vitest run tests/summary.test.ts
   ```
   **Expected Result**: All 7 test cases pass with exit code 0 in `< 1000ms`.

3. **Check for zero `?.` in `buildSummary.ts`**:
   ```powershell
   Select-String -Path "client/src/engine/buildSummary.ts" -Pattern "\?\."
   ```
   **Expected Result**: Zero occurrences at calculation sites (boundary ingestion handles all safety).

4. **Invalidation Conditions**:
   - If `buildSummary` throws on empty arrays or malformed messages.
   - If `averageMinKneeDeg` or `peakDepthDeg` evaluates to `NaN` or `Infinity`.
   - If `validReps` incorrectly includes `shallow` reps.
   - If `timeline` is not strictly monotonic ascending by timestamp.
   - If tests fail to run due to unmocked CometChat network calls.
