# Phase 3 Implementation Plan (Milestones D4.2 – D4.5)

## Architecture Overview
KinesioLive Phase 3 integrates the frontend views and CometChat real-time communication:
1. Design tokens & motion physics (`client/src/styles/tokens.css`, `client/src/styles/motionPresets.ts`).
2. Patient View (`client/src/views/Patient.tsx`) with MediaPipe pose tracking tapping live CometChat Calls v5 video stream via `requestVideoFrameCallback`, running biomechanics engine, skeletal canvas overlay, and 10 Hz rate-capped transient messaging.
3. Clinician View (`client/src/views/Clinician.tsx`) joining WebRTC with `startAudioMuted: true`, decoupled telemetry stream (`useTelemetryStream.ts`), 60 fps smoothed HUD, and quick-action cue buttons (`kine.cue`).
4. Session Guard (`client/src/utils/sessionGuard.ts`) protecting cross-profile session state with non-destructive conflict alerts.
5. Verification suite (`tests/e2e/interactions.test.ts`, session guard tests, alert cooldown tests) and CometChat MCP verification logging.

## Feature Inventory & Milestones
| # | Milestone | Scope | Deliverables | Status |
|---|-----------|-------|--------------|--------|
| 0 | M0: Survey & Grounding | Map codebase, spikes, and contracts | `analysis.md` across 3 explorers | DONE |
| 1 | M1: Design Tokens (D4.2) | Semantic CSS variables & spring presets | `tokens.css`, `motionPresets.ts` | DONE |
| 2 | M2: Patient Studio (D4.3) | Video mount, pose loop, canvas, 10Hz telemetry | `Patient.tsx`, zero-contention tap, canvas | DONE |
| 3 | M3: Clinician Studio (D4.4)| Muted WebRTC, telemetry hook, 60fps HUD, cues | `Clinician.tsx`, `useTelemetryStream.ts`, cue pad | DONE |
| 4 | M4: Session Guard (D4.5) | URL params parsing, non-destructive modal, routing | `sessionGuard.ts`, `App.tsx` routing | DONE |
| 5 | M5: Verification & Audit | Triad verification, interaction tests, forensic audit | 344 tests green, MCP logged, Audit CLEAN | DONE |

## Interface Contracts & Constraints
- Clinician WebRTC: `startAudioMuted: true` in `SessionSettings`.
- Patient Camera: DOM video stream tap via `requestVideoFrameCallback`, no secondary `getUserMedia`.
- Transient rate-cap: 10 Hz via `TelemetryTokenBucket`.
- No raw hex colors: All UI colors use CSS variables from `tokens.css`.
- Zero crash-site masking: No `?.` or `@ts-ignore` to silence SDK/WebRTC errors.
- Zero console.log in 10 Hz telemetry or per-frame loops.
- MCP Logging: All MCP queries recorded in `COMETCHAT_INTEGRATION.md`.
