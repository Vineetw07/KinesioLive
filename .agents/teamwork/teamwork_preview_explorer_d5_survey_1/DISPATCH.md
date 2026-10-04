# DISPATCH: Survey Explorer 1 (D5.1 & D5.2 Ground Truth)

## Task Objective
Inspect existing code and ground truth for Milestone D5.1 (Outbox Retry Queue in Patient.tsx) and Milestone D5.2 (Coaching Cue Toast & Styling).

## Source of Truth
Read `d:/TP/Hackathon/Cometchat/.agents/teamwork/ORIGINAL_REQUEST.md` (specifically lines 307–553 under section `## 2026-10-04T07:34:42Z`).

## Files to Inspect
- `client/src/views/Patient.tsx`
- `client/src/views/Clinician.tsx`
- `client/src/styles/tokens.css`
- `client/src/styles/motionPresets.ts`

## Key Questions to Answer
1. In `client/src/views/Patient.tsx`, examine `dispatchCustomRepMessage` and `dispatchCustomAlertMessage` (around lines 446–476). Where are the empty `catch {}` blocks?
2. How is CometChat connection managed in `Patient.tsx`? How can a `CometChat.ConnectionListener` be added to flush on `onConnected`? Where should the listener be registered and cleaned up?
3. What is the design for the in-memory outbox queue (ref or module-level, tracking retry count up to 3, warning on discard, non-blocking to rVFC)?
4. In `Patient.tsx`, find the toast dismiss timer (around line 199). What is the exact line and code to change 3500ms to 4000ms?
5. In `client/src/styles/tokens.css`, where should `--accent-cyan`, `--accent-cyan-tint`, and `--shadow-glow-cyan` be placed?
6. In `Patient.tsx`, how is the coaching cue toast currently styled and rendered? How to update it to use the new tokens with zero raw hex codes?
7. Verify `Clinician.tsx` cue dispatch and spring buttons to confirm no regressions will be introduced.

## Output
Write your findings and implementation plan to:
`d:/TP/Hackathon/Cometchat/.agents/teamwork/teamwork_preview_explorer_d5_survey_1/handoff.md`
Then send a completion message back to parent.


## 2026-10-04T07:39:07Z
You are Survey Explorer 1 for Phase 4 of KinesioLive.
Your identity: Survey Explorer 1 (teamwork_preview_explorer).
Your working directory is:
d:/TP/Hackathon/Cometchat/.agents/teamwork/teamwork_preview_explorer_d5_survey_1/

You MUST read the authoritative user requirements and specifications first:
d:/TP/Hackathon/Cometchat/.agents/teamwork/ORIGINAL_REQUEST.md
(Pay special attention to lines 307–553 under section ## 2026-10-04T07:34:42Z).

Read your detailed assignment in:
d:/TP/Hackathon/Cometchat/.agents/teamwork/teamwork_preview_explorer_d5_survey_1/DISPATCH.md

Inspect:
- client/src/views/Patient.tsx (lines 446–476 empty catch blocks, line 199 toast timing, cue listener, toast rendering)
- client/src/views/Clinician.tsx (cue dispatch, spring buttons, cooldown)
- client/src/styles/tokens.css (existing color tokens and where --accent-cyan, --accent-cyan-tint, --shadow-glow-cyan fit)
- client/src/styles/motionPresets.ts (existing springPresets)

Answer all questions in DISPATCH.md and provide exact line references, code snippets, and implementation plan for D5.1 and D5.2.
Write your complete report to:
d:/TP/Hackathon/Cometchat/.agents/teamwork/teamwork_preview_explorer_d5_survey_1/handoff.md
Update your progress.md.
When finished, send a message to parent with your handoff.
