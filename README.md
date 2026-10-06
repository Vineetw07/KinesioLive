# KinesioLive — Real-Time Biomechanical Telerehabilitation

[![Built for #ZeroToChat](https://img.shields.io/badge/Built%20for-%23ZeroToChat-lime?style=for-the-badge)](https://cometchat.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7+-blue?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react)](https://react.dev/)
[![CometChat Calls v5](https://img.shields.io/badge/CometChat%20Calls-v5%20Headless-FF5C00?style=for-the-badge)](https://www.cometchat.com/docs/calls-sdk/web/v5/overview)
[![CometChat Chat v4](https://img.shields.io/badge/CometChat%20Chat-v4-7C3AED?style=for-the-badge)](https://www.cometchat.com/docs/chat-sdk/web/v4/overview)
[![Tests Passing](https://img.shields.io/badge/Tests-562%20Passed-brightgreen?style=for-the-badge)](https://vitest.dev/)

**KinesioLive** is a real-time tele-rehabilitation platform connecting patients and physical therapists over live WebRTC video, powered by in-browser computer vision and **CometChat's unified communications engine**. 

While the patient performs rehabilitation exercises (bodyweight squats), in-browser MediaPipe models track 3D body kinematics and stream **10 Hz joint telemetry** across CometChat's transient message bus into the clinician's live heads-up display (HUD). When form breakdowns such as knee valgus (inward knee collapse) occur, KinesioLive detects the deviation, alerts the clinician, enables instant coaching cues, and persists the entire session as a permanent medical exercise log inside CometChat group history.

---

## 📑 Core Documentation Index (For the Team)

For detailed architectural specifications, lifecycle plans, and biomechanical equations, refer to the canonical documents in [`./docs/`](./docs/):

| Document | Purpose & Key Contents |
|---|---|
| 🎯 **[`docs/prd.md`](./docs/prd.md)** | **Product Requirements Document:** User personas (Patient & Clinician), user stories, MVP scope, and product boundaries. |
| 📐 **[`docs/trd.md`](./docs/trd.md)** | **Technical Requirements Document:** Architecture, verified message schemas (`shared/contract.ts`), 3D knee flexion & valgus formulas, 1-Euro adaptive filter, and backend REST endpoints. |
| 🗺️ **[`docs/implementation_plan.md`](./docs/implementation_plan.md)** | **Master Roadmap:** Phased milestones (D1–D7), 4-persona architectural critiques, and 90-second demo script. |
| 🛡️ **[`docs/audit.md`](./docs/audit.md)** | **Security & Architecture Audit:** Token isolation, session collision defense (`sessionGuard`), zero-credential client bundle validation. |
| 🧪 **[`docs/testing.md`](./docs/testing.md)** | **Testing Matrix & Verification Protocol:** 562 automated tests across geometry, rep state machine, 1-Euro filter, form scoring, canvas overlay alignment, and dual-transport sync. |
| 🐞 **[`docs/bugs.md`](./docs/bugs.md)** | **Bug Triage & RCA Ledger:** Scientific root-cause analyses and resolution history (BUG-001 through BUG-013). |
| 🎨 **[`docs/frontend_architecture_spec.md`](./docs/frontend_architecture_spec.md)** | **Design System Specification:** Floating Island Bento Canvas (Flux UI), semantic CSS design tokens, and Framer Motion spring presets. |
| ⚡ **[`COMETCHAT_INTEGRATION.md`](./COMETCHAT_INTEGRATION.md)** | **CometChat Capabilities & MCP Evidence Log:** Exhaustive log of 24 live MCP tool calls (`list_cometchat_bundles`, `fetch_cometchat_doc_page`, etc.) and exact SDK signatures. |

---

## 🌟 Key Application Features

- **🌐 Immersive Dark Landing Portal:** Role-switching portal (`LandingPage.tsx`) featuring real-time 3D anatomical backdrop visualization (`AnatomicalSkeletonBackdrop3D.tsx`) and instant session code creation.
- **🚪 Pre-Session Clinician & Patient Lobbies:**
  - *Clinician Lobby (`ClinicianLobby.tsx`):* Session GUID generator, one-click patient invite link copy, microphone/camera health preview, and room entry.
  - *Patient Lobby (`PatientLobby.tsx`):* Real-time MediaPipe camera preflight, interactive kinematic mannequin (`KinematicMannequin3D.tsx`), and standing posture baseline checklist.
- **🎥 Low-Latency Two-Way Video Call:** Powered by headless CometChat Calls SDK v5, seamlessly integrated into a responsive Floating Island Bento canvas without restrictive prebuilt modals.
- **🦴 Subpixel Canvas Skeleton Alignment:** Custom subpixel coordinate mapper (`canvasOverlayAligner.ts`) with letterbox/pillarbox compensation, candidate scoring, and mirrored reflection rendering an aligned anatomical skeleton directly over the patient's video feed.
- **⚡ 10 Hz Real-Time Biomechanical Telemetry:** In-browser pose estimation derives 3D sagittal knee flexion, frontal knee valgus inward deviation %, and normalized depth ratio, streamed to the clinician at 10 Hz.
- **🚨 Automated Knee Valgus Form Alerts:** Instantly detects medial knee collapse ($> +8.0\%$ inward deviation from calibrated standing leg length for $\ge 3$ consecutive frames) and flashes a red clinical alert badge.
- **💬 Instant 1-Click Coaching Cues:** Clinician clicks quick-cue buttons (*"Knees Out"*, *"Slow Down"*, *"Chest Up"*); cue animates onto the patient's HUD in $< 200$ ms with full ARIA live accessibility support.
- **📈 Rep Counter & Biomechanical Form Score:** Hysteresis-driven state machine calculates rep completions, evaluating peak depth, knee valgus penalty, and tempo into a composite score (0–100) and tier rating (*"excellent"*, *"good"*, *"needs_work"*).
- **📊 Post-Workout Analytics Card:** Tapping "End Session" fetches group history via CometChat's `MessagesRequestBuilder` and renders an end-of-session summary card (Total Reps, Average Depth, Valgus Breakdowns, and Timeline).

---

## ⚡ How CometChat Powers KinesioLive

KinesioLive utilizes the entire CometChat real-time communications suite to serve as the unified WebRTC media and telemetry backbone:

```
+----------------------------------------------------------------------------------------------------+
|                                    KINESIOLIVE RUNTIME TOPOLOGY                                    |
+----------------------------------------------------------------------------------------------------+
|   Browser 1: Patient (Chrome Profile 1)                   Browser 2: Clinician (Chrome Profile 2)  |
|   - MediaPipe Pose Landmarker (GPU/Lite)                  - CometChat Calls v5 Video Container     |
|   - 2D/3D Biomechanics Math Engine                       - Real-Time Biomechanics HUD             |
|   - Subpixel Canvas Skeleton Overlay                      - 1-Click Coaching Cue Buttons           |
|   - 10 Hz Token Bucket Rate Limiter                       - Patient Presence & Status Badge        |
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
|                                           | REST API (Server-Side Auth Token Minting)              |
|                                           v                                                        |
|                         +-----------------------------------+                                      |
|                         |   EXPRESS BACKEND (Node.js 22)    |                                      |
|                         | - POST /api/session               |                                      |
|                         | - GET  /api/health                |                                      |
|                         | - Static Host for React Web App   |                                      |
|                         +-----------------------------------+                                      |
+----------------------------------------------------------------------------------------------------+
```

### 1. WebRTC Video Calling — Calls SDK v5 (`@cometchat/calls-sdk-javascript@5`)
- Headless video calling embedded directly into the React DOM container.
- Sessions use the appointment session ID as room token (`CometChatCalls.generateToken(sessionId)` -> `CometChatCalls.joinSession(...)`).
- Clinicians enter with `startAudioMuted: true` to prevent acoustic feedback loops.
- Supports moderator actions (`CometChatCalls.muteParticipant()`).

### 2. High-Frequency Telemetry — Transient Messages (`CometChat.sendTransientMessage`)
- MediaPipe pose kinematics are streamed at 10 Hz to `RECEIVER_TYPE.GROUP`.
- **Zero Database Bloat:** Because telemetry is fire-and-forget, CometChat Transient Messages deliver pose packets in $< 200$ ms across WebSocket connections without writing millions of ephemeral rows to disk.

### 3. Persisted Exercise Events — Custom Messages (`CometChat.sendCustomMessage`)
- Significant clinical milestones are sent as structured custom messages (`kine.rep`, `kine.alert`, `kine.cue`, `kine.session`).
- Flagged with `shouldUpdateConversation(false)` to prevent high-frequency exercise events from polluting conversation list previews.

### 4. Medical Exercise Record — Group History (`MessagesRequestBuilder`)
- Each appointment is mapped to a dedicated public CometChat group (`kine-<sessionId>`).
- Upon session completion, `fetchPrevious()` queries the historical custom messages, dynamically reconstructing total reps, average depth, and alert frequency.

### 5. Live Patient Presence — User Listeners (`CometChat.addUserListener`)
- Instant notification triggers the clinician's HUD presence badge ("Patient in Session: Active") the moment the patient connects.

### 6. Zero-Trust Security — REST Token Minting (`/v3/users/{uid}/auth_tokens`)
- Express backend acts as the sole token mint: `COMETCHAT_AUTH_KEY` and REST keys remain strictly server-side.
- Client only receives short-lived Auth Tokens minted on-demand.

---

## 🔬 Clinical & Biomechanical Honesty

> ⚠️ **Clinical Notice:** The valgus deviation calculation uses a calibrated standing baseline ($L_{\text{standing}}$) and frontal-plane landmark projection from MediaPipe BlazePose 3D world landmarks. It is an engineering model designed for real-time coaching feedback during telerehabilitation exercises. It is **not** a diagnostic medical device and must not be used for clinical diagnosis or prescription without licensed practitioner supervision.

---

## 🚀 Quickstart & Local Development

### Prerequisites
- Node.js 20+ or 22+
- `pnpm` (`npm install -g pnpm`)
- CometChat App Credentials (from [dashboard.cometchat.com](https://dashboard.cometchat.com))

### 1. Installation
```bash
# Clone the repository
git clone git@github.com:Vineetw07/KinesioLive.git
cd KinesioLive

# Install monorepo dependencies
pnpm install
```

### 2. Configuration
Copy the template and configure your CometChat credentials:
```bash
cp .env.example .env
```
Fill in `.env`:
```env
COMETCHAT_APP_ID=your_cometchat_app_id
COMETCHAT_REGION=your_cometchat_region
COMETCHAT_AUTH_KEY=your_cometchat_auth_key
COMETCHAT_REST_API_KEY=your_cometchat_rest_api_key
```

### 3. Build & Run
```bash
# Build all packages (shared, client, server)
pnpm run build

# Start the unified Express server
node server/dist/index.js
```
- Open `http://localhost:5000` for the Landing Page.
- Open `http://localhost:5000/?role=clinician` in **Chrome Profile A**.
- Open `http://localhost:5000/?role=patient` in **Chrome Profile B** (or Incognito).

### 4. Verification Suite
```bash
# Typecheck across all workspace packages
pnpm run typecheck

# Run full Vitest test suite (562 passing tests)
pnpm test
```

---

## 📄 License & Credits

Built for the **CometChat "Zero to Chat" Build Challenge (#ZeroToChat)**.  
Licensed under the [MIT License](./LICENSE).
