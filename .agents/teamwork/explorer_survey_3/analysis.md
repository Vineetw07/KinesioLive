# KinesioLive Phase 3 Technical Survey & Architecture Analysis
**Milestones Covered:** D4.2 (Design Tokens & Shell), D4.3 (Patient Studio), D4.4 (Clinician Studio), D4.5 (Session Guard & Deep-Linking)  
**Surveyor:** Explorer Agent (Phase 3 Survey)  
**Date:** 2026-10-04  
**Status:** Complete Read-Only Architectural Survey & Implementation Plan

---

## 1. Executive Summary & Context

Phase 3 transitions KinesioLive from headless math/spike algorithms into a cohesive, production-grade dual-profile tele-rehabilitation application. In this phase:
- **Design Tokens & Motion Presets (D4.2):** Establishes the Floating Island Bento Canvas visual system, enforcing zero raw hex codes, strict 8pt rhythm, and spring physics.
- **Patient Studio View (D4.3):** Implements `client/src/views/Patient.tsx`, mounting CometChat Calls v5 video (`startAudioMuted: false`), tapping frames without camera contention via `requestVideoFrameCallback`, running MediaPipe pose inference, rendering a 2D canvas skeleton overlay, optimistically updating local HUD, and streaming 10 Hz rate-capped transient pose packets (`kine.pose`) plus persisted events (`kine.rep`, `kine.alert`).
- **Clinician Studio View (D4.4):** Implements `client/src/views/Clinician.tsx`, mounting Calls v5 with strictly **`startAudioMuted: true`** to eliminate acoustic feedback, consuming 10 Hz transient pose packets via `useTelemetryStream.ts`, interpolating telemetry into silky 60 fps UI motion via Framer Motion `useSpring` dampers, rendering a live telemetry HUD, providing 4 tactile coaching cue buttons (`kine.cue`), and supporting session controls.
- **Session Guard & Deep-Linking (D4.5):** Implements `client/src/utils/sessionGuard.ts` to parse `?role=clinician|patient&session=<sessionId>`, detect active CometChat UID conflicts, and display a non-destructive blocking modal without ever calling `CometChat.logout()` automatically.
- **Test Matrix & Mock Architecture:** Expands `tests/mocks/chat-sdk.ts` with transient messaging and listener mechanics, and defines automated test suites to verify dual-profile interaction, 10 Hz rate-limiting, valgus 4.0s cooldowns, and session guard routing.

---

## 2. Design System & Tokens (Milestone D4.2)

### 2.1 Specification Review: `docs/frontend_architecture_spec.md §2.1` & `§5.1`

#### Tokens Inventory (`client/src/styles/tokens.css`)
Currently, `client/src/styles/` does **not** exist. Only a legacy `client/src/index.css` exists with basic dark-mode tokens (`--bg-primary`, `--bg-surface`, etc.). The spec mandates the following canonical tokens in `:root`:

1. **Surface & Canvas Tokens:**
   - `--surface-app-frame: #F4F6EA;` — Soft ambient backdrop outside canvas (warm alabaster/chartreuse frame)
   - `--surface-canvas: #FFFFFF;` — Primary floating island canvas
   - `--surface-canvas-subtle: #F9FAFB;` — Secondary card background
   - `--surface-border-subtle: #F0F1F5;` — 1px structural dividing lines
   - `--surface-border-strong: #E5E7EB;` — Form controls & search borders
   - `--surface-dark-sidebar: #131417;` — High-contrast left navigation bar (obsidian)
   - `--surface-dark-card: #18191C;` — Inverted bottom-right anchor bento tile
   - `--surface-dark-card-border: #26282E;` — Border on dark surfaces
   - `--surface-dark-card-hover: #222429;` — Elevated hover state for dark components

2. **Typography & Contrast Tokens (WCAG 2.1 AA Compliant):**
   - `--text-primary: #111827;` — Primary metric & heading text (14:1 contrast on white)
   - `--text-secondary: #4B5563;` — Secondary metrics & captions (5.4:1 contrast)
   - `--text-muted: #6B7280;` — Timestamps and helper text (4.6:1 contrast)
   - `--text-disabled: #9CA3AF;` — Disabled control text
   - `--text-on-dark-primary: #F9FAFB;` — High-contrast text on obsidian/dark surfaces
   - `--text-on-dark-secondary: #94A3B8;` — Muted labels on dark surfaces
   - `--text-on-dark-muted: #64748B;` — Secondary captions on dark surfaces

3. **Biomechanical Brand & Accent Tokens:**
   - `--accent-lime: #DAFE52;` — Electric chartreuse (active state, primary CTA, target pill)
   - `--accent-lime-hover: #C5EA3F;` — Interactive press/hover state
   - `--accent-lime-tint: rgba(218, 254, 82, 0.18);` — Glow & badge fills
   - `--accent-lavender: #C8B6FF;` — Secondary metric volume / muscle load
   - `--accent-lavender-tint: rgba(200, 182, 255, 0.22);`
   - `--accent-slate: #2D2F36;` — Grouping / load accent
   - `--accent-slate-tint: rgba(45, 47, 54, 0.12);`

4. **Biomechanical Health State Tokens:**
   - `--status-stable: #10B981;` — Normal alignment (< 8% valgus)
   - `--status-warning: #F59E0B;` — Mild form deviation (8–12% valgus)
   - `--status-critical: #EF4444;` — Form breakdown alert (> 12% valgus or persistent > 8%)
   - `--status-lost: #6B7280;` — Tracking dropout / visibility < 0.65

5. **Spatial Rhythm (Strict 8pt Scale):**
   - `--space-0-5: 0.125rem;` (2px)
   - `--space-1: 0.25rem;` (4px)
   - `--space-2: 0.5rem;` (8px)
   - `--space-3: 0.75rem;` (12px)
   - `--space-4: 1.0rem;` (16px)
   - `--space-5: 1.25rem;` (20px)
   - `--space-6: 1.5rem;` (24px)
   - `--space-8: 2.0rem;` (32px)
   - `--space-10: 2.5rem;` (40px)
   - `--space-12: 3.0rem;` (48px)

6. **Curvature & Shadows:**
   - `--radius-outer-canvas: 2.25rem;` (36px — Floating island canvas)
   - `--radius-bento-card: 1.5rem;` (24px — Inner bento widgets)
   - `--radius-control: 1.0rem;` (16px — Buttons, inputs)
   - `--radius-pill: 9999px;` (Full pill badges)
   - `--shadow-canvas: 0 20px 40px -15px rgba(0, 0, 0, 0.05), 0 0 1px 1px rgba(0, 0, 0, 0.03);`
   - `--shadow-bento: 0 4px 12px -2px rgba(0, 0, 0, 0.03);`
   - `--shadow-glow-lime: 0 0 16px -2px rgba(218, 254, 82, 0.45);`

#### Motion Presets (`client/src/styles/motionPresets.ts`)
Conforming to Motion.dev & Watermelon UI spring physics:
```typescript
import { Transition } from "framer-motion";

export const springPresets = {
  /** Snappy micro-interactions (buttons, pills, toggle switches) */
  snappy: {
    type: "spring",
    stiffness: 420,
    damping: 30,
  } as Transition,

  /** Fluid layout animations (cards, bento tiles, navigation sliders) */
  layout: {
    type: "spring",
    stiffness: 300,
    damping: 28,
  } as Transition,

  /** Gentle entry transitions (modals, dropdown popovers, tooltips) */
  gentle: {
    type: "spring",
    stiffness: 200,
    damping: 24,
  } as Transition,

  /** 10Hz Telemetry Value Damper (smoothing raw coordinates into 60fps movement) */
  telemetry: {
    type: "spring",
    stiffness: 140,
    damping: 18,
  } as Transition,
};
```

### 2.2 Floating Island Bento Canvas Layout Constraints
- Viewport shell background is strictly `var(--surface-app-frame)` (`#F4F6EA`).
- Dark Navigation Sidebar: `var(--surface-dark-sidebar)` (`#131417`), docked on the left, host to the animated sliding active pill (`layoutId="activeNavigationPill"`).
- Elevated Canvas Island: `var(--surface-canvas)` (`#FFFFFF`), `border-radius: var(--radius-outer-canvas)` (36px), with `var(--shadow-canvas)`.
- **Zero Raw Hex Code Enforcement:** All components must use `var(--...)` tokens. Static audits via regex or linter must confirm 0 raw hex strings (`#[0-9a-fA-F]{3,8}`) in `client/src/views/` or `client/src/components/`.

---

## 3. Clinician & Patient Studio Views (Milestones D4.3, D4.4)

### 3.1 Patient Studio (`client/src/views/Patient.tsx`)

#### Architectural Responsibilities:
1. **WebRTC Call Mount:**
   - Obtains session credentials via `POST /api/session` (`role: "patient"`).
   - Initializes Chat SDK v4 and Calls SDK v5 (using patterns proven in Spike S3).
   - Joins session container with `startAudioMuted: false`.
2. **Camera Contention Defense:**
   - Does **not** request a secondary `getUserMedia` stream.
   - Accesses the DOM `<video>` element created by Calls SDK in the mount container.
   - Taps video frames using `requestVideoFrameCallback` with `requestAnimationFrame` fallback (proven in Spike S1 `startVideoPosePipeline`).
3. **In-Browser Vision & Biomechanics Pipeline:**
   - Initializes MediaPipe `PoseLandmarker` in `VIDEO` mode (GPU delegate with CPU fallback).
   - Extracts 2D `landmarks` and 3D metric `worldLandmarks`.
   - Baseline calibration: Upon mount or when user clicks "Calibrate Baseline", captures standing landmarks to generate `StandingBaseline` via `calibrateStandingBaseline`.
   - Angular and valgus calculations:
     - 3D sagittal knee flexion angle: `compute3DKneeFlexion(hip3D, knee3D, ankle3D)`.
     - Frontal knee valgus deviation %: `computeValgusDeviation(hip2D, knee2D, ankle2D, baseline, side)` with unmirrored camera polarity (Left: $-1$, Right: $+1$).
     - Pelvic depth ratio: `computeDepthRatio(hipY, baseline)`.
   - Feeds frame into `RepCounterStateMachine.update(...)`.
4. **Canvas 2D Skeleton Overlay:**
   - Mounts `<canvas>` overlay on top of video element with identical dimensions.
   - Renders 33-point BlazePose skeleton with cyan bones.
   - Highlights lower-body joints (23–28) in green (`var(--status-stable)`) or red (`var(--status-critical)`) if valgus $> 8.0\%$.
5. **Optimistic Local HUD:**
   - Displays real-time knee angles, depth ratio meter, squat phase badge, and completed rep badge.
   - Badge spring pop on rep increment using `springPresets.snappy`.
6. **Real-Time Transmission (Transient & Custom):**
   - Throttles pose telemetry to 10 Hz using `TelemetryTokenBucket`.
   - Sends `kine.pose` via `CometChat.sendTransientMessage(new CometChat.TransientMessage(sessionId, CometChat.RECEIVER_TYPE.GROUP, payload))`.
   - When rep is validated by `RepCounterStateMachine`, dispatches `kine.rep` via `CometChat.sendCustomMessage`.
   - When valgus deviation $> 8.0\%$ persists for $\ge 3$ consecutive frames during `descending` or `bottom`, `RepCounterStateMachine` emits an alert honoring the independent 4000 ms cooldown. Dispatches `kine.alert` via `CometChat.sendCustomMessage`.
7. **Clinician Coaching Cue Listener:**
   - Registers CometChat message listener capturing `kine.cue` custom messages.
   - Renders high-visibility animated toast cue on the patient screen (e.g. "Knees Out!", "Slow Down") that automatically dismisses after 3 seconds.

### 3.2 Clinician Studio (`client/src/views/Clinician.tsx`)

#### Architectural Responsibilities:
1. **WebRTC Call Mount with Mandatory Audio Mute:**
   - Obtains session credentials via `POST /api/session` (`role: "clinician"`).
   - Mounts Calls v5 session into container.
   - **CRITICAL INVARIANT:** Must strictly pass `startAudioMuted: true` in `SessionSettings` to prevent severe acoustic feedback loops during local testing or demo presentations.
   - Renders remote patient video feed.
2. **Decoupled Telemetry Consumer Hook (`client/src/hooks/useTelemetryStream.ts`):**
   - Subscribes to CometChat transient message listener on group `sessionId`.
   - Implements 100ms throttle bucket to guard against packet floods.
   - Validates envelope and payload schema (`type === 'kine.pose'`).
   - Exposes `{ currentPose, isConnected, error }`.
3. **useSpring Damping (10 Hz to 60 fps):**
   - Discrete 10 Hz telemetry updates cause DOM visual stuttering if bound directly to progress bars or gauges.
   - Framer Motion `useSpring(motionValue, springPresets.telemetry)` provides continuous 60 fps interpolation between 100ms samples:
     - Left knee flexion spring: `useSpring(kneeMotionL, springPresets.telemetry)`
     - Right knee flexion spring: `useSpring(kneeMotionR, springPresets.telemetry)`
     - Depth ratio spring: `useSpring(depthMotion, springPresets.telemetry)`
     - Valgus deviation spring: `useSpring(valgusMotion, springPresets.telemetry)`
4. **Live Telemetry HUD:**
   - Displays bilateral knee flexion angles ($\theta_L, \theta_R$), pelvic depth ratio gauge, inference FPS, and squat phase badge (`standing`, `descending`, `bottom`, `ascending`, `lost`).
   - Form alert banner: High-visibility warning flashes when valgus exceeds 8.0%.
5. **Tactile Coaching Cue Pad:**
   - 4 action buttons: `["Knees Out", "Slow Down", "Chest Up", "Good Depth"]`.
   - On click: triggers spring press animation (`whileTap={{ scale: 0.95 }}`) and sends `kine.cue` via `CometChat.sendCustomMessage(sessionId, RECEIVER_TYPE.GROUP, 'kine.cue', payload)`.
   - Marks message with `shouldUpdateConversation(false)`.
6. **Session Controls:**
   - "Copy Patient Invite Link": copies `${window.location.origin}/?role=patient&session=${sessionId}` to clipboard with visual confirmation tooltip.
   - "End Session": emits `kine.session` marker (`action: "end"`).

### 3.3 The 4-State UI Lifecycle Matrix

Every studio container component must explicitly handle the 4 lifecycle states defined in `docs/frontend_architecture_spec.md §7`:

| State | Visual Representation | Implementation |
|---|---|---|
| **1. Loading** | Pulsing skeleton placeholder (`rounded-[24px]`, shimmer background) | Displayed while connecting to `/api/session`, initializing SDKs, or waiting for WebRTC media connection. |
| **2. Empty** | Informative prompt with action | Displayed in Clinician view when connected to call but no patient pose telemetry is active ("Waiting for patient camera stream..."). |
| **3. Error** | Non-blocking inline banner with retry action | Displayed if token minting fails, WebRTC connection drops, or permissions are denied. Includes a "Retry Connection" button. |
| **4. Success** | Full interactive studio with live video, 60 fps telemetry HUD, and cue controls | Normal operational state. |

---

## 4. Session Guard & Deep-Linking (Milestone D4.5)

### 4.1 Specification: `client/src/utils/sessionGuard.ts`

The application supports direct deep-linking via query parameters:
`?role=clinician&session=<sessionId>` or `?role=patient&session=<sessionId>`.

#### 1. Query Parameter Parsing
- Parses `window.location.search`.
- Role extraction: Validates if `role` is `'clinician'` or `'patient'`. If invalid or absent, returns `role: null` and allows role selection.
- Session extraction: Extracts `session` parameter string (e.g. `kine-station-1`). If absent, returns `sessionId: null` (triggers auto-generation on connect).

#### 2. Active CometChat UID Conflict Detection
- In Chromium browsers, CometChat stores the authenticated user session in `localStorage`.
- Expected UID:
  - If requested role is `'clinician'` $\to$ expected UID is `'dr-demo'` (`CLINICIAN_UID`).
  - If requested role is `'patient'` $\to$ expected UID is `'pt-demo'` (`PATIENT_UID`).
- On app bootstrap, inspects `await CometChat.getLoggedinUser()`:
  - If active user UID exists and `activeUser.getUid() !== expectedUid`: **Conflict Detected!**

#### 3. Strict Non-Destructive Conflict Resolution
- **MANDATORY INVARIANT:** **NEVER call `CometChat.logout()` automatically!**
  - Calling `CometChat.logout()` destroys `localStorage` for the origin, which immediately terminates active sessions in any other tab running in the same browser profile.
- When conflict is detected:
  - Halts studio mount and renders `RoleConflictModal`:
    - **Message:** *"Session Role Mismatch: This browser profile is already logged in as **{currentUid}**, but this link requests the role of **{requestedRole} ({expectedUid})**."*
    - **Notice:** *"For dual-role testing on the same machine, please open the Patient link in a separate Chrome Profile or an Incognito window."*
    - **Actions:**
      1. *"Continue as {currentRole}"* — ignores requested URL role and keeps current session.
      2. *"Switch to {requestedRole} (Explicit Logout)"* — only if the user explicitly confirms switching in this specific tab, calls `CometChat.logout()`, then proceeds with login.

---

## 5. Test Matrix & Mock Architecture

### 5.1 Analysis of Existing Test Infrastructure

- **Current passing test baseline:** 273 tests passing across 16 test files (`pnpm vitest run`).
- **`tests/mocks/chat-sdk.ts`:**
  - Currently mocks: `MockAppSettingsBuilder`, `MockCustomMessage`, `MockMessagesRequestBuilder`, `CometChat.init`, `login`, `getLoggedinUser`, `sendCustomMessage`.
  - **Gaps identified:**
    - Missing `MockTransientMessage` class.
    - Missing `MockMessageListener` class with callbacks `onTransientMessageReceived` and `onCustomMessageReceived`.
    - Missing `CometChat.sendTransientMessage(message)`.
    - Missing `CometChat.addMessageListener(id, listener)`.
    - Missing `CometChat.removeMessageListener(id)`.
    - Missing `CometChat.logout()`.
- **`tests/mocks/calls-sdk.ts`:**
  - Fully implements `CometChatCalls` (`init`, `loginWithAuthToken`, `joinSession`, `leaveSession`, `generateToken`, `addEventListener`).
  - Spies verify `SessionSettings` (including `startAudioMuted: true` on clinician).

### 5.2 Required Test Implementations for Phase 3

#### 1. Enhanced Chat SDK Mock (`tests/mocks/chat-sdk.ts`)
Needs enhancement to support the transient telemetry channel and message event distribution:
```typescript
export class MockTransientMessage {
  constructor(
    private receiverId: string,
    private receiverType: string,
    private data: Record<string, unknown>
  ) {}
  getReceiverID() { return this.receiverId; }
  getReceiverType() { return this.receiverType; }
  getData() { return this.data; }
}

export class MockMessageListener {
  constructor(public callbacks: {
    onTransientMessageReceived?: (msg: any) => void;
    onCustomMessageReceived?: (msg: any) => void;
  }) {}
}
```
`CometChat.sendTransientMessage` must route the message to all registered listeners whose group ID matches, enabling deterministic multi-profile simulation.

#### 2. Dual-Profile Interaction Test Suite (`tests/e2e/interactions.test.ts` or `tests/e2e/dualProfileInteractions.test.ts`)
- **Rate-Capping Test ($\le 10$ Hz):**
  - Simulates 30 frames per second input stream over 1000ms.
  - Verifies that `TelemetryTokenBucket` throttles outgoing `CometChat.sendTransientMessage` calls to $\le 10$ transmissions.
- **Biomechanical Telemetry Delivery:**
  - Verifies that `kine.pose` transient messages dispatched by Patient arrive at Clinician's `useTelemetryStream` listener.
- **Coaching Cue Loop:**
  - Clinician dispatches `kine.cue` (`cue: "knees_out"`).
  - Verifies delivery to Patient custom message listener with identical schema.

#### 3. Biomechanical Valgus Alert & Cooldown Test
- Simulates valgus $> 8.0\%$ for $\ge 3$ consecutive frames during `descending`.
- Asserts exactly 1 `kine.alert` is emitted.
- Re-triggers valgus spike within 2000ms $\to$ verifies alert is suppressed by 4000ms cooldown.
- Advances time by $> 4000$ms $\to$ verifies subsequent spike emits a new alert.
- Triggers Right knee valgus while Left knee is in cooldown $\to$ verifies Right knee alert fires independently.

#### 4. Session Guard Routing & Conflict Test (`tests/sessionGuard.test.ts`)
- Tests `parseSessionParams`:
  - `?role=clinician&session=kine-abc` $\to$ `{ role: 'clinician', sessionId: 'kine-abc', isValid: true }`
  - `?role=patient&session=kine-xyz` $\to$ `{ role: 'patient', sessionId: 'kine-xyz', isValid: true }`
  - `?role=invalid` $\to$ `{ role: null, sessionId: null, isValid: false }`
  - Empty search string $\to$ `{ role: null, sessionId: null, isValid: false }`
- Tests `detectRoleConflict`:
  - Active user `dr-demo` + requested role `patient` $\to$ conflict `true`.
  - Active user `pt-demo` + requested role `patient` $\to$ conflict `false`.
  - No active user + requested role `clinician` $\to$ conflict `false`.
- Asserts non-destructive behavior: `CometChat.logout()` is **not** called during detection.

---

## 6. Proposed Implementation Plan & File Structure

```
client/src/
├── styles/
│   ├── tokens.css               # [D4.2] All §2.1 semantic variables
│   └── motionPresets.ts         # [D4.2] §5.1 Framer Motion spring presets
├── hooks/
│   └── useTelemetryStream.ts    # [D4.4] 10 Hz transient message consumer hook
├── utils/
│   └── sessionGuard.ts          # [D4.5] URL parser & non-destructive UID conflict guard
├── components/
│   ├── FloatingShell.tsx        # [D4.2] Outer frame (#F4F6EA) + dark sidebar + canvas island
│   ├── SidebarNav.tsx           # [D4.2] Obsidian sidebar with layoutId="activeNavigationPill"
│   ├── SkeletonCanvas.tsx       # [D4.3] 2D canvas overlay for BlazePose skeleton
│   ├── TelemetryHUD.tsx         # [D4.4] 60 fps smoothed HUD with useSpring dampers
│   ├── CoachingCuePad.tsx       # [D4.4] 4 tactile coaching cue buttons
│   └── RoleConflictModal.tsx    # [D4.5] Non-destructive session conflict modal
├── views/
│   ├── Patient.tsx              # [D4.3] Live video + pose inference + transient telemetry
│   └── Clinician.tsx            # [D4.4] Remote video (startAudioMuted: true) + HUD + cues
└── App.tsx                      # [D4.2-D4.5] App router integrating Shell, Views, and Guard
```

---

## 7. Verification Matrix & Exit Criteria

1. **Compilation & Static Hygiene:**
   - `pnpm --filter @kinesio/client exec tsc --noEmit` exits with 0.
   - Regex scan confirms **zero raw hex codes** in `client/src/views/` and `client/src/components/`.
   - Regex scan confirms **zero `console.log`** inside 10 Hz telemetry or per-frame callbacks.
   - Regex scan confirms **zero `@ts-ignore`** or crash-site `?.` masking on WebRTC/SDK calls.
2. **Automated Vitest Execution:**
   - `pnpm vitest run` executes all test suites with exit code 0.
   - Zero tautological assertions.
3. **Manual Runbook Verification:**
   - Window 1 (`http://localhost:5173/?role=patient&session=kine-test`): Connects, renders skeleton, emits 10 Hz telemetry, increments rep badge on squats.
   - Window 2 (Incognito, `http://localhost:5173/?role=clinician&session=kine-test`): Connects muted (`startAudioMuted: true`), displays patient video, smooths telemetry at 60 fps, sends cue buttons, receives valgus alert banner.
   - Role Conflict Check: Opening `?role=clinician` in a tab already authenticated as `pt-demo` raises `RoleConflictModal` without wiping `localStorage`.
