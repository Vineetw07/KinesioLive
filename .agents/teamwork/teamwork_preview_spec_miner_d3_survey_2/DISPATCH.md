## 2026-10-04T05:13:35Z

You are spec_miner_d3_survey_2.
Working directory: d:/TP/Hackathon/Cometchat/.agents/teamwork/teamwork_preview_spec_miner_d3_survey_2/
Parent conversation ID: b54e93f5-e470-4c09-928a-a4cf3197f4a3

MANDATORY: Read d:/TP/Hackathon/Cometchat/.agents/teamwork/ORIGINAL_REQUEST.md before starting work.
Also inspect:
- `docs/trd.md` (specifically Section 2 and Section 3)
- `docs/testing.md`
- `shared/src/index.ts`

Your mission:
Extract and specify all exact mathematical equations, guards, edge cases, thresholds, and invariants required for:
1. `compute3DKneeFlexion`: inputs, vector formulations, dot product clamp, deg conversion, degenerate guards (magnitude <= 1e-6), non-finite checks, visibility < 0.65 threshold, return null invariants.
2. `calibrateStandingBaseline`: 6 bilateral keypoints validation (23, 24, 25, 26, 27, 28), visibility >= 0.65, unmirrored camera pixel coordinates conversion, anatomical ordering check (Y_ankle > Y_knee > Y_hip), standing leg length L_standing^L and L_standing^R formulas, standing hip and knee heights.
3. `computeValgusDeviation`: neutral frontal axis X_baseline formula, |Y_a - Y_h| <= 1e-4 guard, unmirrored polarity (+1 for Right leg, -1 for Left leg), valgusDevPct formula and sign invariant (+ for medial collapse, - for varus).
4. `computeDepthRatio`: formula, vertical span guard (<= 1e-4), values at standing (0.0), parallel (~1.0), below parallel (> 1.0).
5. Signal smoothing: 3-frame sliding median filter behavior (1st frame raw, 2nd average, 3rd+ median, null reset) and EMA filter (alpha = 0.40, latency invariant < 50ms at 30 FPS, 3 missing frame decay/reset).
6. Rep Counter FSM: all states (`standing`, `descending`, `bottom`, `ascending`, `lost`), transitions, shallow squat reversal path, rapid bounce guard (< 800ms), valgus alert detector (descending/bottom only, > +8% for >= 3 frames, 4000ms independent cooldown per leg).

Write your comprehensive specification report to `d:/TP/Hackathon/Cometchat/.agents/teamwork/teamwork_preview_spec_miner_d3_survey_2/handoff.md`.
Communicate back via send_message to your parent.
