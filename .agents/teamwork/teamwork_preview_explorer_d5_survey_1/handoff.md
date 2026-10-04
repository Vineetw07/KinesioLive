# Phase 4 Survey & Ground Truth Report: D5.1 & D5.2

## Executive Summary
Survey Explorer 1 investigated the ground truth codebase for **Milestone D5.1** (Outbox Retry Queue in `Patient.tsx`) and **Milestone D5.2** (Coaching Cue Toast & Styling). The investigation verified exact line locations, current implementations, architectural integration points with CometChat SDK v4, design tokens, and motion presets. All seven questions posed in `DISPATCH.md` are answered below with verbatim observations, code snippets, logic chains, and concrete implementation specifications.

---

## 1. Observation

### Obs 1.1: Empty `catch {}` Blocks in `client/src/views/Patient.tsx`
In `client/src/views/Patient.tsx`, lines 446–476 contain `dispatchCustomRepMessage` and `dispatchCustomAlertMessage`:
```typescript
446:   // Dispatch Persisted Custom Messages
447:   const dispatchCustomRepMessage = async (repPayload: KineRepPayload) => {
448:     if (!activeSessionId) return;
449:     try {
450:       const customMsg = new CometChat.CustomMessage(
451:         activeSessionId,
452:         CometChat.RECEIVER_TYPE.GROUP,
453:         'kine.rep',
454:         repPayload as unknown as Record<string, unknown>
455:       );
456:       customMsg.shouldUpdateConversation(false);
457:       await CometChat.sendCustomMessage(customMsg);
458:     } catch {
459:       // Non-blocking custom message failure
460:     }
461:   };
462: 
463:   const dispatchCustomAlertMessage = async (alertPayload: KineAlertPayload) => {
464:     if (!activeSessionId) return;
465:     try {
466:       const customMsg = new CometChat.CustomMessage(
467:         activeSessionId,
468:         CometChat.RECEIVER_TYPE.GROUP,
469:         'kine.alert',
470:         alertPayload as unknown as Record<string, unknown>
471:       );
472:       customMsg.shouldUpdateConversation(false);
473:       await CometChat.sendCustomMessage(customMsg);
474:     } catch {
475:       // Non-blocking custom alert failure
476:     }
477:   };
```
- **Line 458–460:** The `catch` block in `dispatchCustomRepMessage` silently drops failed rep messages.
- **Line 474–476:** The `catch` block in `dispatchCustomAlertMessage` silently drops failed alert messages.

### Obs 1.2: CometChat Connection Lifecycle & Listener Registration in `Patient.tsx`
In `client/src/views/Patient.tsx`, lines 108–241 govern session initialization, SDK login, and listener lifecycle:
- Lines 121–132: Initializes Chat SDK (`CometChat.init`) and logs in (`CometChat.login`).
- Lines 185–203: Registers incoming coaching cue listener:
  ```typescript
  185:         // Register incoming coaching cue listener (kine.cue)
  186:         const customListenerId = `kine-patient-cues-${session.sessionId}`;
  187:         CometChat.addMessageListener(
  188:           customListenerId,
  189:           new CometChat.MessageListener({
  190:             onCustomMessageReceived: (customMessage: CometChat.CustomMessage) => {
  ...
  201:             },
  202:           })
  203:         );
  ```
- Lines 205–223: Teardown logic stored in `callTeardownRef.current`:
  ```typescript
  205:         callTeardownRef.current = () => {
  ...
  213:           try {
  214:             CometChat.removeMessageListener(customListenerId);
  215:           } catch {
  216:             // Ignore
  217:           }
  ...
  223:         };
  ```
- Lines 234–240: Cleanup function executes `callTeardownRef.current()`.

### Obs 1.3: CometChat MCP Documentation for `ConnectionListener`
Using the `cometchat` MCP tool (`fetch_cometchat_doc_page` on `/sdk/javascript/connection-status`), the official CometChat JavaScript SDK v4 specification documents:
- Listener registration:
  ```typescript
  let listenerID: string = "UNIQUE_LISTENER_ID";
  CometChat.addConnectionListener(
    listenerID,
    new CometChat.ConnectionListener({
      onConnected: () => {
        console.log("ConnectionListener => On Connected");
      },
      inConnecting: () => {
        console.log("ConnectionListener => In connecting");
      },
      onDisconnected: () => {
        console.log("ConnectionListener => On Disconnected");
      },
    })
  );
  ```
- Listener removal:
  `CometChat.removeConnectionListener(listenerID);`
- Method `onConnected` is triggered whenever the WebSocket connection is established or re-established following disconnect.

### Obs 1.4: Toast Dismiss Timing in `Patient.tsx`
In `client/src/views/Patient.tsx`, lines 195–200 handle incoming coaching cue toasts:
```typescript
195:               if (type === 'kine.cue') {
196:                 const cue = customData as KineCuePayload;
197:                 const cueText = cue.text || cue.cue || 'Form Check';
198:                 setActiveToast({ id: Date.now(), text: cueText });
199:                 setTimeout(() => setActiveToast(null), 3500);
200:               }
```
- Line 199 sets a dismiss timer of `3500` ms. The requirement dictates exactly `4000` ms.

### Obs 1.5: Existing Design Tokens in `client/src/styles/tokens.css`
In `client/src/styles/tokens.css` (78 lines total):
- Section 3 (Lines 28–41):
  ```css
  /* =========================================================================
     3. Biomechanical Brand & Accent Tokens
     ========================================================================= */
  --accent-lime: #DAFE52;              /* Electric chartreuse - Active state & target */
  --accent-lime-hover: #C5EA3F;        /* Interactive press/hover state */
  --accent-lime-tint: rgba(218, 254, 82, 0.18); /* Soft glow & badge fills */
  
  --accent-lavender: #C8B6FF;          /* Secondary metric volume / Gluteal load */
  --accent-lavender-tint: rgba(200, 182, 255, 0.22);
  
  --accent-slate: #2D2F36;             /* Tertiary grouping / Posterior load */
  --accent-slate-tint: rgba(45, 47, 54, 0.12);
  ```
- Section 6 (Lines 63–74):
  ```css
  /* =========================================================================
     6. Curvature & Elevation Hierarchy
     ========================================================================= */
  --radius-outer-canvas: 2.25rem;  /* 36px - Floating main application container */
  --radius-bento-card: 1.5rem;     /* 24px - Inner Bento widgets */
  --radius-control: 1.0rem;        /* 16px - Inputs, search, small cards */
  --radius-pill: 9999px;           /* Full pill badges, primary CTA buttons */

  --shadow-canvas: 0 20px 40px -15px rgba(0, 0, 0, 0.05), 0 0 1px 1px rgba(0, 0, 0, 0.03);
  --shadow-bento: 0 4px 12px -2px rgba(0, 0, 0, 0.03);
  --shadow-glow-lime: 0 0 16px -2px rgba(218, 254, 82, 0.45);
  ```
- Currently, `--accent-cyan`, `--accent-cyan-tint`, and `--shadow-glow-cyan` are absent from `tokens.css`.

### Obs 1.6: Existing Coaching Toast Rendering in `Patient.tsx`
In `client/src/views/Patient.tsx`, lines 577–609 render the active toast notification overlay:
```tsx
577:       <AnimatePresence>
578:         {activeToast && (
579:           <motion.div
580:             key={activeToast.id}
581:             initial={{ opacity: 0, y: -24, scale: 0.95 }}
582:             animate={{ opacity: 1, y: 0, scale: 1 }}
583:             exit={{ opacity: 0, y: -20, scale: 0.95 }}
584:             transition={springPresets.snappy}
585:             style={{
586:               position: 'absolute',
587:               top: 'var(--space-4)',
588:               left: '50%',
589:               transform: 'translateX(-50%)',
590:               zIndex: 999,
591:               backgroundColor: 'var(--surface-dark-sidebar)',
592:               color: 'var(--accent-lime)',
593:               border: '2px solid var(--accent-lime)',
594:               borderRadius: 'var(--radius-pill)',
595:               padding: 'var(--space-3) var(--space-8)',
596:               boxShadow: 'var(--shadow-glow-lime)',
597:               fontWeight: 800,
598:               fontSize: '1.25rem',
599:               letterSpacing: '-0.02em',
600:               display: 'flex',
601:               alignItems: 'center',
602:               gap: 'var(--space-3)',
603:             }}
604:           >
605:             <span>📢</span>
606:             <span>{activeToast.text}</span>
607:           </motion.div>
608:         )}
609:       </AnimatePresence>
```
- Line 592: Uses `color: 'var(--accent-lime)'`.
- Line 593: Uses `border: '2px solid var(--accent-lime)'`.
- Line 596: Uses `boxShadow: 'var(--shadow-glow-lime)'`.

### Obs 1.7: Cue Dispatch & Spring Button State in `Clinician.tsx`
In `client/src/views/Clinician.tsx`:
- Lines 246–273: `handleSendCue` dispatches `kine.cue` payload with `customMsg.shouldUpdateConversation(false)` and sets a 1200ms `activeCueSent` cooldown:
  ```typescript
  246:   const handleSendCue = async (cue: CoachingCueType, text: string) => {
  247:     if (!activeSessionId) return;
  248: 
  249:     setActiveCueSent(cue);
  250:     setTimeout(() => setActiveCueSent(null), 1200);
  ...
  268:       customMsg.shouldUpdateConversation(false);
  269:       await CometChat.sendCustomMessage(customMsg);
  ...
  273:   };
  ```
- Lines 767–803: Tactile Coaching Cue Pad renders `COACHING_CUES.map`:
  ```tsx
  771:                   <motion.button
  772:                     key={cue.id}
  773:                     type="button"
  774:                     whileHover={{ scale: 1.02 }}
  775:                     whileTap={{ scale: 0.95 }}
  776:                     transition={springPresets.snappy}
  777:                     onClick={() => handleSendCue(cue.id, cue.label)}
  ...
  ```
- Spring transition uses `springPresets.snappy` (`stiffness: 420, damping: 30`) from `motionPresets.ts`.
- Tap micro-interaction uses `whileTap={{ scale: 0.95 }}`.
- Active visual state toggles based on `activeCueSent === cue.id`.

### Obs 1.8: Workspace Typecheck & Test Baseline
- Command `pnpm -r run typecheck`: Exited 0 across `shared`, `server`, and `client`.
- Command `pnpm vitest run tests/geometry.test.ts`: Passed all 21 tests in 786ms.

---

## 2. Logic Chain

### 2.1 Outbox Retry Queue Design (D5.1)
1. **Ref vs React State:**
   - As observed in Obs 1.1, `dispatchCustomRepMessage` and `dispatchCustomAlertMessage` are triggered by the pose analysis loop. Storing outbox items in React state (`useState`) would cause component re-renders during high-frequency pose detection.
   - Other runtime state machines in `Patient.tsx` (`repCounterRef`, `tokenBucketRef`, `fpsMeterRef`, `baselineRef`) are stored in `useRef`.
   - Therefore, the outbox queue must be stored in a `useRef<OutboxItem[]>([])`.

2. **Queue Data Model:**
   ```typescript
   interface OutboxItem {
     message: CometChat.CustomMessage;
     retries: number;
   }
   ```

3. **Catch & Enqueue Logic:**
   - In `dispatchCustomRepMessage` and `dispatchCustomAlertMessage`, when `CometChat.sendCustomMessage(customMsg)` rejects, instead of swallowing in an empty `catch {}`, push `{ message: customMsg, retries: 0 }` to `outboxQueueRef.current`.
   - A shared helper `sendWithOutbox(customMsg: CometChat.CustomMessage)` encapsulates this cleanly:
     ```typescript
     const sendWithOutbox = async (customMsg: CometChat.CustomMessage) => {
       try {
         await CometChat.sendCustomMessage(customMsg);
       } catch (err) {
         outboxQueueRef.current.push({ message: customMsg, retries: 0 });
       }
     };
     ```

4. **ConnectionListener & Flushing on `onConnected`:**
   - Following the CometChat MCP doc evidence (Obs 1.3), `CometChat.addConnectionListener` must be registered with a unique ID `kine-patient-outbox-${session.sessionId}` in `bootstrapPatientCall`.
   - Its `onConnected` handler triggers `flushOutboxQueue()`.
   - `flushOutboxQueue` must guard against concurrent flushing via `isFlushingRef.current`.
   - In each flush step:
     - Shift item from queue or inspect `outboxQueueRef.current[0]`.
     - Await `CometChat.sendCustomMessage(item.message)`.
     - On success: remove item (`outboxQueueRef.current.shift()`).
     - On failure: increment `item.retries += 1`. If `item.retries >= 3`, log `console.warn` and discard (`outboxQueueRef.current.shift()`). If `item.retries < 3`, halt this flush run and leave item in queue for next `onConnected`.
   - The flush loop runs asynchronously on WebSocket reconnection, completely decoupled from `requestVideoFrameCallback` (`rVFC`), guaranteeing zero frame-rate degradation.

5. **Listener Cleanup:**
   - In `callTeardownRef.current` (Obs 1.2), add:
     ```typescript
     try {
       CometChat.removeConnectionListener(connectionListenerId);
     } catch {}
     ```

### 2.2 Coaching Cue Toast & Styling Fixes (D5.2)
1. **Dismiss Timing:**
   - From Obs 1.4, line 199 has `setTimeout(() => setActiveToast(null), 3500);`.
   - Updating `3500` to `4000` satisfies Requirement R2 Gap 1 precisely.
   - To prevent overlapping toasts from clobbering timers, clear any pending `toastTimerRef.current` before scheduling the 4000ms dismiss.

2. **Semantic Design Tokens in `tokens.css`:**
   - From Obs 1.5, `tokens.css` organizes tokens into semantic categories.
   - In Section 3 (Brand & Accent Tokens), add:
     ```css
     --accent-cyan: #06B6D4;                            /* Coaching cue accent */
     --accent-cyan-tint: rgba(6, 182, 212, 0.18);       /* Coaching cue glow fill */
     ```
   - In Section 6 (Curvature & Elevation Hierarchy), add:
     ```css
     --shadow-glow-cyan: 0 0 16px -2px rgba(6, 182, 212, 0.45);
     ```

3. **Toast Styling with Zero Raw Hex Codes:**
   - From Obs 1.6, the toast currently uses `var(--accent-lime)` and `var(--shadow-glow-lime)`.
   - Replacing them with `var(--accent-cyan)` and `var(--shadow-glow-cyan)`, and wrapping the megaphone icon in a pill with `backgroundColor: 'var(--accent-cyan-tint)'`, produces a distinctive coaching cue toast without any hardcoded hex values.

4. **Clinician Cue Verification (Obs 1.7):**
   - The Clinician cue pipeline already produces conforming `KineCuePayload` messages with `shouldUpdateConversation(false)`.
   - The button uses `motion.button` with `whileTap={{ scale: 0.95 }}` and `transition={springPresets.snappy}`.
   - Cooldown state is already enforced via `activeCueSent` for 1200ms.
   - No modifications to `Clinician.tsx` are required, guaranteeing zero regressions.

---

## 3. Detailed Answers to Key DISPATCH Questions

| # | Question | Finding & Answer |
|---|---|---|
| **1** | In `Patient.tsx`, examine `dispatchCustomRepMessage` and `dispatchCustomAlertMessage` (around lines 446–476). Where are the empty `catch {}` blocks? | **Line 458–460** in `dispatchCustomRepMessage` and **Line 474–476** in `dispatchCustomAlertMessage`. Both contain empty `catch { // Non-blocking custom ... }` blocks that silently drop failed messages. |
| **2** | How is CometChat connection managed in `Patient.tsx`? How can a `CometChat.ConnectionListener` be added to flush on `onConnected`? Where should the listener be registered and cleaned up? | Session bootstrap occurs in `bootstrapPatientCall()` inside `useEffect(..., [propSessionId])` (lines 108–241). Register `CometChat.addConnectionListener(connListenerId, new CometChat.ConnectionListener({ onConnected: () => flushOutboxQueue() }))` right after login at line 133. Clean up in `callTeardownRef.current` (around line 215) using `CometChat.removeConnectionListener(connListenerId)`. |
| **3** | What is the design for the in-memory outbox queue (ref or module-level, tracking retry count up to 3, warning on discard, non-blocking to rVFC)? | Store in `const outboxQueueRef = useRef<Array<{ message: CometChat.CustomMessage; retries: number }>>([])`. On failure, push `{ message, retries: 0 }`. On `onConnected`, `flushOutboxQueue()` processes items asynchronously; on consecutive failure, `retries` increments. Discard at 3 retries with `console.warn(...)`. Runs in async WebSocket callback, never blocking rVFC. |
| **4** | In `Patient.tsx`, find the toast dismiss timer (around line 199). What is the exact line and code to change 3500ms to 4000ms? | **Line 199:** Change `setTimeout(() => setActiveToast(null), 3500);` to `setTimeout(() => setActiveToast(null), 4000);`. |
| **5** | In `client/src/styles/tokens.css`, where should `--accent-cyan`, `--accent-cyan-tint`, and `--shadow-glow-cyan` be placed? | Place `--accent-cyan: #06B6D4;` and `--accent-cyan-tint: rgba(6, 182, 212, 0.18);` in Section 3 ("Biomechanical Brand & Accent Tokens") after line 39. Place `--shadow-glow-cyan: 0 0 16px -2px rgba(6, 182, 212, 0.45);` in Section 6 ("Curvature & Elevation Hierarchy") after line 73. |
| **6** | In `Patient.tsx`, how is the coaching cue toast currently styled and rendered? How to update it to use the new tokens with zero raw hex codes? | Currently rendered in lines 577–609 with `color: 'var(--accent-lime)'`, `border: '2px solid var(--accent-lime)'`, `boxShadow: 'var(--shadow-glow-lime)'`. Update to `color: 'var(--accent-cyan)'`, `border: '2px solid var(--accent-cyan)'`, `boxShadow: 'var(--shadow-glow-cyan)'`, with optional icon fill using `var(--accent-cyan-tint)`. 100% tokenized. |
| **7** | Verify `Clinician.tsx` cue dispatch and spring buttons to confirm no regressions will be introduced. | Confirmed: `handleSendCue` (lines 246–273) sends `KineCuePayload` with `shouldUpdateConversation(false)` and 1200ms cooldown. Buttons (lines 771–801) use `whileTap={{ scale: 0.95 }}` and `transition={springPresets.snappy}`. No code edits needed in `Clinician.tsx`, guaranteeing zero regressions. |

---

## 4. Implementation Plan & Proposed Code Diffs

### 4.1 Plan for Milestone D5.1 (`Patient.tsx`)

#### Step 1: Add Queue Types and Refs (Lines 94–104)
```typescript
interface OutboxItem {
  message: CometChat.CustomMessage;
  retries: number;
}

// Inside Patient component:
const outboxQueueRef = useRef<OutboxItem[]>([]);
const isFlushingOutboxRef = useRef<boolean>(false);
```

#### Step 2: Add `flushOutboxQueue` and `sendWithOutbox` helpers
```typescript
const flushOutboxQueue = async () => {
  if (isFlushingOutboxRef.current || outboxQueueRef.current.length === 0) return;
  isFlushingOutboxRef.current = true;

  try {
    while (outboxQueueRef.current.length > 0) {
      const item = outboxQueueRef.current[0];
      try {
        await CometChat.sendCustomMessage(item.message);
        outboxQueueRef.current.shift();
      } catch (err) {
        item.retries += 1;
        if (item.retries >= 3) {
          console.warn(
            `[KinesioOutbox] Discarded custom message after 3 failed retries (type: ${item.message.getType()}):`,
            err
          );
          outboxQueueRef.current.shift();
        } else {
          // Socket still down; wait for subsequent onConnected
          break;
        }
      }
    }
  } finally {
    isFlushingOutboxRef.current = false;
  }
};

const sendWithOutbox = async (customMsg: CometChat.CustomMessage) => {
  try {
    await CometChat.sendCustomMessage(customMsg);
  } catch (err) {
    outboxQueueRef.current.push({ message: customMsg, retries: 0 });
  }
};
```

#### Step 3: Register `ConnectionListener` in `bootstrapPatientCall`
```typescript
const connListenerId = `kine-patient-conn-${session.sessionId}`;
CometChat.addConnectionListener(
  connListenerId,
  new CometChat.ConnectionListener({
    onConnected: () => {
      flushOutboxQueue();
    },
    inConnecting: () => {},
    onDisconnected: () => {},
  })
);
```
And in `callTeardownRef.current`:
```typescript
try {
  CometChat.removeConnectionListener(connListenerId);
} catch {
  // Ignore
}
```

#### Step 4: Refactor `dispatchCustomRepMessage` and `dispatchCustomAlertMessage` (Lines 446–476)
```typescript
const dispatchCustomRepMessage = async (repPayload: KineRepPayload) => {
  if (!activeSessionId) return;
  const customMsg = new CometChat.CustomMessage(
    activeSessionId,
    CometChat.RECEIVER_TYPE.GROUP,
    'kine.rep',
    repPayload as unknown as Record<string, unknown>
  );
  customMsg.shouldUpdateConversation(false);
  await sendWithOutbox(customMsg);
};

const dispatchCustomAlertMessage = async (alertPayload: KineAlertPayload) => {
  if (!activeSessionId) return;
  const customMsg = new CometChat.CustomMessage(
    activeSessionId,
    CometChat.RECEIVER_TYPE.GROUP,
    'kine.alert',
    alertPayload as unknown as Record<string, unknown>
  );
  customMsg.shouldUpdateConversation(false);
  await sendWithOutbox(customMsg);
};
```

---

### 4.2 Plan for Milestone D5.2 (`tokens.css` & `Patient.tsx`)

#### Step 1: Add Tokens in `client/src/styles/tokens.css`
In Section 3:
```css
  --accent-cyan: #06B6D4;                            /* Coaching cue accent */
  --accent-cyan-tint: rgba(6, 182, 212, 0.18);       /* Coaching cue glow fill */
```
In Section 6:
```css
  --shadow-glow-cyan: 0 0 16px -2px rgba(6, 182, 212, 0.45);
```

#### Step 2: Update Toast Dismiss Timer in `Patient.tsx` Line 199
```typescript
if (type === 'kine.cue') {
  const cue = customData as KineCuePayload;
  const cueText = cue.text || cue.cue || 'Form Check';
  setActiveToast({ id: Date.now(), text: cueText });
  setTimeout(() => setActiveToast(null), 4000);
}
```

#### Step 3: Update Toast Styling in `Patient.tsx` Lines 585–607
```tsx
      <AnimatePresence>
        {activeToast && (
          <motion.div
            key={activeToast.id}
            initial={{ opacity: 0, y: -24, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            transition={springPresets.snappy}
            style={{
              position: 'absolute',
              top: 'var(--space-4)',
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 999,
              backgroundColor: 'var(--surface-dark-sidebar)',
              color: 'var(--accent-cyan)',
              border: '2px solid var(--accent-cyan)',
              borderRadius: 'var(--radius-pill)',
              padding: 'var(--space-3) var(--space-8)',
              boxShadow: 'var(--shadow-glow-cyan)',
              fontWeight: 800,
              fontSize: '1.25rem',
              letterSpacing: '-0.02em',
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-3)',
            }}
          >
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 'var(--space-0-5) var(--space-1)',
                borderRadius: 'var(--radius-pill)',
                backgroundColor: 'var(--accent-cyan-tint)',
              }}
            >
              📢
            </span>
            <span>{activeToast.text}</span>
          </motion.div>
        )}
      </AnimatePresence>
```

---

## 5. Caveats
1. **Network Simulation in Vitest:** Testing `CometChat.ConnectionListener` and live WebSocket reconnects in unit tests requires either mocked WebSocket events or integration testing. For unit tests of the outbox logic, mock `CometChat.sendCustomMessage` with rejected promises.
2. **Multiple Session Remounts:** To avoid stale queue items across completely distinct sessions if the component is kept mounted with changing session props, clear `outboxQueueRef.current = []` when `sessionId` changes.
3. **No Changes to Clinician Needed:** The clinician interface is fully verified and requires zero code alterations for D5.1/D5.2.

---

## 6. Conclusion
The codebase is clean, well-structured, and ready for surgical implementation of D5.1 and D5.2:
- D5.1 replaces the two empty `catch {}` blocks at lines 458 and 474 of `Patient.tsx` with a non-blocking `useRef`-held outbox queue flushed by `CometChat.ConnectionListener.onConnected`.
- D5.2 adds 3 tokens to `tokens.css`, changes line 199 from `3500` to `4000`, and replaces the lime toast tokens with the new cyan tokens without any raw hex codes.
- No changes are needed in `Clinician.tsx`.

---

## 7. Verification Method

1. **Typecheck:**
   ```powershell
   pnpm -r run typecheck
   ```
   Must exit with code 0 across `shared`, `server`, and `client`.

2. **Automated Unit Tests:**
   ```powershell
   pnpm vitest run tests/geometry.test.ts
   ```
   Must pass with 0 failures.

3. **Code Inspection Check:**
   - Verify `tokens.css` contains `--accent-cyan`, `--accent-cyan-tint`, `--shadow-glow-cyan`.
   - Verify `Patient.tsx` contains `setTimeout(..., 4000)` and no empty `catch {}` in dispatch functions.
   - Verify `Patient.tsx` toast styling contains zero `#` hex codes.
