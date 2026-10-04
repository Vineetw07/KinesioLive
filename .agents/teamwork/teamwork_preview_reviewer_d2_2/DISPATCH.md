# Task Assignment: CometChat & MediaPipe Protocol Review (Reviewer 2)

## Role & Archetype
- TypeName: teamwork_preview_reviewer
- Role: CometChat & MediaPipe Protocol Reviewer
- Working directory: d:/TP/Hackathon/Cometchat/.agents/teamwork/teamwork_preview_reviewer_d2_2/

## Context & Inputs
- User Request: `d:/TP/Hackathon/Cometchat/.agents/teamwork/ORIGINAL_REQUEST.md` (Section `## 2026-10-03T19:41:01Z`)
- Milestone Scope: `d:/TP/Hackathon/Cometchat/.agents/teamwork/orchestrator_2/SCOPE.md`
- Worker Handoff: `d:/TP/Hackathon/Cometchat/.agents/teamwork/teamwork_preview_worker_spikes/handoff.md`
- CometChat Rules & Specs: `.cometchat/skills/RULES.md`, `.cometchat/skills/cometchat-js-v5-sdk/SKILL.md`
- Source Files: `client/src/spikes/s1-pose/`, `client/src/spikes/s2-transient/`, `client/src/spikes/s3-calls/`, `client/src/spikes/s4-custom/`, `COMETCHAT_INTEGRATION.md`

## Mission
1. Review Spike S1: MediaPipe PoseLandmarker init, GPU/CPU fallback, rVFC video element tapping, 33 landmark extraction, rolling & sustained FPS benchmark ($\ge 15$ FPS), synthetic video generator.
2. Review Spike S2: 10 Hz rate limiter token bucket, `CometChat.sendTransientMessage`, receiver listener, p95 latency ($< 400$ ms), packet loss ($< 2.0\%$).
3. Review Spike S3: Calls v5 sequence (`loginWithAuthToken` -> `generateToken` -> `joinSession`), `startAudioMuted: true` for clinician, container sizing, latency timer.
4. Review Spike S4: 25 custom messages burst, `MessagesRequestBuilder.setGUID().setCategories(['custom']).fetchPrevious()`, chronological sequence verification.
5. Review Security & Secret Isolation: Confirm zero client secrets imported.
6. Run verification triad:
   ```powershell
   pnpm exec tsc --noEmit; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
   pnpm --filter @kinesio/client build; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
   ```
7. State clear verdict: **APPROVE** or **REQUEST_CHANGES**.

## Output
Write `report.md` and deliver `handoff.md` with your verdict in your working directory. Send a completion message when done.


## 2026-10-03T20:23:02Z
You are Reviewer 2 (CometChat & MediaPipe Protocol Reviewer).
Your working directory is: d:/TP/Hackathon/Cometchat/.agents/teamwork/teamwork_preview_reviewer_d2_2/
Read your task in d:/TP/Hackathon/Cometchat/.agents/teamwork/teamwork_preview_reviewer_d2_2/DISPATCH.md, ORIGINAL_REQUEST.md, SCOPE.md, and worker handoff.
Review client/src/spikes/s1-pose/, s2-transient/, s3-calls/, s4-custom/, COMETCHAT_INTEGRATION.md, and secret isolation.
Execute verification commands (pnpm exec tsc --noEmit; pnpm --filter @kinesio/client build).
Write report.md and handoff.md with a clear verdict: APPROVE or REQUEST_CHANGES. Send a completion message back to 81566c86-b749-47c0-8b25-a5af0578bdb3 when done.
