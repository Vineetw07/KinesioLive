# Testing Matrix & Verification Specs — KinesioLive

> **Protocol:** Zero-Tautological Testing & Verification Triad  
> **Master Roadmap:** [implementation_plan.md](./implementation_plan.md)  
> **Incident Ledger:** [bugs.md](./bugs.md)

---

## 1. Test Architecture & Coverage Invariants

```
+-----------------------------------------------------------------------------------+
|                                 TESTING PYRAMID                                   |
+-----------------------------------------------------------------------------------+
|                                       / \                                         |
|                                      /   \    E2E & Deployed-URL Smoke            |
|                                     /  5% \   - HTTPS Camera Permissions          |
|                                    /-------\  - Dual-Profile WebRTC Join          |
|                                   /         \                                     |
|                                  /    25%    \  Manual Two-Profile Checklist      |
|                                 /             \ - Full Coaching Session Flow      |
|                                /---------------\- Alert & Cue Feedback Loop       |
|                               /                 \                                 |
|                              /        70%        \  Automated Vitest Suite        |
|                             /                     \ - Vector & Angular Geometry   |
|                            /                       \- Rep Counter State Machine   |
|                           /-------------------------\- Valgus Deviation Heuristic |
+-----------------------------------------------------------------------------------+
```

### Invariants
1. **Zero Tautological Tests:** No tests that assert trivial true-is-true conditions or mock the primary code under test.
2. **Deterministic Shell Execution:** Every test suite must execute in the shell (`pnpm test`) returning explicit exit code 0.

---

## 2. Automated Vitest Matrix (`tests/*.test.ts`)

| Suite File | Scope / Behavior Tested | Key Assertions & Fixtures |
|---|---|---|
| `geometry.test.ts` | 2D/3D angle calculations, zero-length vectors, normalization. | Orthogonal vectors yield $90.0^\circ \pm 0.1^\circ$; collinear opposite yield $180.0^\circ$; degenerate $(0,0,0)$ returns null without NaN. |
| `valgus.test.ts` | Frontal plane knee deviation calculation. | Neutral stance yields $0.0\% \pm 0.5\%$; inward knee yields $+12.4\%$; outward bow-leg yields negative $\%$. Cooldown holds for 4.0s. |
| `repCounter.test.ts` | Hysteresis state machine on recorded squat fixtures. | `normal_squat_5reps.json` yields exactly 5 reps; `shallow_squat.json` yields 0 reps (flagged shallow); `occluded_jitter.json` yields `phase: lost`. |
| `rateCap.test.ts` | Token bucket 10 Hz rate limiter. | Emitting 100 frames in 1.0s results in exactly 10 downstream message emissions; latest frame always preserved. |
| `buildSummary.test.ts` | History parser reconstructing workout statistics. | Asserts `fetchPrevious()` retrieves historical messages in chronological order; reconstructs total reps, min depth, valgus frequency from raw CometChat group message array. |

---

## 3. Manual Two-Profile Verification Checklist (Pre-Demo Gate)
- [ ] Profile 1 (Patient) & Profile 2 (Clinician) opened in separate Chrome profiles.
- [ ] Patient joins -> Clinician presence flips to "Patient in Session" in $< 2.0$ seconds.
- [ ] Two-way WebRTC audio and video verified ($< 3.0$ seconds connection time). Clinician starts with `startAudioMuted: true` to prevent local acoustic howling loop.

- [ ] Patient performs 3 good squats -> Clinician HUD updates rep count in sync.
- [ ] Patient caves left knee -> Clinician HUD alerts "Left Knee Valgus (+X%)" in $< 1.0$ second.
- [ ] Clinician clicks "Knees Out" -> Patient screen displays toast cue in $< 200$ ms.
- [ ] Clinician clicks "End Session" -> Summary analytics card reflects exactly 3 reps + 1 alert.

---

## 4. Deployed-URL Smoke Test Specification
- Target: Render production URL.
- Test 1: `GET /api/health` returns HTTP 200 with `{ status: "healthy", cometchat: "connected" }`.
- Test 2: HTTPS camera permissions prompted and accepted.
- Test 3: Secret scan ensures zero `COMETCHAT_REST_API_KEY` in compiled bundle.

---

## 🔄 Dynamic Update Trigger Matrix
- As unit test fixtures are added or thresholds calibrated, update Section 2.
- Before every major milestone sign-off, execute Section 3 checklist and record results here.
