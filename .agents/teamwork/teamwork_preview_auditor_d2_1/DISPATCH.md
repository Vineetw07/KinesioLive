# Task Assignment: Forensic Integrity Audit (Auditor 1)

## Role & Archetype
- TypeName: teamwork_preview_auditor
- Role: Forensic Integrity Auditor
- Working directory: d:/TP/Hackathon/Cometchat/.agents/teamwork/teamwork_preview_auditor_d2_1/

## Context & Inputs
- User Request: `d:/TP/Hackathon/Cometchat/.agents/teamwork/ORIGINAL_REQUEST.md` (Section `## 2026-10-03T19:41:01Z`)
- Milestone Scope: `d:/TP/Hackathon/Cometchat/.agents/teamwork/orchestrator_2/SCOPE.md`
- Target Code: `client/src/App.tsx`, all files in `client/src/spikes/`, `COMETCHAT_INTEGRATION.md`

## Audit Mission (Hard Forensic Gating)
Perform a rigorous forensic integrity analysis across the entire Milestone D2.1–D2.5 implementation:
1. **Zero Mocking / Facade Invariant:**
   - Verify that `SpikePoseInference`, `SpikeTelemetryThroughput`, `SpikeCallsJoin`, and `SpikePersistenceFetch` execute genuine computational logic rather than returning hardcoded constants or fake pre-baked outputs.
   - Verify that `FpsMeter` calculates real time deltas from `performance.now()`.
   - Verify that `TelemetryTokenBucket` genuinely schedules and restricts message transit.
   - Verify that `CallsRunner` calls authentic CometChat Chat & Calls SDK methods.
   - Verify that `PersistenceRunner` genuinely generates and queries custom messages.
2. **Secret Isolation Invariant:**
   - Verify that zero server secrets (`COMETCHAT_AUTH_KEY`, `COMETCHAT_REST_API_KEY`, or server API keys) are imported, hardcoded, or present anywhere in `client/src/*`.
3. **CometChat Core Rules Compliance:**
   - Verify adherence to `.cometchat/skills/RULES.md` and `.cometchat/skills/cometchat-js-v5-sdk/SKILL.md`.
   - Verify that `startAudioMuted: true` is genuinely set on clinician call join.
   - Verify that `containerElement` has explicit dimensions.
   - Verify that `COMETCHAT_INTEGRATION.md` documents genuine MCP tool lookups and SDK signatures.
4. **Build Triad Integrity:**
   - Verify `pnpm typecheck` and `pnpm --filter @kinesio/client build` pass without `@ts-ignore` or lint suppressions.
5. State clear verdict: **CLEAN** or **INTEGRITY VIOLATION**.

## Output
Write `report.md` and deliver `handoff.md` with your verdict in your working directory. Send a completion message when done.


## 2026-10-03T20:23:02Z
You are Forensic Auditor 1 (Forensic Integrity Auditor).
Your working directory is: d:/TP/Hackathon/Cometchat/.agents/teamwork/teamwork_preview_auditor_d2_1/
Read your task in d:/TP/Hackathon/Cometchat/.agents/teamwork/teamwork_preview_auditor_d2_1/DISPATCH.md, ORIGINAL_REQUEST.md, SCOPE.md, and all code in client/src/spikes/, client/src/App.tsx, and COMETCHAT_INTEGRATION.md.
Audit for genuine computational logic vs mocking/hardcoded results, verify secret isolation (zero client secrets), verify CometChat core rules compliance, and verify build integrity.
Write report.md and handoff.md with a binary verdict: CLEAN or INTEGRITY VIOLATION. Send a completion message back to 81566c86-b749-47c0-8b25-a5af0578bdb3 when done.
