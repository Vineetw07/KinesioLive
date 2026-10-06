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

## 2. Automated Vitest Matrix (`tests/*.test.ts` — 562 Tests Green)

| Suite File | Scope / Behavior Tested | Key Assertions & Fixtures |
|---|---|---|
| `geometry.test.ts` | 2D/3D angle calculations, zero-length vectors, normalization, valgus deviation. | Orthogonal vectors yield $90.0^\circ \pm 0.1^\circ$; collinear opposite yield $180.0^\circ$; unmirrored polarity ($L = -1, R = +1$); neutral stance deviation $0.0\% \pm 0.5\%$. |
| `repCounter.test.ts` & `repCounterAdversarial.test.ts` | Hysteresis state machine on recorded squat fixtures. | `normal_squat_5reps.json` yields exactly 5 reps; `shallow_squat.json` yields 0 reps (flagged shallow); `occluded_jitter.json` yields `phase: lost`; handles sensor frame drops. |
| `oneEuroFilter.test.ts` | Adaptive 1-Euro jitter filter signal processing. | Tests high-jitter steady state filtering, low-latency step response during rapid movement, cutoff adaptation, and NaN rejection. |
| `repFormScore.test.ts` | Composite 0–100 squat form scoring engine. | Asserts depth scoring (0–40 pts), valgus deviation deduction (up to 35 pts), tempo grading (0–25 pts), and ratings ("excellent" / "good" / "needs_work"). |
| `canvasOverlayAligner.test.ts` | Subpixel canvas overlay mapping & letterbox compensation. | 54 tests asserting viewport rect bounds, letterbox/pillarbox/crop offsets, mirrored reflection ($x \to 1 - x$), anatomical landmark connectivity (sternum, clavicle, extremities), and candidate scoring. |
| `telemetryTransport.test.ts` | Dual-channel telemetry sync & group auto-provisioning. | 10 Hz rate capping via token bucket, local BroadcastChannel sync, and CometChat group creation fallback on `ERR_GUID_NOT_FOUND`. |
| `sessionGuard.test.ts` & `sessionGuardAdversarial.test.ts` | Multi-tab role conflict prevention. | Detects mismatch between active CometChat user and URL role; prevents destructive `CometChat.logout()` invocation that would crash peer tab. |
| `summary.test.ts` & `summary_adversarial.test.ts` | Group history message parser & analytics card generator. | Reconstructs chronological rep sequences, average knee depth, valgus alert frequency, and session duration from CometChat `fetchPrevious()` responses. |
| `envValidator.test.ts` | Environment variable validation & diagnostic logging. | Validates CometChat credentials, detects truncated keys (`...`), and formats actionable configuration diagnostics. |
| `uiOverhaul.test.ts` | Floating Island Bento Canvas & Design System tokens. | Asserts zero hex hardcoding, design token compliance, spring motion presets, and role switching integrity. |
| `tests/e2e/*.test.ts` | Full-stack integration, session token minting, security & health. | 30+ tests asserting single-origin Express proxy, server-minted auth tokens, zero credential leaks in `dist/`, and `/api/health` probes. |
| `tests/challenger_*.test.ts` | Empirical stress suites & adversarial edge cases. | Tests 25-message burst generation, chronological monotonicity, outbox queue resilience, and high-concurrency token bursts. |

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
