# Technical Requirements Document (TRD) — KinesioLive

> **System:** KinesioLive Tele-Rehabilitation Engine  
> **Master Roadmap:** [implementation_plan.md](./implementation_plan.md)  
> **Product Scope:** [prd.md](./prd.md)  
> **MCP Log:** [../COMETCHAT_INTEGRATION.md](../COMETCHAT_INTEGRATION.md)

---

## 1. System Architecture & Tech Stack

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

### Technology Matrix
- **Runtime:** Node.js v22.19 / TypeScript 5.x
- **Package Manager:** `pnpm`
- **Frontend App:** React 18/19 + Vite + Plain CSS / Tailwind tokens + Framer Motion
- **CometChat Libraries:**
  - `@cometchat/chat-sdk-javascript` (JS SDK v4)
  - `@cometchat/calls-sdk-javascript` (Calls SDK v5)
- **Computer Vision:** `@mediapipe/tasks-vision` (Pose Landmarker, BlazePose 33 Keypoints)
- **Backend Server:** Express.js (Single origin for API and static `dist/`)
- **Deployment Platform:** Render (Single Web Service with automated HTTPS)

---

## 2. Verified Data Contracts & Message Schemas

All message payloads adhere to schema version 1 (`v: 1`):

```typescript
export const SCHEMA_VERSION = 1 as const;
export type Side = "L" | "R";
export type SquatPhase = "standing" | "descending" | "bottom" | "ascending" | "lost";

export interface Envelope {
  v: typeof SCHEMA_VERSION;
  sid: string;          // Session ID (corresponds to Group GUID without prefix)
  t: number;            // Timestamp in epoch milliseconds
}

// CHANNEL: TRANSIENT (CometChat.sendTransientMessage to RECEIVER_TYPE.GROUP)
export interface KinePosePayload extends Envelope {
  type: "kine.pose";
  seq: number;
  fps: number;
  phase: SquatPhase;
  kneeFlexionDeg: { L: number | null; R: number | null }; // 3D sagittal flexion from worldLandmarks
  valgusDevPct: { L: number | null; R: number | null };   // % medial deviation relative to standing leg length
  depthRatio: number;   // 0.0 (standing) -> 1.0 (crease at knee height)
  vis: number;
  reps: number;
}

// CHANNEL: CUSTOM PERSISTED (CometChat.sendCustomMessage to RECEIVER_TYPE.GROUP)
export interface KineRepPayload extends Envelope {
  type: "kine.rep";
  n: number;
  minKneeDeg: number;
  depth: "shallow" | "good" | "deep";
  durMs: number;
  tempo: "fast" | "controlled" | "slow";
  formScore?: number;
  formRating?: "excellent" | "good" | "needs_work";
}

export interface KineAlertPayload extends Envelope {
  type: "kine.alert";
  kind: "knee_valgus";
  side: Side;
  value: number;        // Inward deviation percentage (e.g. 11.2%)
  thresholdPct: number; // 8.0%
  repN: number;
  phase: SquatPhase;
  note: "Form alert (biomechanical feedback)";
}

export interface KineCuePayload extends Envelope {
  type: "kine.cue";
  cue: "knees_out" | "slower" | "chest_up" | "good_depth";
  text: string;
}

export interface KineSessionMarkerPayload extends Envelope {
  type: "kine.session";
  action: "start" | "end" | "summary";
  clinicianUid: string;
  patientUid: string;
}
```

---

## 3. Biomechanical Formulas & Landmark Topology

### Keypoints (BlazePose)
- Left: Hip (`23`), Knee (`25`), Ankle (`27`)
- Right: Hip (`24`), Knee (`26`), Ankle (`28`)

### 1. 3D Sagittal Knee Flexion (from `worldLandmarks`)
Computed directly from metric 3D coordinates $(\mathbf{p}_h, \mathbf{p}_k, \mathbf{p}_a)$:
$$\mathbf{v}_1 = \mathbf{p}_h - \mathbf{p}_k, \quad \mathbf{v}_2 = \mathbf{p}_a - \mathbf{p}_k$$
$$\theta_{\text{knee}} = \arccos\left(\frac{\mathbf{v}_1 \cdot \mathbf{v}_2}{\|\mathbf{v}_1\| \|\mathbf{v}_2\|}\right) \times \frac{180}{\pi}$$

### 2. Frontal Knee Valgus Calculation (Calibrated Standing Baseline)
In unmirrored pixel camera space $(X = x \cdot W, Y = y \cdot H)$:
1. **Standing Baseline Calibration:** During standing posture ($t=0$), record standing leg length:
   $$L_{\text{standing}} = \sqrt{(X_a^{\text{stand}} - X_h^{\text{stand}})^2 + (Y_a^{\text{stand}} - Y_h^{\text{stand}})^2}$$
2. **Current Neutral Axis Position:** At current knee height $Y_k$:
   $$X_{\text{baseline}} = X_h + (X_a - X_h) \times \frac{Y_k - Y_h}{Y_a - Y_h}$$
3. **Medial Deviation Percentage (Polarity-Corrected):**
   $$\text{valgusDevPct} = \frac{\text{polarity} \times (X_k - X_{\text{baseline}})}{L_{\text{standing}}} \times 100$$
   *Polarity in unmirrored camera coordinates:*
   - **Left Leg (appears on right side of sensor, $X \approx 0.60$):** Medial/inward movement decreases $X$, so $\text{polarity} = -1$.
   - **Right Leg (appears on left side of sensor, $X \approx 0.40$):** Medial/inward movement increases $X$, so $\text{polarity} = +1$.
   *Result:* Inward collapse is always **positive (+)**.
4. **Trigger Threshold:** $\text{valgusDevPct} > +8.0\%$ for $\ge 3$ consecutive frames ($\approx 200$ ms) during descent/bottom with a 4.0s cooldown per side.

### 3. Rep Counter State Machine & Rep Form Scoring
Normalized hip descent from standing baseline:
$$\text{depthRatio} = \frac{Y_{\text{hip}}(t) - Y_{\text{hip}}(\text{standing})}{Y_{\text{knee}}(\text{standing}) - Y_{\text{hip}}(\text{standing})}$$
- **Descent:** $\text{depthRatio} > 0.25$ or $\theta_{\text{knee}} < 150^\circ$
- **Bottom:** $\text{depthRatio} > 0.85$ or $\theta_{\text{knee}} < 100^\circ$
- **Ascent:** $\text{depthRatio}$ decreasing and $\theta_{\text{knee}} > 110^\circ$
- **Rep Validated:** Re-enters standing ($\theta_{\text{knee}} > 160^\circ$) if minimum depth reached $< 110^\circ$ and rep duration $\ge 800$ ms.
- **Form Scoring ($0..100$):**
  - Depth Score ($0..40$ pts): Peak depth penalizes shallow squats, awards maximum points for parallel/deep ranges.
  - Valgus Penalty (deducts up to $35$ pts): Scaled by peak medial knee deviation.
  - Tempo Score ($0..25$ pts): Evaluates rep duration ($1.8\text{s} - 4.0\text{s}$ controlled target).
  - Rating: $\ge 85 \to$ `"excellent"`, $\ge 65 \to$ `"good"`, $< 65 \to$ `"needs_work"`.

### 4. Adaptive Signal Processing (1-Euro Filter)
To eliminate high-frequency video landmark jitter while preserving low-latency trajectory transitions:
- Low-speed smoothing cutoff: $f_c^{\text{min}} = 1.0\text{ Hz}$.
- Speed coefficient: $\beta = 0.007$.
- Filter dynamically adapts smoothing window: steady pose receives aggressive jitter suppression while rapid descent/ascent avoids lag.

### 5. Subpixel Canvas Overlay Alignment (`canvasOverlayAligner.ts`)
- Letterbox & pillarbox compensation computes exact active video viewport offsets $(v_x, v_y, v_w, v_h)$.
- Mirrored coordinate reflection ($x \to 1 - x$) preserves natural user feedback without CSS transform distortion.
- Full anatomical connectivity renders clavicle midline, torso boundary, sternum, and upper/lower extremities aligned 1:1 on patient video feed.

### 6. Dual-Transport Telemetry Sync (`telemetryTransport.ts`)
- **Local Channel:** `BroadcastChannel("kinesiolive-telemetry")` for instantaneous (< 1ms) zero-latency UI updates during local testing or dual-tab simulations.
- **Remote Channel:** `CometChat.sendTransientMessage` throttled to 10 Hz via token bucket for cross-network WebRTC synchronization.

---

## 4. Backend REST Endpoints & Lifecycle

### Client URL Routing & Role Isolation
- **Landing Page & Role Selection:** `https://<domain>/` with animated role portals and room code creator.
- **Clinician Lobby & Studio:** `https://<domain>/?role=clinician&session=<sessionId>`
- **Patient Lobby & Studio:** `https://<domain>/?role=patient&session=<sessionId>`
- **Clinician Link Sharing:** Clinician UI renders an instantaneous "Copy Patient Invite Link" button copying the exact patient URL with matching `sessionId`.

### API Endpoints
- `POST /api/session`:
  - **Request Body:** `{ role: "clinician" | "patient", sessionId?: string }`
  - **Lifecycle Execution:**
    1. If `sessionId` omitted, generates session GUID (`kine-<timestamp>`).
    2. Upserts user accounts via CometChat REST `POST /v3/users` (ensures `dr-demo` and `pt-demo` exist before token minting to prevent `404: ERR_UID_NOT_FOUND`).
    3. Creates CometChat group via `POST /v3/groups` (`guid: sessionId`, `type: public`) with both users pre-added as participants (ensuring message permissions).
    4. Generates Auth Tokens via `POST /v3/users/{uid}/auth_tokens` using server REST API Key.
    5. Returns `{ sessionId, authToken, uid, appId, region }` to client.
- `GET /api/health`: Health probe validating CometChat REST reachability and node process uptime.


---

## 🔄 Dynamic Update Trigger Matrix
- If schemas change, update Section 2 immediately and synchronize with `shared/contract.ts`.
- Log all new API parameters or endpoint adjustments here before editing server code.
