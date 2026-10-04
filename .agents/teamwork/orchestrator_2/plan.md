# Orchestration Plan - Spikes S1-S5 (Milestones D2.1-D2.5)

## Objective
Build an interactive, in-browser spikes testbed mounted at `/spikes` (`client/src/spikes/SpikesHarness.tsx`) in KinesioLive to execute, benchmark, and formally validate CometChat Calls v5 and MediaPipe Pose Spikes S1 through S4 (Milestones D2.1–D2.5).

## Strategy & Phases

### Phase 0: Survey & Discovery
- Dispatch 3 Explorers/Spec Miners in parallel:
  1. Client Architecture & Route Mounting (`/spikes`, React/Vite structure, styles)
  2. CometChat Headless Calls v5 & Chat SDK Contract & API patterns (transient 10Hz, custom messages, Calls v5 session join)
  3. MediaPipe Pose Landmarker browser execution, WASM/model asset loading, canvas/video pipeline, avoiding camera track contention
- Synthesize findings into `PROJECT.md` / `SCOPE.md`.

### Phase 1: Milestone Decomposition & Track Planning
- **Milestone 1 (D2.1 / S1)**: MediaPipe Pose Inference on Video Element (`client/src/spikes/s1-pose/`)
- **Milestone 2 (D2.2 / S3)**: Dual-Profile CometChat Calls v5 Session Join (`client/src/spikes/s3-calls/`)
- **Milestone 3 (D2.3 / S2)**: 10 Hz Transient Message Telemetry Throughput (`client/src/spikes/s2-transient/`)
- **Milestone 4 (D2.4 / S4)**: Custom Message Persistence & History Retrieval (`client/src/spikes/s4-custom/`)
- **Milestone 5 (D2.5 / S5)**: Interactive Testbed HUD & Kill-Switch Evaluation Gate (`client/src/spikes/SpikesHarness.tsx`, routing `/spikes`)
- **Milestone 6 (E2E / D2 Verification)**: Verification Triad (`tsc --noEmit`, client build, integration testing, gate reviews)

### Phase 2: Iteration Loop Execution
For each milestone:
1. Explorer(s) propose implementation plan.
2. Worker implements and executes builds/tests.
3. Reviewer(s) verify code quality, correctness, and interface contracts.
4. Challenger(s) test edge cases and stress behavior.
5. Forensic Auditor verifies integrity, lack of mocking/hardcoded results.
6. Gate check recorded in `GATE_STATUS.md`.

### Phase 3: Final Verification & Victory Audit
- Execute `pnpm exec tsc --noEmit` and `pnpm --filter @kinesio/client build`.
- Final audit and handoff to parent.
