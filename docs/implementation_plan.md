# KinesioLive — High-Efficacy Master Implementation Plan (10x Edition)

> **Role & Mission:** Senior Full-Stack Engineer, Biomechanics Specialist, and Hackathon Strategist.
> **Challenge:** CometChat "Zero to Chat" Build Challenge (#ZeroToChat).
> **Objective:** Deliver a rock-solid, production-grade tele-rehab MVP where CometChat powers live video, real-time pose telemetry, coaching cues, presence, and session exercise logs.

---

## 📚 Canonical Documentation Mesh (Dynamic Interlink Index)
This plan is dynamically cross-referenced with the 6 canonical lifecycle documents in `./docs/`:
- 🎯 **[prd.md](./prd.md)** — Product requirements, user stories, in/out-of-scope boundaries.
- 📐 **[trd.md](./trd.md)** — Technical requirements, message schemas, biomechanical equations.
- 🗺️ **[implementation_plan.md](./implementation_plan.md)** — Phased roadmap, multi-persona critique, day-by-day checklist.
- 🛡️ **[audit.md](./audit.md)** — Security boundaries, token isolation, rate-limit & WebRTC audits.
- 🐞 **[bugs.md](./bugs.md)** — Incident triage ledger, scientific RCA, and regression locking.
- 🧪 **[testing.md](./testing.md)** — Vitest test matrix, two-profile checklist, deployed-URL smoke spec.

### 🔄 Dynamic Update Protocol
Whenever changes occur during implementation:
1. **Scope change** -> Update `prd.md` Section 3 -> Update Task List here.
2. **Schema / API adjustment** -> Update `trd.md` Section 2 -> Update `shared/contract.ts`.
3. **Milestone complete** -> Toggle `[ ]` to `[x]` in Section 6 here.
4. **Runtime bug / defect** -> Log entry in `bugs.md` before applying patch.
5. **Security / Performance observation** -> Append to `audit.md`.
6. **Quota-Break / Account Switch Recovery** -> On "continue" or "resume", inspect git status and task checkboxes here, emit 4-field state snapshot, and resume from first unchecked task.



## 🎭 Multi-Persona Engineering Critiques (The 10x Architectural Defense)

To ensure this build is bulletproof, zero-defect, and scores maximum points on the CometChat judging criteria (*it runs, it's interesting, it uses the MCP*), 4 specialized personas systematically critiqued and pressure-tested the system architecture:

```
+---------------------------------------------------------------------------------------------------------+
|                                    4-PERSONA ADVERSARIAL CRITIQUE PANEL                                 |
+------------------------------------+------------------------------------+-------------------------------+
| 🩺 Clinical & Biomechanics Auditor | ⚡ CometChat Protocol Architect    | 🚀 Production & SRE Veteran   |
| "A 2D webcam cannot do sagittal    | "Transient messages are group-     | "Single node on Render with   |
| knee flexion without perspective   | native, fire-and-forget. Token     | client rate-capping ensures   |
| calibration. Frontal plane only    | bucket at 10 Hz prevents browser   | zero CORS, zero key leaks, and|
| for valgus; use 3D worldLandmarks  | main thread lag."                  | < 300ms p95 latency."         |
| or normalized height for depth."   +------------------------------------+-------------------------------+
|                                    | 🏆 Hackathon Demo Strategist                                       |
|                                    | "Judges evaluate within 90 seconds. Visible MCP call log in editor|
|                                    | + live valgus alert + clinician cue loop wins the podium."         |
+------------------------------------+--------------------------------------------------------------------+
```

### 1. 🩺 Clinical & Biomechanics Specialist Critique
- **Vulnerabilities Identified:**
  1. *Geometric Singularity in 2D Frontal Knee Angle:* As the hip descends toward knee level $(y_{\text{hip}} \to y_{\text{knee}})$, the vertical femoral projection vanishes, producing erratic flips ($180^\circ \to 90^\circ$) or near-zero division.
  2. *Dynamic Denominator Shrinkage:* Normalizing valgus deviation by instantaneous hip-ankle distance $(y_a - y_h)$ doubles the calculated valgus percentage at bottom squat depth for the exact same knee position.
  3. *Camera Sensor Polarity:* In unmirrored camera coordinates, left leg medial collapse decreases $X$, which produced negative deviation unless polarity is $-1$.
- **The 10x Resolution:**
  1. **3D Sagittal Flexion:** Knee flexion is derived strictly from MediaPipe 3D `worldLandmarks` via vector dot product.
  2. **Calibrated Standing Baseline Leg Length:** Valgus deviation is normalized strictly against standing leg length $L_{\text{standing}}$ recorded once during standing posture.
  3. **Polarity Calibration:** Left leg polarity is $-1$ and Right leg is $+1$ in unmirrored space, ensuring medial collapse always registers as positive ($+$).
  4. **Calibrated Depth Ratio:** Squat depth is measured as normalized hip descent: $\frac{Y_{\text{hip}}(t) - Y_{\text{hip}}(\text{standing})}{Y_{\text{knee}}(\text{standing}) - Y_{\text{hip}}(\text{standing})}$.
  5. **Honesty Clause:** Explicit clinical disclaimer on patient & clinician HUDs: *"KinesioLive provides real-time biomechanical form alerts for coaching guidance; not diagnostic software."*


### 2. ⚡ CometChat Core Protocol Architect Critique
- **Vulnerability Identified:** High-frequency pose telemetry could flood WebSocket gateways or browser memory if unthrottled or sent as stored messages.
- **The 10x Resolution (Verified via live MCP docs):**
  1. **Telemetry on `CometChat.sendTransientMessage`:** Fire-and-forget, zero persistence, group-delivered (`RECEIVER_TYPE.GROUP`). Capped at 10 Hz via token bucket.
  2. **Milestones on `CometChat.sendCustomMessage`:** Only reps (`kine.rep`), form alerts (`kine.alert`), clinician cues (`kine.cue`), and session markers (`kine.session`) are persisted.
  3. **Zero Browser Tab Collisions:** Since CometChat stores session state in `localStorage`, Clinician and Patient are explicitly architected to run in two isolated Chrome Profiles (or Chrome + Incognito) with a `sessionGuard` checking role mismatch on boot.
  4. **Server-Minted Tokens:** Zero REST/Auth Keys shipped to the browser. The Node/Express server calls CometChat REST API `/v3/users/{uid}/auth_tokens` and hands tokens to clients via `POST /api/session`.

### 3. 🚀 Production & SRE Veteran Critique
- **Vulnerability Identified:** WebRTC camera permissions fail without HTTPS; multi-container microservices introduce CORS and deploy latency; cold starts on free tiers cause demo failures.
- **The 10x Resolution:**
  1. **Unified Monolith Architecture:** Express server serves both the REST API (`/api/*`) and the static production Vite build (`dist/`) from a single origin. Zero CORS issues, single deployment artifact on Render.
  2. **Automatic Pre-Warm & Health Endpoint:** `GET /api/health` validates CometChat API connectivity and wakes the container before the demo.
  3. **Deterministic Clean Teardown:** All CometChat listeners (`removeMessageListener`, `removeUserListener`, and Calls v5 `unsubscribe()`) are registered in strict React lifecycle cleanup hooks.

### 4. 🏆 Hackathon Winning Strategist Critique
- **Vulnerability Identified:** The judges don't read code line-by-line; they watch an < 90s video. If the MCP connector isn't front-and-center, or if the interactive feedback loop takes too long to appear, judges move on.
- **The 10x Resolution:**
  1. **Demo Seconds 0–8:** Screen captures the actual editor with the CometChat MCP executing tool calls with verified dates.
  2. **Clear Feedback Loop:** Clinician clicks "Knees Out" button -> Cue flashes instantly on Patient screen in < 200ms -> Patient widens stance -> Next rep shows green form rating.
  3. **Automated Session Summary:** Tapping "End Session" instantly aggregates persisted group messages into a beautiful post-workout analytics card.

---

## 🏛️ System Architecture & Data Flow

```
+----------------------------------------------------------------------------------------------------+
|                                     KINESIOLIVE RUNTIME TOPOLOGY                                    |
+----------------------------------------------------------------------------------------------------+
|                                                                                                    |
|    PATIENT BROWSER (Chrome Profile 1)                     CLINICIAN BROWSER (Chrome Profile 2)     |
|    +------------------------------------+                 +------------------------------------+   |
|    | Local Camera Track (640x480 @ 30)  |                 | Remote Video Stream (Patient feed) |   |
|    |                |                   |                 |                |                   |   |
|    | MediaPipe Pose Landmarker (GPU)    |                 | CometChat Calls v5 Session         |   |
|    |                v                   |                 |                v                   |   |
|    | 2D/3D Biomechanics Math Engine    |  WebRTC Video   | Live Biomechanics HUD Component   |   |
|    | - Knee Valgus % Deviation          |================>| - Real-time Joint Angles & Depth   |   |
|    | - Depth State Machine (Rep Counter)|                 | - Knee Valgus Alert Badge (Red)    |   |
|    |                |                   |                 | - Quick Coaching Cue Triggers      |   |
|    |                v                   |                 |   ["Knees Out", "Slow Down"]       |   |
|    | Token Bucket Rate Cap (10 Hz)      |                 |                |                   |   |
|    +----------------+-------------------+                 +----------------+-------------------+   |
|                     |                                                      |                       |
|                     | 1. Transient Messages (kine.pose @ 10Hz)             |                       |
|                     +--------------------------+---------------------------+                       |
|                     | 2. Custom Messages (kine.rep, kine.alert)            |                       |
|                     | 3. Clinician Coaching Cues (kine.cue)                |                       |
|                     v                                                      v                       |
|            +----------------------------------------------------------------------+                |
|            |                      COMETCHAT CLOUD PLATFORM                         |                |
|            |  - WebRTC Calls Gateway (Calls SDK v5)                               |                |
|            |  - Real-Time Message Bus (Transient 10Hz fire-and-forget)            |                |
|            |  - Persistent Group History (kine-<sessionId> Exercise Log)           |                |
|            |  - Presence & Activity Stream ("Patient in Session")                 |                |
|            +-----------------------------------+----------------------------------+                |
|                                                ^                                                   |
|                                                | REST API: Mint Auth Tokens,                       |
|                                                | Create Group, Seed Members                        |
|                                                v                                                   |
|                           +------------------------------------------+                             |
|                           |      KINESIOLIVE BACKEND (Express)       |                             |
|                           |  - POST /api/session (Bootstrap session) |                             |
|                           |  - GET  /api/health  (Production check)  |                             |
|                           |  - Static Host for Vite React Frontend   |                             |
|                           +------------------------------------------+                             |
+----------------------------------------------------------------------------------------------------+
```

---

## 📦 Verified Message Contracts (`shared/contract.ts`)

All messages share a lightweight versioned envelope. Types are mapped to CometChat's exact primitive types verified via MCP:

```typescript
// shared/contract.ts
export const SCHEMA_VERSION = 1 as const;
export type Side = "L" | "R";
export type SquatPhase = "standing" | "descending" | "bottom" | "ascending" | "lost";

export interface Envelope {
  v: typeof SCHEMA_VERSION;
  sid: string;          // Session ID (matches group GUID)
  t: number;            // Timestamp in ms (Date.now())
}

// -------------------------------------------------------------------------
// 1. TRANSIENT CHANNEL (CometChat.sendTransientMessage - Group, Not Persisted)
// -------------------------------------------------------------------------
export interface KinePosePayload extends Envelope {
  type: "kine.pose";
  seq: number;          // Monotonic sequence number for loss tracking
  fps: number;          // Client inference FPS
  phase: SquatPhase;
  kneeDeg: { L: number | null; R: number | null };       // Frontal projection angle
  valgusDevPct: { L: number | null; R: number | null };  // % inward deviation from hip-ankle line
  depthRatio: number;   // 0.0 (standing) -> 1.0 (parallel) -> >1.0 (deep)
  vis: number;          // Min visibility score of required landmarks (0..1)
  reps: number;         // Running rep count
}

// -------------------------------------------------------------------------
// 2. PERSISTED CUSTOM MESSAGES (CometChat.sendCustomMessage - Stored in Group)
// -------------------------------------------------------------------------
export interface KineRepPayload extends Envelope {
  type: "kine.rep";
  n: number;            // Rep count completed
  minKneeDeg: number;   // Deepest angle reached
  depth: "shallow" | "good" | "deep";
  durMs: number;        // Duration from descent to ascent
  tempo: "fast" | "controlled" | "slow";
}

export interface KineAlertPayload extends Envelope {
  type: "kine.alert";
  kind: "knee_valgus";
  side: Side;
  value: number;        // Measured inward deviation percentage (e.g. 11.4%)
  thresholdPct: number; // Threshold triggered (e.g. 8.0%)
  repN: number;         // In-flight rep number
  phase: SquatPhase;
  note: "Form alert (biomechanical feedback)";
}

export interface KineCuePayload extends Envelope {
  type: "kine.cue";
  cue: "knees_out" | "slower" | "chest_up" | "good_depth";
  text: string;         // Plain-text label: "Knees Out", "Slow Down"
}

export interface KineSessionMarkerPayload extends Envelope {
  type: "kine.session";
  action: "start" | "end" | "summary";
  clinicianUid: string;
  patientUid: string;
}

export type KineMessage =
  | KinePosePayload
  | KineRepPayload
  | KineAlertPayload
  | KineCuePayload
  | KineSessionMarkerPayload;
```

---

## 🔬 Scientific Biomechanics & Pose Pipeline

### 1. Landmark Topology (BlazePose 33 Keypoints)
- **Left Leg:** Left Hip (`23`), Left Knee (`25`), Left Ankle (`27`)
- **Right Leg:** Right Hip (`24`), Right Knee (`26`), Right Ankle (`28`)
- **Trunk Reference:** Left Shoulder (`11`), Right Shoulder (`12`)

### 2. Valgus Calculation Formula (Calibrated Standing Baseline)
In unmirrored pixel camera space $(X = x \cdot W, Y = y \cdot H)$:
1. **Standing Baseline Calibration:** During standing posture ($t=0$), record standing leg length:
   $$L_{\text{standing}} = \sqrt{(X_a^{\text{stand}} - X_h^{\text{stand}})^2 + (Y_a^{\text{stand}} - Y_h^{\text{stand}})^2}$$
2. **Current Neutral Axis Position:** At current knee vertical level $Y_k$:
   $$X_{\text{baseline}} = X_h + (X_a - X_h) \times \frac{Y_k - Y_h}{Y_a - Y_h}$$
3. **Signed Inward Deviation Percentage (Polarity-Corrected):**
   $$\text{valgusDevPct} = \frac{\text{polarity} \times (X_k - X_{\text{baseline}})}{L_{\text{standing}}} \times 100$$
   *Polarity in unmirrored camera coordinates:*
   - **Left Leg (appears on right side of sensor, $X \approx 0.60$):** Medial/inward movement decreases $X$, so $\text{polarity} = -1$.
   - **Right Leg (appears on left side of sensor, $X \approx 0.40$):** Medial/inward movement increases $X$, so $\text{polarity} = +1$.
   *Result:* Inward collapse is always **positive (+)**.
4. **Trigger Condition:** $\text{valgusDevPct} > 8.0\%$ for $\ge 3$ consecutive frames while $\text{phase} \in \{\text{descending, bottom}\}$ with a **4-second cooldown** per side.

### 3. State Machine with Hysteresis
```
               knee angle < 150° / depthRatio > 0.25
   [STANDING] -----------------------------------------> [DESCENDING]
       ^                                                      |
       |                                                      | knee angle < 100° / depthRatio > 0.85
       | knee angle > 160°                                    v
       | (REP COUNTED if duration >= 800ms)                [BOTTOM]
       |                                                      |
   [ASCENDING] <----------------------------------------------+
               knee angle > 110° / depthRatio decreasing
```

---

## 🧪 Spike Verification Plan (Day 1 & Day 2)

| Spike ID | Target Subsystem | Execution Method | Pass Criteria | Kill-Switch Fallback Trigger |
|---|---|---|---|---|
| **S1** | **Pose on Live Call** | Initialize Calls SDK v5 in DOM; run MediaPipe Pose Landmarker on camera stream in parallel. | $\ge 15$ FPS pose inference on reference laptop; zero WebRTC video stuttering. | Fall back to lightweight model delegate; if still $<12$ FPS, trigger Wolfpack game. |
| **S2** | **Transient Message Throughput** | Two profiles in group: Sender transmits `kine.pose` at 10 Hz for 60 seconds (600 msgs). Receiver tracks latency & sequence loss. | p95 latency $< 400$ ms; message drop rate $< 2.0\%$. | Reduce telemetry rate to 5 Hz with client-side linear HUD interpolation. |
| **S3** | **Dual Profile Call Join** | Express server mints tokens; Profile 1 (Patient) & Profile 2 (Clinician) join `sessionId = kine-<test>`. | Both profiles connect audio + video in $< 3.0$ seconds across 5 consecutive trials. | Revert to default Calls v5 tile UI if custom overlay encounters DOM clipping. |
| **S4** | **Persistence & History Fetch** | Send 25 custom messages (`kine.rep`, `kine.alert`, `kine.cue`), fetch via `MessagesRequestBuilder`. | 25/25 messages retrieved in chronological sequence; summary correctly reconstructed. | Sort client-side by envelope timestamp `t`. |

---

## 📅 Chronological Task List (Oct 3 – Oct 11)

### Day 1: Oct 3 (Night Setup & MCP Verification — 2h)
- [x] **D1.1:** Connect CometChat MCP, verify schemas, and pull bundles. *(Completed)*
- [x] **D1.2:** Store credentials safely in `.env` with strict `.gitignore` protection. *(Completed)*
- [x] **D1.3:** Complete real MCP tool calls for calls, messages, groups, and presence. *(Completed)*
- [x] **D1.4:** Scaffold core workspace (`pnpm` monorepo with `@kinesio/shared`, `@kinesio/server`, and `@kinesio/client`). *(Completed)*

### Day 2: Oct 4 (Spike Execution & Kill-Switch Gate — 8h)
- [x] **D2.1:** Execute Spike S1 (Pose inference on live video element / parallel track). *(Completed)*
- [x] **D2.2:** Execute Spike S3 (Two-profile Calls v5 video connection). *(Completed)*
- [x] **D2.3:** Execute Spike S2 (10 Hz transient message throughput benchmark). *(Completed)*
- [x] **D2.4:** Execute Spike S4 (Custom message persistence & history query). *(Completed)*
- [x] **D2.5:** **KILL-SWITCH DECISION POINT:** Formal signoff on S1–S4. *(Completed)*

### Day 3: Oct 5 (Pose Engine & Biomechanics Unit Testing — 7h)
- [x] **D3.1:** Implement `geometry.ts` (vector math, 2D/3D angle, valgus deviation). *(Completed)*
- [x] **D3.2:** Implement `smoothing.ts` (median filter + exponential moving average). *(Completed)*
- [x] **D3.3:** Implement `repCounter.ts` (state machine with hysteresis and depth ratios). *(Completed)*
- [x] **D3.4:** Record 5 landmark fixture sequences (normal, valgus, shallow, occluded). *(Completed)*
- [x] **D3.5:** Write comprehensive Vitest suite for pose math (asserting non-tautological test passes — 219 tests green). *(Completed)*

### Day 4: Oct 6 (CometChat Integration & Core UI Loops — 8h)
- [x] **D4.1:** Token Server (`server/src/cometchatRest.ts`): session creation & token minting. *(Completed)*
- [x] **D4.2:** Design Tokens, Motion Presets & Floating Island Bento Shell (`tokens.css`, `motionPresets.ts`, `App.tsx`). *(Completed)*
- [x] **D4.3:** Patient View (`Patient.tsx`): Video call container + canvas skeleton overlay + rep badge. *(Completed)*
- [x] **D4.4:** Clinician View (`Clinician.tsx`): Video call container + live telemetry HUD + cue buttons. *(Completed)*
- [x] **D4.5:** Implement `sessionGuard.ts` to prevent cross-profile role corruption. *(Completed)*

### Day 5: Oct 7 (Persistence, Coaching Cues & Session Analytics — 7h)
- [ ] **D5.1:** Persisted Event Pipeline: `kine.rep`, `kine.alert` sent to group on trigger. *(2.0h)*
- [ ] **D5.2:** Coaching Cue Pipeline: Clinician clicks "Knees Out" -> instant Patient HUD toast. *(1.5h)*
- [ ] **D5.3:** Summary Engine (`buildSummary.ts`): Aggregate reps, average depth, alert timeline. *(2.0h)*
- [ ] **D5.4:** Summary View (`Summary.tsx`): Post-session workout analytics card with Framer Motion. *(1.5h)*

### Day 6: Oct 8 (Production Deployment & Demo Insurance Recording — 8h)
- [ ] **D6.1:** Deploy unified container to Render over HTTPS with automated `/api/health`. *(2.0h)*
- [ ] **D6.2:** Execute Deployed-URL Smoke Test (verify HTTPS camera permissions & token exchange). *(1.0h)*
- [ ] **D6.3:** Complete publication-grade `README.md` with biomechanics honesty clause & architecture diagrams. *(2.0h)*
- [ ] **D6.4:** **INSURANCE RECORDING (Take 1):** Full 90-second rehearsal recorded and archived. *(3.0h)*

### Day 7: Oct 9 (Polish & Final Submission Recording — 6h)
- [ ] **D7.1:** Micro-interaction polish: HUD badge springs, high-contrast focus rings, sound effects (optional). *(2.0h)*
- [ ] **D7.2:** **FINAL RECORDING:** 1080p, exactly 85 seconds, MCP tool calls clearly visible in first 8s. *(2.5h)*
- [ ] **D7.3:** Public repo audit: Ensure zero `.env` or credentials committed in git history. *(0.5h)*
- [ ] **D7.4:** Draft and verify final submission tweet for X with `#ZeroToChat` and `@CometChat`. *(1.0h)*

### Oct 10 – Oct 11: Buffer & Submission Window
- Buffer for unexpected cloud platform changes or re-takes. Official submission on X.

---

## 🎬 Timed 90-Second Demo Script

```
00:00 - 00:08  [SCREEN 1: THE AGENT & MCP CONNECTOR]
               Camera: Full screen on IDE / Antigravity console.
               Action: Highlighting COMETCHAT_INTEGRATION.md showing real MCP tool executions
                       (list_cometchat_bundles, fetch_cometchat_doc_page, join-session).
               Narration: "To build KinesioLive, our agent referenced live CometChat documentation 
                          and verified bundles directly via the CometChat MCP."

00:08 - 00:18  [SCREEN 2: SPLIT SCREEN JOIN & PRESENCE]
               Camera: Split screen (Left: Patient profile | Right: Clinician profile).
               Action: Patient joins session. Clinician dashboard immediately flips presence indicator 
                       to 'Patient in Session: Active'. WebRTC video connects in under 2 seconds.
               Narration: "When the patient enters the virtual clinic, the clinician is notified 
                          via presence, and a secure CometChat Calls v5 session begins."

00:18 - 00:32  [SCREEN 3: SQUAT REPETITIONS & LIVE TELEMETRY]
               Camera: Focus on Patient performing 2 clean squats, with Clinician HUD visible.
               Action: Canvas skeleton tracks hips, knees, and ankles. Clinician HUD receives 10 Hz 
                       transient messages displaying real-time joint angles and rep counter incrementing (1, 2).
               Narration: "In-browser MediaPipe tracks body kinematics, streaming 10 Hz transient pose 
                          telemetry to the clinician without database overhead."

00:32 - 00:48  [SCREEN 4: BIOMECHANICAL VALGUS FORM ALERT]
               Camera: Focus on Clinician HUD as Patient intentionally caves left knee inward.
               Action: Left knee indicator flashes Red. Clinician HUD rings an alert: 
                       'Form Alert: Left Knee Valgus (+11.2% inward deviation)'.
               Narration: "When knee valgus occurs, KinesioLive computes the deviation and instantly 
                          pushes a structured custom message alert to the clinician's HUD."

00:48 - 01:08  [SCREEN 5: CLINICIAN COACHING CUE FEEDBACK LOOP]
               Camera: Clinician clicks quick-cue button 'Knees Out'.
               Action: Patient screen displays prominent animated coaching cue 'Knees Out!'. 
                       Patient adjusts stance; next rep executes with green depth rating.
               Narration: "The clinician taps 'Knees Out' to send an immediate coaching cue. 
                          The patient corrects form in real time."

01:08 - 01:24  [SCREEN 6: SESSION CONCLUSION & EXERCISE SUMMARY]
               Camera: Clinician clicks 'End Session'. Screen navigates to Session Analytics.
               Action: Group history is fetched via fetchPrevious(). Beautiful summary card renders: 4 Total Reps, 
                       94° Average Depth, 1 Valgus Alert, Chronological Timeline. 
                       Repo link & #ZeroToChat displayed. Total duration: 84s (6s safety buffer under 90s).
               Narration: "The chat history is the medical exercise log. Built with CometChat Calls, 
                          Groups, and Custom Messages for #ZeroToChat."
```

---

## 🛡️ Risk Register & Mitigations

| Risk ID | Risk Description | Severity | Likelihood | Pre-emptive Mitigation Strategy |
|---|---|---|---|---|
| **R1** | Pose inference CPU throttling degrades video call | High | Med | Run Pose Landmarker in `VIDEO` mode with GPU delegate at 640x480 resolution; decouple inference from render thread using `requestVideoFrameCallback`. |
| **R2** | LocalStorage user session collision between tabs | High | High | Strict deployment rule: Patient in Chrome Profile A, Clinician in Chrome Profile B (or Incognito). `sessionGuard` checks URL role against active auth user. |
| **R3** | Frontal camera depth inaccuracy | Med | High | Use normalized hip-descent ratio and MediaPipe 3D `worldLandmarks` instead of foreshortened 2D knee angle; prioritize 2D valgus deviation which is geometrically precise. |
| **R4** | Render free-tier cold start ruins live demo | High | Med | Include automated `GET /api/health` warming script 5 minutes prior to demo recording; serve web and API from single Express process. |
| **R5** | Message rate-limiting under high-frequency pose streaming | High | Low | Telemetry is strictly sent over `sendTransientMessage` (fire-and-forget, zero database writes) and capped at 10 Hz via client token bucket. |
| **R6** | Camera permission denied over network IP | Critical | Med | Production build strictly deployed over HTTPS via Render; localhost exempt during local development. |
| **R7** | Demo video exceeds 90-second hard limit | Critical | Med | Rehearse script with physical timer; aim for 82–85 seconds total duration during Day 6 insurance take. |
| **R8** | CometChat Auth/REST credentials exposed in build | Critical | Low | REST Key strictly isolated in Express backend environment variables; client only receives short-lived Auth Tokens minted on-demand. |

---

## ✂️ The Scope Cut List (Order of Shedding Under Time Pressure)

If engineering delays occur, features will be dropped in this strict priority sequence:
1. **Free-Text Chat Panel:** Rely entirely on the HUD, telemetry, and quick-cue buttons.
2. **Audio/Video Device Selector Dialog:** Fall back to browser default microphone and camera.
3. **Advanced Biomechanics Metrics (Cadence/Tempo):** Retain only rep count and knee valgus alerts.
4. **Typing Indicators:** Retain online presence ("Patient in Session") and drop typing dots.
5. **Timeline Chart in Summary:** Retain numerical summary metrics (Reps, Max Depth, Alerts) and drop the SVG timeline curve.

**Protected Non-Negotiable Core (NEVER DROPPED):**
- CometChat Calls SDK v5 live two-way video.
- MediaPipe skeleton overlay & rep counting on Patient screen.
- 10 Hz transient pose telemetry to Clinician HUD.
- Knee valgus custom message alert with measured value.
- Clinician "Knees Out" coaching cue to Patient.
- End-of-session summary fetched from persisted group history.
- Real MCP tool execution log visible on screen.
