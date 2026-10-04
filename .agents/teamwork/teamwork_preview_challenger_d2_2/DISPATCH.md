# Task Assignment: S3 Calls & S4 Persistence Contract Challenge (Challenger 2)

## Role & Archetype
- TypeName: teamwork_preview_challenger
- Role: S3 Calls & S4 Persistence Contract Challenger
- Working directory: d:/TP/Hackathon/Cometchat/.agents/teamwork/teamwork_preview_challenger_d2_2/

## Context & Inputs
- User Request: `d:/TP/Hackathon/Cometchat/.agents/teamwork/ORIGINAL_REQUEST.md` (Section `## 2026-10-03T19:41:01Z`)
- Milestone Scope: `d:/TP/Hackathon/Cometchat/.agents/teamwork/orchestrator_2/SCOPE.md`
- Target Code: `client/src/spikes/s3-calls/`, `client/src/spikes/s4-custom/`, `client/src/spikes/utils/tokenService.ts`

## Mission
1. Empirically verify Spike S3 logic:
   - Challenge `startAudioMuted` logic: verify clinician role sets `startAudioMuted: true` and patient role sets `false`.
   - Challenge connection latency calculation: verify precision stopwatch and $< 3.0$ s thresholding.
   - Challenge session token handling in `tokenService.ts`: verify request payload, error handling on 500/network failures.
2. Empirically verify Spike S4 logic:
   - Challenge custom message burst generator: verify exactly 25 messages across `kine.rep`, `kine.alert`, `kine.cue`.
   - Challenge chronological ordering assertion: test that `persistenceRunner` strictly validates timestamp sequence ($t_1 \le t_2 \le \dots$) and detects any out-of-order or dropped messages.
   - Challenge `MessagesRequestBuilder` query parameters: verify `.setGUID()` (uppercase), `.setCategories(['custom'])`, `.setLimit(30)` or greater.
3. Write and execute an automated vitest stress test file (e.g. `tests/e2e/spike_s3_s4_stress.test.ts`).
4. Run verification command:
   ```powershell
   pnpm exec vitest run tests/e2e/spike_s3_s4_stress.test.ts; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
   ```
5. State clear verdict: **APPROVE** or **REQUEST_CHANGES**.

## Output
Write `report.md` and deliver `handoff.md` with your verdict in your working directory. Send a completion message when done.

## 2026-10-03T20:23:02Z
You are Challenger 2 (S3 Calls & S4 Persistence Contract Challenger).
Your working directory is: d:/TP/Hackathon/Cometchat/.agents/teamwork/teamwork_preview_challenger_d2_2/
Read your task in d:/TP/Hackathon/Cometchat/.agents/teamwork/teamwork_preview_challenger_d2_2/DISPATCH.md, ORIGINAL_REQUEST.md, SCOPE.md, and target code in client/src/spikes/s3-calls/ and s4-custom/.
Empirically challenge Calls v5 startAudioMuted logic, connection latency timer, 25 custom messages burst, chronological monotonicity, and MessagesRequestBuilder parameters.
Write and run an automated vitest test suite (tests/e2e/spike_s3_s4_stress.test.ts).
Write report.md and handoff.md with a clear verdict: APPROVE or REQUEST_CHANGES. Send a completion message back to 81566c86-b749-47c0-8b25-a5af0578bdb3 when done.
