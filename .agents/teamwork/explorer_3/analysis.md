# Investigation Analysis Report — Explorer 3
**Topic:** Micro-Interaction Polish & Documentation Ground Truth (Phase 5)  
**Date:** 2026-10-04  
**Author:** Explorer 3 (`.agents/teamwork/explorer_3/`)  

---

## Executive Summary
This report establishes the ground truth across the 6 areas designated for Explorer 3:
1. **Patient Rep Counter Spring Pop:** Located in `client/src/views/Patient.tsx` (not `client/src/Patient.tsx`). String `scale: [1.35` is absent. `motion` and `springPresets` are already imported. The rep counter element is at lines 916–930.
2. **Global CSS & Focus Rings:** Entry CSS is `client/src/index.css` (imported via `main.tsx`). `:focus-visible` is absent. `--accent-lime` and `--radius-control` are declared in `client/src/styles/tokens.css` and imported into `index.css`.
3. **Clinician Valgus Alert Pulse:** Located in `client/src/views/Clinician.tsx` (not `client/src/Clinician.tsx`). String `repeat: Infinity` is absent. `isValgusAlert` banner is at lines 417–456.
4. **Architecture Diagram:** Extracted verbatim from `docs/trd.md` lines 12–42.
5. **CometChat MCP Integration Evidence:** Confirmed 24 verified MCP tool calls and 5 core primitives in `COMETCHAT_INTEGRATION.md`.
6. **Demo Pre-Flight Checklist:** Verified structure, 84s pacing schedule (6s safety buffer), and pre-recording checklist for `docs/demo_preflight.md`.

---

## 1. Rep Badge Spring Pop (`Patient.tsx`)

### 1.1 Path Resolution & Current Imports
- **Actual File Path:** `client/src/views/Patient.tsx` (the project groups views in `client/src/views/`).
- **Target String `scale: [1.35`:** **ABSENT** in `client/src/views/Patient.tsx`.
- **Existing Imports:**
  - Line 34: `import { motion, AnimatePresence } from 'framer-motion';`
  - Line 64: `import { springPresets } from '../styles/motionPresets';`
  - Both required dependencies are already present and imported.

### 1.2 Current JSX Implementation (Lines 915–934)
```tsx
<div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--space-3)' }}>
  <motion.span
    key={repBadgeKeyRef.current}
    initial={{ scale: 0.8 }}
    animate={{ scale: 1 }}
    transition={springPresets.snappy}
    style={{
      fontSize: '3.5rem',
      fontWeight: 900,
      letterSpacing: '-0.03em',
      color: 'var(--accent-lime)',
      lineHeight: 1,
    }}
  >
    {repCount}
  </motion.span>
  <span style={{ fontSize: '0.9375rem', color: 'var(--text-on-dark-muted)' }}>
    validated reps
  </span>
</div>
```

### 1.3 Analysis & Recommended Diff
- The current implementation keys the `motion.span` with `repBadgeKeyRef.current`. However, mutating a `useRef` value does not trigger a React render cycle.
- Per Requirement R7 Check 1, the counter must key on `repCount` and animate `scale: [1.35, 1]` with `springPresets.snappy`.
- **Proposed Code Snippet (Target: `client/src/views/Patient.tsx:916–930`):**
```tsx
<motion.span
  key={repCount}
  animate={{ scale: [1.35, 1] }}
  transition={springPresets.snappy}
  style={{
    fontSize: '3.5rem',
    fontWeight: 900,
    letterSpacing: '-0.03em',
    color: 'var(--accent-lime)',
    lineHeight: 1,
  }}
>
  {repCount}
</motion.span>
```

---

## 2. Global CSS & Focus Rings

### 2.1 Entry Point Inspection
- `client/index.html` loads `<script type="module" src="/src/main.tsx"></script>`.
- `client/src/main.tsx` imports `import './index.css';` at line 4.
- `client/src/index.css` imports `@import './styles/tokens.css';` at line 1.

### 2.2 Token Declarations
- **`--accent-lime`:** Defined in `client/src/styles/tokens.css:31`:
  ```css
  --accent-lime: #DAFE52; /* Electric chartreuse - Active state & target */
  ```
- **`--radius-control`:** Defined in `client/src/styles/tokens.css:71`:
  ```css
  --radius-control: 1.0rem; /* 16px - Inputs, search, small cards */
  ```
- Both tokens are actively used throughout `client/src/index.css`.

### 2.3 Status of `:focus-visible`
- Search across `client/src/index.css` and the entire `client/` directory confirms `:focus-visible` is **ABSENT**.
- **Proposed Addition (Appended to `client/src/index.css`):**
```css
:focus-visible {
  outline: 2px solid var(--accent-lime);
  outline-offset: 2px;
  border-radius: var(--radius-control);
}
```
- This satisfies WCAG 2.1 AA focus-state requirements without hardcoding hex values.

---

## 3. Valgus Alert Pulse (`Clinician.tsx`)

### 3.1 Path Resolution & Current Implementation
- **Actual File Path:** `client/src/views/Clinician.tsx`.
- **Target String `repeat: Infinity`:** **ABSENT** in `Clinician.tsx`.
- **Alert State Logic (Lines 316–318):**
  ```tsx
  const isValgusAlert =
    (currentPose?.valgusDevPct.L !== null && (currentPose?.valgusDevPct.L ?? 0) > VALGUS_THRESHOLD_PCT) ||
    (currentPose?.valgusDevPct.R !== null && (currentPose?.valgusDevPct.R ?? 0) > VALGUS_THRESHOLD_PCT);
  ```
- **Current Alert Banner (Lines 416–456):**
  ```tsx
  {/* Valgus Form Warning Banner */}
  {isValgusAlert && (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      style={{
        padding: 'var(--space-3) var(--space-4)',
        borderRadius: 'var(--radius-control)',
        backgroundColor: 'rgba(239, 68, 68, 0.12)',
        border: '1px solid var(--status-critical)',
        color: 'var(--status-critical)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        fontSize: '0.875rem',
        fontWeight: 600,
      }}
    >
      <span>
        ⚠️ <strong>Biomechanical Alert:</strong> Knee valgus collapse detected (&gt; 8.0% deviation).
        Prompt patient with "Knees Out".
      </span>
      <button
        type="button"
        onClick={() => handleSendCue('knees_out', 'Knees Out!')}
        style={{
          padding: 'var(--space-1) var(--space-3)',
          borderRadius: 'var(--radius-pill)',
          border: 'none',
          backgroundColor: 'var(--status-critical)',
          color: 'var(--text-on-dark-primary)',
          fontSize: '0.75rem',
          fontWeight: 700,
          cursor: 'pointer',
        }}
      >
        Send "Knees Out" Cue
      </button>
    </motion.div>
  )}
  ```

### 3.2 Recommended Modification
- Wrap or update the `motion.div` animation to include infinite pulsing when alert is active.
- **Proposed Replacement for Lines 418–422:**
```tsx
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={isValgusAlert ? { opacity: [1, 0.65, 1], y: 0 } : { opacity: 1, y: 0 }}
      transition={isValgusAlert ? { repeat: Infinity, duration: 1.2, ease: 'easeInOut' } : {}}
      exit={{ opacity: 0, y: -10 }}
```
- No hardcoded hex values or raw colors introduced. Uses semantic tokens.

---

## 4. Architecture Diagram (`docs/trd.md`)

Extracted verbatim from `docs/trd.md` §1 (lines 12–42) for insertion into `README.md`:

```
+----------------------------------------------------------------------------------------------------+
|                                    KINESIOLIVE RUNTIME TOPOLOGY                                    |
+----------------------------------------------------------------------------------------------------+
|   Browser 1: Patient (Chrome Profile 1)                   Browser 2: Clinician (Chrome Profile 2)  |
|   - MediaPipe Pose Landmarker (GPU/Lite)                  - CometChat Calls v5 Video Display       |
|   - 2D/3D Biomechanics Math Engine                       - Real-Time Biomechanics HUD             |
|   - Canvas Skeleton Overlay                               - Coaching Cue Trigger Buttons           |
|   - Token Bucket Rate Limiter (10 Hz)                     - Presence & Status Watcher              |
|              |                                                         |                           |
|              +----------------------------+----------------------------+                           |
|                                           |                                                        |
|                 Transient (10Hz) & Custom Persisted Messages / WebRTC Calls                         |
|                                           v                                                        |
|                         +-----------------------------------+                                      |
|                         |      COMETCHAT CLOUD PLATFORM     |                                      |
|                         | - Calls SDK v5 (WebRTC Media)     |                                      |
|                         | - Chat SDK v4 (Message Bus)       |                                      |
|                         | - Group Storage (kine-<sessionId>)|                                      |
|                         +-----------------+-----------------+                                      |
|                                           ^                                                        |
|                                           | REST API (Server Auth Only)                            |
|                                           v                                                        |
|                         +-----------------------------------+                                      |
|                         |   EXPRESS BACKEND (Node.js 22)    |                                      |
|                         | - POST /api/session               |                                      |
|                         | - GET  /api/health                |                                      |
|                         | - Static Host for React Web App   |                                      |
|                         +-----------------------------------+                                      |
+----------------------------------------------------------------------------------------------------+
```

---

## 5. CometChat MCP Integration Evidence (`COMETCHAT_INTEGRATION.md`)

### 5.1 Verification Status
- **File Length:** 69 lines.
- **Section 2 Table:** Exactly 24 executed tool calls (rows 1 to 24).
- **Tools Executed:**
  1. `list_cometchat_bundles` (Call #1)
  2. `get_cometchat_implementation_bundle` (Calls #2, #3)
  3. `search_cometchat_docs` (Calls #12, #16, #20)
  4. `fetch_cometchat_doc_page` (Calls #4–#11, #13–#15, #17–#19, #21–#24)

### 5.2 Primitive Mapping
| CometChat Primitive | SDK / API Method | Where Used in KinesioLive |
|---|---|---|
| Calls SDK v5 | `CometChatCalls.joinSession(callToken, settings, container)` | WebRTC peer video connection in Patient and Clinician studios |
| Transient Messages | `CometChat.sendTransientMessage(new TransientMessage(guid, GROUP, ...))` | 10 Hz fire-and-forget kinematic pose telemetry stream |
| Custom Messages | `CometChat.sendCustomMessage(new CustomMessage(guid, GROUP, 'kine.*', ...))` | Persisted exercise events (`kine.rep`, `kine.alert`, `kine.cue`, `kine.session`) |
| Group Message History | `new CometChat.MessagesRequestBuilder().setGUID(guid).setCategories(['custom']).build().fetchPrevious()` | Workout summary card aggregation and audit logging |
| REST Auth Token API | `POST /v3/users/{uid}/auth_tokens` with REST API key | Backend `/api/session` endpoint — browser never sees Auth Key |

---

## 6. Demo Pre-Flight Requirements (`docs/demo_preflight.md`)

### 6.1 Target File Status
- Currently **does not exist** on disk. Must be created under `docs/demo_preflight.md`.

### 6.2 Pre-Flight Checklist Components
1. **Environment Warming (5m before recording):**
   - Health check: `curl https://kinesiolive.onrender.com/api/health` -> `{"status":"ok",...}`.
2. **Profile Isolation:**
   - Chrome Profile A (Patient): `https://kinesiolive.onrender.com/?role=patient`.
   - Chrome Profile B (Clinician): `https://kinesiolive.onrender.com/?role=clinician`.
   - Camera permissions granted on both tabs.
3. **Session Linkage:**
   - Clinician copies invite link and pastes session ID to Patient.
   - Patient skeleton canvas overlay renders, rep count initializes to 0.
   - Clinician verifies "Patient in Session: Active" presence indicator.

### 6.3 Pacing Schedule Table (84s Target + 6s Safety Buffer = 90s)
| Time | Screen | Action | Narration Focus |
|---|---|---|---|
| 00:00–00:08 | IDE / Console | Show `COMETCHAT_INTEGRATION.md` with MCP calls | MCP-first verified development |
| 00:08–00:18 | Split Screen | Patient joins -> Clinician presence flips to Active | Calls v5 session establishment |
| 00:18–00:32 | HUDs | 2 clean squats performed -> real-time angle display | 10 Hz transient pose telemetry |
| 00:32–00:48 | Clinician HUD | Inward knee cave -> valgus alert triggers (+11.2%) | Custom message alert with measured deviation |
| 00:48–01:08 | Both Screens | Clinician clicks "Knees Out" -> Patient toast -> form corrected | Real-time coaching cue loop |
| 01:08–01:24 | Summary View | Clinician clicks "End Session" -> Summary bento card | Group history as persistent exercise log |

### 6.4 Submission Tweet Template
Must be provided ready-to-post with `#ZeroToChat` and `@CometChat` tags.
