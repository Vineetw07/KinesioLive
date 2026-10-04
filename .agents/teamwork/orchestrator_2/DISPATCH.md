# DISPATCH to Project Orchestrator (orchestrator_2)

## Mission
Build an interactive, in-browser spikes testbed mounted at `/spikes` (`client/src/spikes/SpikesHarness.tsx`) in KinesioLive to execute, benchmark, and formally validate CometChat Calls v5 and MediaPipe Pose Spikes S1 through S4 (Milestones D2.1–D2.5).

## Working Directory
`d:/TP/Hackathon/Cometchat/.agents/teamwork/orchestrator_2/`

## User Request Reference
`d:/TP/Hackathon/Cometchat/.agents/teamwork/ORIGINAL_REQUEST.md` (see section `## 2026-10-03T19:41:01Z`)

## Constraints & Requirements
- Follow `.cometchat/skills/RULES.md` and `.cometchat/skills/cometchat-js-v5-sdk/SKILL.md`
- Maintain `COMETCHAT_INTEGRATION.md` for any MCP-verified operations
- Comply with `docs/trd.md`, `docs/audit.md`, and `shared/contract.ts`
- Implement Spikes S1 (Pose), S2 (10 Hz transient messages), S3 (Calls v5 join with clinician audio muted), S4 (custom message burst & fetchPrevious), and S5 (interactive testbed HUD at `/spikes`)
- Verify using: `pnpm exec tsc --noEmit` and `pnpm --filter @kinesio/client build`


## 2026-10-03T19:42:11Z
You are the Project Orchestrator for KinesioLive.
Your working directory is: d:/TP/Hackathon/Cometchat/.agents/teamwork/orchestrator_2/
The authoritative user request is recorded in: d:/TP/Hackathon/Cometchat/.agents/teamwork/ORIGINAL_REQUEST.md under section ## 2026-10-03T19:41:01Z.

Task:
Build an interactive, in-browser spikes testbed mounted at `/spikes` (`client/src/spikes/SpikesHarness.tsx`) in KinesioLive to execute, benchmark, and formally validate CometChat Calls v5 and MediaPipe Pose Spikes S1 through S4 (Milestones D2.1–D2.5).

Key Requirements & Constraints:
- MediaPipe Pose Inference on Video Element (Spike S1 / D2.1)
- Dual-Profile CometChat Calls v5 Session Join with startAudioMuted: true for clinician (Spike S3 / D2.2)
- 10 Hz Transient Message Telemetry Throughput (Spike S2 / D2.3)
- Custom Message Persistence & History Retrieval via MessagesRequestBuilder (Spike S4 / D2.4)
- Interactive Testbed HUD & Kill-Switch Evaluation Gate at `/spikes` (Spike S5 / D2.5)
- Follow all CometChat core rules, security invariants (no secrets exposed to client), and verification triad (`pnpm exec tsc --noEmit`, `pnpm --filter @kinesio/client build`).
- Maintain `plan.md` and update `progress.md` regularly in your working directory `d:/TP/Hackathon/Cometchat/.agents/teamwork/orchestrator_2/`.
- Coordinate and dispatch specialists as needed.
- When done, report completion so a Victory Audit can be conducted.
