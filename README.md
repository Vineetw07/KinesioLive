# KinesioLive — Real-Time Biomechanical Telerehabilitation

[![Built for #ZeroToChat](https://img.shields.io/badge/Built%20for-%23ZeroToChat-lime)](https://cometchat.com)

KinesioLive connects patients and clinicians over a live video session, streaming real-time joint kinematics at 10 Hz so the clinician can detect knee valgus deviation and send instant coaching cues — all persisted in CometChat group message history.

## Architecture

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

## CometChat Integration

| CometChat Primitive | How KinesioLive Uses It |
|---|---|
| Calls SDK v5 (`CometChatCalls.joinSession`) | Two-way WebRTC video between patient and clinician |
| Transient Messages (`sendTransientMessage`) | 10 Hz pose telemetry stream to clinician HUD — zero DB writes |
| Custom Messages (`sendCustomMessage`) | Persisted exercise events: `kine.rep`, `kine.alert`, `kine.cue`, `kine.session` |
| Group Message History (`MessagesRequestBuilder.fetchPrevious`) | Post-session summary — group history is the medical exercise log |
| REST Auth Token API (`POST /v3/users/{uid}/auth_tokens`) | Server-minted tokens — `COMETCHAT_AUTH_KEY` never reaches the browser |

## Clinical Accuracy & Biomechanics Honesty

> ⚠️ **Clinical Accuracy Notice:** The valgus deviation calculation uses a calibrated
> standing baseline and frontal-plane landmark projection from MediaPipe BlazePose 3D
> world landmarks. It is an estimate suitable for real-time coaching feedback during a
> hackathon demonstration. It is **not** a validated clinical measurement tool and must
> not be used for medical diagnosis.

## Local Development

```bash
cp .env.example .env   # Fill in your CometChat credentials from dashboard.cometchat.com
pnpm install
pnpm run build
node server/dist/index.js
# Open http://localhost:5000/?role=clinician in Profile A
# Open http://localhost:5000/?role=patient  in Profile B
```

## Environment Variables

| Variable | Purpose | Where to find |
|---|---|---|
| `COMETCHAT_APP_ID` | Your CometChat App ID | CometChat Dashboard → Apps |
| `COMETCHAT_REGION` | App region (`us`, `eu`, `in`) | CometChat Dashboard → Apps |
| `COMETCHAT_AUTH_KEY` | Dev-only auth key (not sent to browser in prod) | CometChat Dashboard → API & Auth Keys |
| `COMETCHAT_REST_API_KEY` | Server-side REST API key | CometChat Dashboard → API & Auth Keys |

## Live Demo

- Live URL: [https://kinesiolive.onrender.com](https://kinesiolive.onrender.com)

## MCP Evidence

See [COMETCHAT_INTEGRATION.md](./COMETCHAT_INTEGRATION.md) — 24 verified MCP tool calls including `list_cometchat_bundles`, `fetch_cometchat_doc_page`, and `search_cometchat_docs` against the live CometChat documentation server.

---

Built with ❤️ for #ZeroToChat by @CometChat
