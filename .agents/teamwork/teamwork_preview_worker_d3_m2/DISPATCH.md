## 2026-10-04T05:21:26Z
You are worker_d3_m2.
Your working directory is: d:/TP/Hackathon/Cometchat/.agents/teamwork/teamwork_preview_worker_d3_m2/
Parent conversation ID: b54e93f5-e470-4c09-928a-a4cf3197f4a3

MANDATORY: Read d:/TP/Hackathon/Cometchat/.agents/teamwork/ORIGINAL_REQUEST.md before starting work.
Also read:
- `d:/TP/Hackathon/Cometchat/.agents/teamwork/teamwork_preview_spec_miner_d3_survey_2/handoff.md` (authoritative mathematical formulas and edge cases)
- `d:/TP/Hackathon/Cometchat/.agents/teamwork/teamwork_preview_explorer_d3_survey_1/handoff.md` (types and zero-DOM boundary)
- `d:/TP/Hackathon/Cometchat/.agents/teamwork/orchestrator_1/PROJECT.md`

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Write Ownership:
You EXCLUSIVELY own `client/src/engine/smoothing.ts`. DO NOT write or modify any other files.

Mission:
Implement the complete, decoupled, zero-DOM Kinematic Signal Filter in `client/src/engine/smoothing.ts`:
1. `SlidingMedianFilter`:
   - Rolling buffer of size 3 for scalar values.
   - Method `filter(val: number | null): number | null`:
     - If `val === null` or non-finite: resets buffer to empty, returns `null`.
     - 1st frame: buffer = [val], returns `val`.
     - 2nd frame: buffer = [v1, val], returns `(v1 + val) / 2`.
     - 3rd+ frame: rolling buffer of size 3 (drops oldest), returns median of the 3 sorted values.
     - Single-frame impulse spikes are eliminated without phase smearing.
   - Method `reset(): void`: clears buffer.
2. `ExponentialMovingAverageFilter`:
   - Smoothing factor $\alpha = 0.40$ (configurable in constructor, default 0.40).
   - Maximum missing frames threshold = 3 (configurable in constructor, default 3).
   - Method `filter(val: number | null): number | null`:
     - If `val === null` or non-finite:
       - Increments missing frames counter.
       - If missing frames >= maxMissingFrames (3), resets internal state to uninitialized, returns `null`.
       - If missing frames < maxMissingFrames, returns last filtered value (or null if uninitialized).
     - If `val` is valid number:
       - Resets missing frames counter to 0.
       - If uninitialized (first valid frame): state = val, returns val.
       - Otherwise: $y_t = \alpha \cdot \text{val} + (1 - \alpha) \cdot y_{t-1}$, returns $y_t$.
   - Method `reset(): void`: clears state and sets uninitialized.
   - Latency invariant: At 30 FPS, step-response latency remains < 50 ms.
3. Zero DOM: No imports of React, DOM, or browser globals. Pure TypeScript.

Verification:
Run: `pnpm --filter @kinesio/client exec tsc --noEmit`
Verify it passes with exit code 0.

Write your report to `d:/TP/Hackathon/Cometchat/.agents/teamwork/teamwork_preview_worker_d3_m2/handoff.md` and message your parent when done.
