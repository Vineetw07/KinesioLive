# Architecture & Security Audit — KinesioLive

> **Scope:** Architecture Review, Attack Surface Analysis, Performance Bottlenecks, and Invariants  
> **Master Roadmap:** [implementation_plan.md](./implementation_plan.md)  
> **System Specs:** [trd.md](./trd.md)

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

---

## 3. WebRTC & Media Permissions Audit
- **HTTPS Enforcement:** WebRTC `getUserMedia` is blocked by Chromium on non-localhost origins unless served over valid TLS.
- **Render Deployment Strategy:** Single Express origin serving `/api` and Vite assets behind Render's automated TLS certificate manager.
- **Hardware Camera Contention Defense (Windows/Chromium):** Calls SDK v5 internally calls `getUserMedia` to render into its container. If MediaPipe makes an independent `getUserMedia` request, Windows camera drivers throw `NotReadableError`. KinesioLive attaches MediaPipe directly to the `<video>` element created by Calls SDK inside the mount container via `requestVideoFrameCallback`, eliminating concurrent camera contention.
- **Acoustic Feedback Defense (Dual-Tab Demo):** When running clinician and patient on the same machine during local testing or demo recording, open microphones create an immediate acoustic howling loop. Clinician session defaults to `startAudioMuted: true` in `SessionSettings`.
- **Local Dev Reverse Proxy:** Vite dev server on `:5173` is configured with `server: { proxy: { '/api': 'http://localhost:5000' } }` to ensure seamless cookie/origin flow without CORS errors in local development.

---

## 🔄 Dynamic Update Trigger Matrix
- Run an audit review before every deployment (Milestone D6.1 in [implementation_plan.md](./implementation_plan.md)).
- If new endpoints or dependencies are introduced, append findings here.
