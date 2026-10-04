## 2026-10-04T05:21:26Z
You are worker_d3_m1.
Your working directory is: d:/TP/Hackathon/Cometchat/.agents/teamwork/teamwork_preview_worker_d3_m1/
Parent conversation ID: b54e93f5-e470-4c09-928a-a4cf3197f4a3

MANDATORY: Read d:/TP/Hackathon/Cometchat/.agents/teamwork/ORIGINAL_REQUEST.md before starting work.
Also read:
- `d:/TP/Hackathon/Cometchat/.agents/teamwork/teamwork_preview_spec_miner_d3_survey_2/handoff.md` (authoritative mathematical formulas and edge cases)
- `d:/TP/Hackathon/Cometchat/.agents/teamwork/teamwork_preview_explorer_d3_survey_1/handoff.md` (types and zero-DOM boundary)
- `d:/TP/Hackathon/Cometchat/.agents/teamwork/orchestrator_1/PROJECT.md`

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Write Ownership:
You EXCLUSIVELY own `client/src/engine/geometry.ts`. DO NOT write or modify any other files.

Mission:
Implement the complete, decoupled, zero-DOM Mathematical Geometry Engine in `client/src/engine/geometry.ts`:
1. Types: `Point3D` ({ x, y, z, visibility? }), `Point2D` ({ x, y, visibility? }), `StandingBaseline`.
2. `compute3DKneeFlexion(hip: Point3D, knee: Point3D, ankle: Point3D): number | null`:
   - Vectors: v1 = hip - knee, v2 = ankle - knee.
   - Dot product formulation with clamp to [-1, 1] before arccos: theta = arccos(clamp((v1 . v2)/(||v1|| ||v2||), -1, 1)) * 180 / pi.
   - Defense & Safety: Return null (NEVER NaN, Infinity, or dummy values like 180) if:
     - Any coordinate is non-finite (isNaN or !Number.isFinite).
     - Landmark visibility is present and < 0.65.
     - Either vector magnitude is degenerate: ||v1|| <= 1e-6 or ||v2|| <= 1e-6.
3. `calibrateStandingBaseline(landmarks: Point2D[], imageWidth: number, imageHeight: number, timestamp?: number): StandingBaseline | null`:
   - Validates all 6 bilateral keypoints (Left: 23, 25, 27; Right: 24, 26, 28) exist and have visibility >= 0.65.
   - Converts to unmirrored camera pixel coordinates: X = x * imageWidth, Y = y * imageHeight.
   - Anatomical Orientation Invariant: Validates Y_ankle > Y_knee > Y_hip for both Left (27 > 25 > 23) and Right (28 > 26 > 24). If invalid, returns null.
   - Records bilateral standing leg lengths:
     L_standing^L = sqrt((X_27 - X_23)^2 + (Y_27 - Y_23)^2)
     L_standing^R = sqrt((X_28 - X_24)^2 + (Y_28 - Y_24)^2)
   - Records standing hip and knee heights (bilateral and midpoint).
4. `computeValgusDeviation(hip: Point2D, knee: Point2D, ankle: Point2D, baseline: StandingBaseline, side: "L" | "R"): number | null`:
   - Neutral frontal axis at knee vertical height Y_k:
     X_baseline = X_h + (X_a - X_h) * (Y_k - Y_h) / (Y_a - Y_h)
   - Guard: If |Y_a - Y_h| <= 1e-4, return null.
   - Polarity Enforcement in unmirrored camera space:
     - Left Leg: polarity = -1 (medial collapse towards midline decreases X).
     - Right Leg: polarity = +1 (medial collapse towards midline increases X).
   - Signed Medial Deviation Percentage:
     valgusDevPct = (polarity * (X_k - X_baseline) / L_standing^side) * 100
     Invariant: Inward medial collapse MUST yield positive values (+); outward varus bow-leg MUST yield negative values (-).
5. `computeDepthRatio(currentHipY: number, baseline: StandingBaseline): number`:
   - depthRatio = (currentHipY - Y_hip(standing)) / (Y_knee(standing) - Y_hip(standing))
   - Guard: If |Y_knee(standing) - Y_hip(standing)| <= 1e-4, return 0.0.
   - Returns 0.0 at standing, ~1.0 at parallel squat, > 1.0 below parallel.
6. Zero DOM: No imports of React, DOM, or browser globals. Pure TypeScript.

Verification:
Run: `pnpm --filter @kinesio/client exec tsc --noEmit`
Verify it passes with exit code 0.

Write your report to `d:/TP/Hackathon/Cometchat/.agents/teamwork/teamwork_preview_worker_d3_m1/handoff.md` and message your parent when done.
