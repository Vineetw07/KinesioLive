# DISPATCH: Worker M1_M2 (D5.1 Outbox Retry Queue & D5.2 Coaching Cue Fixes)

## Working Directory
`d:/TP/Hackathon/Cometchat/.agents/teamwork/teamwork_preview_worker_d5_m1_m2/`

## Role & Type
`teamwork_preview_worker`

## Authoritative Inputs
- Read `d:/TP/Hackathon/Cometchat/.agents/teamwork/ORIGINAL_REQUEST.md` (specifically lines 307–553 under section `## 2026-10-04T07:34:42Z`).
- Read Survey Explorer 1 handoff:
  `d:/TP/Hackathon/Cometchat/.agents/teamwork/teamwork_preview_explorer_d5_survey_1/handoff.md`

## Files You Own Exclusively
- `client/src/styles/tokens.css`
- `client/src/views/Patient.tsx`

You MUST NOT edit any other files.

## MANDATORY INTEGRITY WARNING
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## Tasks to Implement

### 1. `client/src/styles/tokens.css` (D5.2)
Add the semantic tokens:
In Section 3 (Brand & Accent Tokens):
```css
  --accent-cyan: #06B6D4;                            /* Coaching cue accent */
  --accent-cyan-tint: rgba(6, 182, 212, 0.18);       /* Coaching cue glow fill */
```
In Section 6 (Curvature & Elevation Hierarchy):
```css
  --shadow-glow-cyan: 0 0 16px -2px rgba(6, 182, 212, 0.45);
```

### 2. `client/src/views/Patient.tsx` Toast Dismiss Timing & Cyan Styling (D5.2)
- In the incoming cue listener (line 199), change the dismiss timer from `3500` to `4000`:
  `setTimeout(() => setActiveToast(null), 4000);`
- In the active toast overlay JSX (lines 577–609), update the styling from `--accent-lime` to `--accent-cyan`, `--accent-cyan-tint`, and `--shadow-glow-cyan`.
- Enforce ZERO raw hex codes in the component — semantic tokens only.

### 3. `client/src/views/Patient.tsx` In-Memory Outbox Retry Queue (D5.1)
- Define `OutboxItem`:
  ```typescript
  interface OutboxItem {
    message: CometChat.CustomMessage;
    retries: number;
  }
  ```
- Store queue in `useRef<OutboxItem[]>([])` and `isFlushingRef = useRef<boolean>(false)`. (Do NOT use React `useState` — must never trigger re-renders or block rVFC).
- In `dispatchCustomRepMessage` and `dispatchCustomAlertMessage`, remove the empty `catch {}` blocks. When `sendCustomMessage` rejects, push `{ message: customMsg, retries: 0 }` to `outboxQueueRef.current`.
- Register a `CometChat.ConnectionListener` in `bootstrapPatientCall` after login:
  ```typescript
  const connListenerId = `kine-patient-conn-${session.sessionId}`;
  CometChat.addConnectionListener(
    connListenerId,
    new CometChat.ConnectionListener({
      onConnected: () => {
        flushOutboxQueue();
      },
    })
  );
  ```
- Add listener cleanup in `callTeardownRef.current`:
  `try { CometChat.removeConnectionListener(connListenerId); } catch {}`
- Implement `flushOutboxQueue()`:
  - If already flushing or queue empty, return.
  - While queue has items:
    - Attempt `CometChat.sendCustomMessage(item.message)`.
    - If successful, remove from queue (`shift()`).
    - If rejected, increment `item.retries += 1`.
    - If `item.retries >= 3`, log warning `console.warn('[KinesioOutbox] Discarded custom message after 3 failed retries:', ...)` and remove from queue (`shift()`).
    - If `item.retries < 3`, halt current flush (connection still unstable; leave item in queue for next `onConnected`).
- Queue flush must be asynchronous and decoupled from `rVFC` (zero frame drops).

## Verification Required
Worker must run:
1. `pnpm -r run typecheck` (or `pnpm exec tsc --noEmit`)
2. `pnpm vitest run tests/geometry.test.ts`
Document results and commands in your `handoff.md`.

## Output
Write your handoff to:
`d:/TP/Hackathon/Cometchat/.agents/teamwork/teamwork_preview_worker_d5_m1_m2/handoff.md`
Then send a completion message back to parent.


## 2026-10-04T07:48:11Z
You are Worker M1_M2 for Phase 4 of KinesioLive.
Your identity: Worker M1_M2 (teamwork_preview_worker).
Your working directory is:
d:/TP/Hackathon/Cometchat/.agents/teamwork/teamwork_preview_worker_d5_m1_m2/

Read the authoritative requirements first:
d:/TP/Hackathon/Cometchat/.agents/teamwork/ORIGINAL_REQUEST.md
(Pay special attention to lines 307–553 under section ## 2026-10-04T07:34:42Z).

Read Survey Explorer 1 handoff for exact code locations and patterns:
d:/TP/Hackathon/Cometchat/.agents/teamwork/teamwork_preview_explorer_d5_survey_1/handoff.md

Read your full dispatch instructions:
d:/TP/Hackathon/Cometchat/.agents/teamwork/teamwork_preview_worker_d5_m1_m2/DISPATCH.md

Files you own exclusively:
- client/src/styles/tokens.css
- client/src/views/Patient.tsx

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Implement the tasks in DISPATCH.md:
1. Add --accent-cyan, --accent-cyan-tint, and --shadow-glow-cyan to tokens.css.
2. In Patient.tsx, update toast dismiss timer from 3500 to 4000ms.
3. In Patient.tsx, update toast overlay styling to use cyan tokens with ZERO raw hex codes.
4. In Patient.tsx, replace empty catch blocks with an in-memory outbox retry queue (useRef) flushed on CometChat.ConnectionListener.onConnected with max 3 retries, console.warn on discard, non-blocking to rVFC.

Verify your changes:
Run typecheck: `pnpm exec tsc --noEmit`
Run vitest: `pnpm vitest run tests/geometry.test.ts`
Confirm exit code 0.

Write your report to:
d:/TP/Hackathon/Cometchat/.agents/teamwork/teamwork_preview_worker_d5_m1_m2/handoff.md
Send a completion message back to parent.
