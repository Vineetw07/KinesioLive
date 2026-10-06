# Architecture & Security Audit — KinesioLive

> **Scope:** Architecture Review, Attack Surface Analysis, Performance Bottlenecks, and Invariants  
> **Master Roadmap:** [implementation_plan.md](./implementation_plan.md)  
> **System Specs:** [trd.md](./trd.md)

---

## 🤖 Agent Append Protocol (Read Before Logging)

This is a **live document**. Whenever a security observation, architectural risk, or performance finding is discovered — during development, code review, or QA audits — append it to the relevant section **immediately** when discovered. Do not batch findings.

**Rules for appending:**
- Append under the most relevant existing section: `## 1` (Security), `## 2` (Performance), or `## 3` (WebRTC/Media).
- If a finding spans multiple sections, put it under the primary concern.
- Only append if there is a real observation. Do NOT append "no issues found" notes here — silence is correct for passing checks.
- If the finding also constitutes a functional bug, it must ALSO be logged in `docs/bugs.md`.
- Reference the QA check ID (e.g. `M2-A`) if found during an audit session.

**Block format to append:**
```markdown
### 🔍 Audit Finding [YYYY-MM-DD] — <Short Title>
- **Check:** <QA check ID, e.g. M1-A, or "Development" if found outside QA>
- **Observation:** <Exact description. File and line number if applicable.>
- **Severity:** P0 demo-blocker | P1 functional defect | P2 edge-case | P3 documentation
- **Recommendation:** <What should be done. Do NOT apply the fix — describe it only.>
```

---


## 1. Security Surface & Invariant Audit

### 🚨 Critical Invariants
1. **Zero Credential Leakage:**
   - **Target:** The CometChat REST API Key and Auth Key must **never** reach client bundles.
   - **Verification:** Continuous grep/regex scan on `dist/` before deployment:
     ```powershell
     Select-String -Path "dist/*" -Pattern "COMETCHAT_AUTH_KEY|COMETCHAT_REST|apiKey"
     ```
   - **Current Status:** PASS. Express backend acts as the sole token mint. Client only receives short-lived Auth Tokens via `POST /api/session`.
2. **Session Collision Prevention (localStorage Guard):**
   - **Target:** Prevent browser tab state corruption where two roles open in the same profile overwrite each other's CometChat user sessions.
   - **Mechanism:** `sessionGuard.ts` detects active UID vs URL role param (`?role=clinician` vs `?role=patient`). If mismatched, halts render and mounts a **non-destructive blocking modal** instructing the user to open a separate Chrome Profile or Incognito window. **Crucial:** It never calls `CometChat.logout()`, which would wipe shared `localStorage` and crash the other active participant tab.

### 🔍 Audit Finding [2026-10-05] — Missing Semantic Tokens for Status Tints & Dark Surfaces
- **Check:** F2-A
- **Observation:** While `tokens.css` strictly eliminates raw hex codes from executable TypeScript, multiple components in `client/src/views/` (`Patient.tsx`, `Clinician.tsx`) and `RoleConflictModal.tsx` define inline `rgba(...)` values (e.g. `rgba(239, 68, 68, 0.15)`, `rgba(16, 185, 129, 0.15)`, `rgba(245, 158, 11, 0.15)`, `rgba(24, 25, 28, 0.92)`, `rgba(19, 20, 23, 0.75)`). These duplicate status colors with hardcoded opacity rather than referencing design tokens.
- **Severity:** P2 edge-case
- **Recommendation:** Add `--status-stable-tint`, `--status-warning-tint`, `--status-critical-tint`, and `--surface-dark-backdrop` CSS variables to `tokens.css` and migrate inline RGBA calls.

### 🔍 Audit Finding [2026-10-05] — Missing ARIA Live Regions on Dynamic Telemetry & Coaching Cues
- **Check:** F4-A
- **Observation:** In `Patient.tsx:815-842`, active coaching cues dispatched by the clinician (`kine.cue`) animate into view via a toast notification, but lack `role="alert"` and `aria-live="assertive"`. Similarly, valgus breakdown warnings and rep increments in `Patient.tsx` and `Clinician.tsx` lack `aria-live="polite"` announcers, leaving assistive technology users without audible telemetry feedback.
- **Severity:** P1 functional defect (WCAG 2.1 AA Criterion 4.1.3)
- **Recommendation:** Decorate the coaching cue toast with `role="alert"` and `aria-live="assertive"`, and provide an invisible `aria-live="polite"` announcer for rep counts and valgus alerts.

### 🔍 Audit Finding [2026-10-05] — Role Conflict Modal Lacks Focus Trap
- **Check:** F4-C
- **Observation:** `client/src/components/RoleConflictModal.tsx` specifies `role="dialog"` and `aria-modal="true"` with `aria-labelledby`, but does not trap keyboard focus on mount. Keyboard users pressing `Tab` can cycle focus into obscured background elements behind the modal backdrop.
- **Severity:** P2 edge-case (WCAG 2.1 AA Criterion 2.4.3)
- **Recommendation:** Add focus trapping to constrain Tab navigation within the modal container while active, and restore focus to trigger upon dismissal.

### 🔍 Audit Finding [2026-10-05] — prefers-reduced-motion Not Honored in Motion Presets
- **Check:** F4-B
- **Observation:** `motionPresets.ts` and component animations execute spring transitions without inspecting the user's OS or browser reduced-motion preferences (`prefers-reduced-motion`).
- **Severity:** P2 edge-case (WCAG 2.1 AA Criterion 2.3.3)
- **Recommendation:** Add a media query check or `useReducedMotion()` hook from Framer Motion to collapse spring translations/scales to subtle instantaneous fades when reduced motion is requested.


---

## 2. Performance & Real-Time Throughput Audit

### Telemetry Pipeline Audit
- **Risk:** High-frequency pose updates (30 FPS) blocking the browser event loop or triggering CometChat WebSocket rate-limits.
- **Audit Findings:**
  - Standard CometChat message listeners update state on every incoming packet.
  - 30 Hz updates cause React micro-task re-rendering storms.
- **Mitigation Enforced:**
  - Token-bucket rate limiter (`rateCap.ts`) throttles outgoing transient messages strictly to **10 Hz**.
  - Pose calculations occur within `requestVideoFrameCallback`, running off the main paint cycle.

### 🔍 Audit Finding [2026-10-05] — 60 FPS Parent Component Re-renders from useMotionValueEvent Listeners
- **Check:** F3-A
- **Observation:** In `Clinician.tsx:86-90`, five separate `useMotionValueEvent` listeners subscribe to `smoothKneeL`, `smoothKneeR`, `smoothDepth`, `smoothValgusL`, and `smoothValgusR`. Each spring tick invokes a React state setter (`setDisplayKneeL`, `setDisplayDepth`, etc.), causing the entire Clinician view tree to re-render up to 60 times per second during motion.
- **Severity:** P2 edge-case (performance optimization)
- **Recommendation:** Extract the telemetry values into dedicated leaf components (`<KinematicGaugeValue>`) or bind them directly to DOM nodes via Framer Motion's motion value subscription without re-rendering the outer layout.

---

## 3. WebRTC & Media Permissions Audit
- **HTTPS Enforcement:** WebRTC `getUserMedia` is blocked by Chromium on non-localhost origins unless served over valid TLS.
- **Render Deployment Strategy:** Single Express origin serving `/api` and Vite assets behind Render's automated TLS certificate manager.
- **Hardware Camera Contention Defense (Windows/Chromium):** Calls SDK v5 internally calls `getUserMedia` to render into its container. If MediaPipe makes an independent `getUserMedia` request, Windows camera drivers throw `NotReadableError`. KinesioLive attaches MediaPipe directly to the `<video>` element created by Calls SDK inside the mount container via `requestVideoFrameCallback`, eliminating concurrent camera contention.
- **Acoustic Feedback Defense (Dual-Tab Demo):** When running clinician and patient on the same machine during local testing or demo recording, open microphones create an immediate acoustic howling loop. Clinician session defaults to `startAudioMuted: true` in `SessionSettings`.
- **Local Dev Reverse Proxy:** Vite dev server on `:5173` is configured with `server: { proxy: { '/api': 'http://localhost:5000' } }` to ensure seamless cookie/origin flow without CORS errors in local development.

### 🔍 Audit Finding [2026-10-05] — High-DPI / Retina Canvas Upscaling Resolution Artifacts
- **Check:** F1-B
- **Observation:** In `Patient.tsx:727-730`, the 2D skeleton overlay canvas sets `canvas.width = width` and `canvas.height = height` matching raw video frame dimensions (640x480). It does not incorporate `window.devicePixelRatio`. On Retina / 4K displays where DPR is 2.0 or higher, the 640x480 pixel buffer is stretched over the CSS container (e.g. 1000px wide), resulting in slightly blurred or pixelated joint lines and circles.
- **Severity:** P2 edge-case (visual fidelity)
- **Recommendation:** Scale the canvas buffer dimensions by `window.devicePixelRatio` (`canvas.width = rect.width * dpr`) and invoke `ctx.scale(dpr, dpr)` when drawing, normalizing landmark coordinates to CSS pixels.

### 🔍 Audit Finding [2026-10-05] — Concurrent Camera Hardware Contention Between Fallback and Call Bootstrap
- **Check:** F1-C
- **Observation:** In `Patient.tsx:354`, if a user engages the offline camera test (`startFallbackCamera()`) while session authentication is in flight, `fallbackStreamRef.current` remains active holding hardware camera locks when `CometChatCalls.joinSession()` executes. On Windows Chromium setups, this can trigger an immediate `NotReadableError` due to concurrent camera capture.
- **Severity:** P1 functional defect (logged as **BUG-009**)
- **Recommendation:** Ensure `bootstrapPatientCall` invokes `stopFallbackCamera()` prior to calling `CometChatCalls.joinSession()`.


---

## 🔄 Dynamic Update Trigger Matrix
- Run an audit review before every deployment (Milestone D6.1 in [implementation_plan.md](./implementation_plan.md)).
- If new endpoints or dependencies are introduced, append findings here.
