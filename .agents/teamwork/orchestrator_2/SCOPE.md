# Scope: Spikes S1-S5 Testbed & Kill-Switch Evaluation Gate (Milestones D2.1–D2.5)

## Architecture
- Client-side interactive testbed mounted at `/spikes` via lightweight native pathname routing in `client/src/App.tsx` and dynamic `React.lazy` loading of `client/src/spikes/SpikesHarness.tsx`.
- Modular subsystem under `client/src/spikes/`:
  - `s1-pose/`: MediaPipe PoseLandmarker inference (`runningMode: "VIDEO"`), DOM video frame tapping via `requestVideoFrameCallback` to eliminate camera collisions, 33 2D/3D landmarks, and live FPS benchmark calculator ($\ge 15.0$ sustained FPS).
  - `s3-calls/`: Headless CometChat Calls v5 join sequence using server-minted auth token from `POST /api/session`, `startAudioMuted: true` on clinician, connection latency tracking ($< 3.0$ s).
  - `s2-transient/`: 10 Hz token-bucket rate limiter transmitting 600 `kine.pose` messages via `CometChat.sendTransientMessage` targeted to group GUID (`RECEIVER_TYPE.GROUP`), recording packet delivery, p95 latency ($< 400$ ms), and loss percentage ($< 2.0\%$).
  - `s4-custom/`: Burst transmission of 25 custom messages (`kine.rep`, `kine.alert`, `kine.cue`) using `CometChat.sendCustomMessage`, querying history using `MessagesRequestBuilder.setGUID(guid).setCategories(['custom']).setLimit(30).build().fetchPrevious()`, asserting 100% retrieval in strict chronological order.
  - `components/` & `utils/`: Reusable HUD cards, status chips (`PASS`/`FAIL`/`RUNNING`), telemetry log console, token service wrapper, and `KillSwitchGateTable.tsx` for D2.5 formal sign-off.
  - `SpikesHarness.tsx`: Top-level orchestrator HUD with tab switcher (`Overview / Gate`, `S1: Pose`, `S2: Telemetry`, `S3: Calls v5`, `S4: Persistence`), live status chips, and master "Run All Spikes" test runner.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | S1 MediaPipe Pose Landmarker | PoseLandmarker init, WASM loading, GPU/CPU fallback, 33 keypoints | M1 | R1, TRD §3 |
| 2 | S1 Camera Contention Defense | DOM video tapping via `requestVideoFrameCallback`, zero camera collision | M1 | R1, TRD §1 |
| 3 | S1 Live FPS Benchmark | Rolling 30-frame window + sustained benchmark accumulator ($\ge 15.0$ FPS) | M1 | R1, Acceptance |
| 4 | S1 Synthetic Video Fallback | 3-tier source (Webcam, Reference video, Procedural canvas stream) | M1 | Acceptance |
| 5 | S3 Calls v5 Initialization & Login | Chat SDK login -> Calls SDK init & `loginWithAuthToken` using `/api/session` token | M2 | R2, SKILL |
| 6 | S3 Clinician startAudioMuted | Session settings with `startAudioMuted: true` for clinician role | M2 | R2, Acceptance |
| 7 | S3 Call Session Join & Latency | Calls v5 `generateToken` + `joinSession` into container, connection latency $< 3.0$ s | M2 | R2, Acceptance |
| 8 | S2 10 Hz Token Bucket Rate Limiter | Precise 10 Hz rate limiter transmitting 600 `kine.pose` messages | M3 | R3, TRD §2 |
| 9 | S2 Transient Message Dispatch | `CometChat.sendTransientMessage` to group GUID (`RECEIVER_TYPE.GROUP`) | M3 | R3, Acceptance |
| 10 | S2 Telemetry Latency & Loss Meter | Listener tracking p50, p95 latency ($< 400$ ms) and packet loss ($< 2.0\%$) | M3 | R3, Acceptance |
| 11 | S4 Custom Message Burst | Burst of 25 custom messages (`kine.rep`, `kine.alert`, `kine.cue`) | M4 | R4, Acceptance |
| 12 | S4 History Retrieval & Ordering | `MessagesRequestBuilder.setGUID().setCategories(['custom']).fetchPrevious()` asserting 100% chronological order | M4 | R4, Acceptance |
| 13 | S5 Native Pathname Routing | `/spikes` mount in `client/src/App.tsx` with `React.lazy` code splitting | M5 | R5, Survey 1 |
| 14 | S5 Interactive Testbed HUD | Split-tab dashboard, metric cards, real-time log console, status chips | M5 | R5, Survey 1 |
| 15 | S5 Kill-Switch Decision Gate | "Run All Spikes" runner + live PASS/FAIL evaluation table for D2.1–D2.5 sign-off | M5 | R5, Acceptance |
| 16 | D2 Full Verification Triad | `pnpm exec tsc --noEmit` and `pnpm --filter @kinesio/client build` zero errors | M6 | Acceptance |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | S1 MediaPipe Pose Inference | `client/src/spikes/s1-pose/` (loader, rVFC pipeline, FPS meter, 3-tier fallback) | none | DONE |
| 2 | S3 Dual-Profile Calls v5 Join | `client/src/spikes/s3-calls/` (session token login, joinSession, startAudioMuted) | none | DONE |
| 3 | S2 10 Hz Transient Telemetry | `client/src/spikes/s2-transient/` (token bucket, 600 msg burst, p95 & loss metrics) | none | DONE |
| 4 | S4 Custom Message Persistence | `client/src/spikes/s4-custom/` (25 custom msgs, MessagesRequestBuilder history) | none | DONE |
| 5 | S5 Testbed HUD & Kill-Switch Gate | `client/src/spikes/SpikesHarness.tsx`, routing in `App.tsx`, styles in `spikes.css` | M1, M2, M3, M4 | DONE |
| 6 | Verification Triad & Gate Sign-off | Automated TypeScript typecheck, Vite production build, E2E test suite | M1..M5 | DONE |

## Interface Contracts

### Spike Result & Benchmark Interfaces (`client/src/spikes/types.ts`)
```typescript
export type SpikeId = 's1-pose' | 's2-telemetry' | 's3-calls' | 's4-persistence';
export type SpikeStatus = 'idle' | 'running' | 'pass' | 'fail';

export interface SpikeMetrics {
  s1?: {
    instantFps: number;
    sustainedFps: number;
    avgLatencyMs: number;
    keypointsDetected: number;
    pass: boolean;
  };
  s2?: {
    messagesSent: number;
    messagesReceived: number;
    p50LatencyMs: number;
    p95LatencyMs: number;
    lossPct: number;
    pass: boolean;
  };
  s3?: {
    role: 'clinician' | 'patient';
    sessionId: string;
    connectLatencyMs: number;
    audioMuted: boolean;
    videoConnected: boolean;
    pass: boolean;
  };
  s4?: {
    sentCount: number;
    retrievedCount: number;
    chronologicalMatch: boolean;
    pass: boolean;
  };
}

export interface SpikeResult {
  id: SpikeId;
  name: string;
  status: SpikeStatus;
  metrics?: Record<string, number | string | boolean>;
  error?: string;
  durationMs?: number;
  timestamp: number;
}
```

## Code Layout
```
client/src/
├── App.tsx                          # Modified with native pathname route to /spikes
├── spikes/
│   ├── SpikesHarness.tsx            # Master HUD orchestrator & Kill-Switch Decision Gate
│   ├── spikes.css                   # HUD styles, chips, log stream, dark theme
│   ├── types.ts                     # SpikeId, SpikeResult, SpikeStatus, SpikeMetrics
│   ├── components/
│   │   ├── SpikeStatusChip.tsx      # PASS / FAIL / RUNNING / IDLE badge
│   │   ├── BenchmarkMetricCard.tsx  # Metric readout card (FPS, latency, loss, count)
│   │   ├── KillSwitchGateTable.tsx  # D2.5 formal sign-off checklist and summary table
│   │   └── TelemetryLogConsole.tsx  # Scrollable real-time event & error log viewer
│   ├── utils/
│   │   ├── tokenService.ts          # Wrapper for POST /api/session
│   │   └── stats.ts                 # Percentile calculations (p50, p95)
│   ├── s1-pose/
│   │   ├── SpikePoseInference.tsx   # Video, canvas, FPS readout, tier fallback controls
│   │   ├── poseRunner.ts            # PoseLandmarker loader, rVFC loop, FPS calculator
│   │   └── syntheticVideo.ts        # Reference/procedural canvas video stream generator
│   ├── s2-transient/
│   │   ├── SpikeTelemetryThroughput.tsx # 600-msg burst trigger, loss % & latency display
│   │   └── telemetryRunner.ts       # Token-bucket rate limiter & transient sender/receiver
│   ├── s3-calls/
│   │   ├── SpikeCallsJoin.tsx       # Dual-profile join UI, call container, latency timer
│   │   └── callsRunner.ts           # Calls v5 init, loginWithAuthToken, joinSession runner
│   └── s4-custom/
│       ├── SpikePersistenceFetch.tsx # Burst trigger & history chronological table
│       └── persistenceRunner.ts     # sendCustomMessage burst & fetchPrevious validator
```
