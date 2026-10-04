# Task Assignment: S1 Pose & S2 Telemetry Stress Challenge (Challenger 1)

## Role & Archetype
- TypeName: teamwork_preview_challenger
- Role: S1 Pose & S2 Telemetry Stress Challenger
- Working directory: d:/TP/Hackathon/Cometchat/.agents/teamwork/teamwork_preview_challenger_d2_1/

## Context & Inputs
- User Request: `d:/TP/Hackathon/Cometchat/.agents/teamwork/ORIGINAL_REQUEST.md` (Section `## 2026-10-03T19:41:01Z`)
- Milestone Scope: `d:/TP/Hackathon/Cometchat/.agents/teamwork/orchestrator_2/SCOPE.md`
- Target Code: `client/src/spikes/s1-pose/`, `client/src/spikes/s2-transient/`, `client/src/spikes/utils/stats.ts`

## Mission
1. Empirically verify Spike S1 logic:
   - Challenge the FPS calculation and rolling window math (`FpsMeter`). Does it correctly detect $< 15$ FPS and $\ge 15$ FPS?
   - Challenge `ProceduralHumanVideoGenerator`: does it generate canvas frames with appropriate dimensions and 30 FPS timing?
   - Challenge 33-landmark structure: are all 33 keypoints accounted for, with valid coordinate bounds?
2. Empirically verify Spike S2 logic:
   - Challenge `TelemetryTokenBucket`: does it strictly throttle to 10 Hz under high-frequency call bursts?
   - Challenge percentile math in `stats.ts` (`calculatePercentile`, p50, p95): test with known distributions, edge cases (empty array, 1 element, 600 elements).
   - Challenge packet loss calculation: test 0% loss, 1.5% loss, and >= 2.0% loss thresholding.
3. Write and execute an automated vitest stress test file (e.g. `tests/e2e/spike_s1_s2_stress.test.ts`).
4. Run verification command:
   ```powershell
   pnpm exec vitest run tests/e2e/spike_s1_s2_stress.test.ts; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
   ```
5. State clear verdict: **APPROVE** or **REQUEST_CHANGES**.

## Output
Write `report.md` and deliver `handoff.md` with your verdict in your working directory. Send a completion message when done.


## 2026-10-03T20:23:02Z
From: 81566c86-b749-47c0-8b25-a5af0578bdb3
Content: You are Challenger 1 (S1 Pose & S2 Telemetry Stress Challenger).
Your working directory is: d:/TP/Hackathon/Cometchat/.agents/teamwork/teamwork_preview_challenger_d2_1/
Read your task in d:/TP/Hackathon/Cometchat/.agents/teamwork/teamwork_preview_challenger_d2_1/DISPATCH.md, ORIGINAL_REQUEST.md, SCOPE.md, and target code in client/src/spikes/s1-pose/ and s2-transient/.
Empirically challenge FpsMeter, 33-landmark structure, ProceduralHumanVideoGenerator, TelemetryTokenBucket, and percentile math.
Write and run an automated vitest test suite (tests/e2e/spike_s1_s2_stress.test.ts).
Write report.md and handoff.md with a clear verdict: APPROVE or REQUEST_CHANGES. Send a completion message back to 81566c86-b749-47c0-8b25-a5af0578bdb3 when done.
