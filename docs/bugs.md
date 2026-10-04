# Bug Triage & RCA Ledger — KinesioLive

> **Protocol:** Scientific Root-Cause Debugging (RCA before patch)  
> **Master Roadmap:** [implementation_plan.md](./implementation_plan.md)  
> **Testing Matrix:** [testing.md](./testing.md)

---

## 📋 Active & Resolved Incident Log

| Bug ID | Severity | Component | Issue Description | Root Cause Analysis (RCA) | Resolution / Verification | Status |
|---|---|---|---|---|---|---|
| **BUG-001** | High | MediaPipe / Geometry | 2D frontal knee angle $(hip-knee-ankle)$ produces numerical instability and rapid flips at deep squat depth. | In a frontal view, as the hip descends toward knee level $(y_{\text{hip}} \to y_{\text{knee}})$, the vertical femoral segment $|y_{\text{knee}} - y_{\text{hip}}|$ approaches zero. Small horizontal shifts turn the vector purely horizontal, causing erratic angular jumps ($180^\circ \to 90^\circ$ or $0^\circ$) or near-zero division. | Separated sagittal depth calculation from frontal valgus calculation. Valgus measured strictly as medial horizontal deviation $(\Delta x)$ relative to the hip-ankle vector in 2D normalized by standing baseline leg length. Depth calculated via 3D `worldLandmarks` + calibrated hip drop ratio. Verified in `geometry.test.ts` and `repCounter.test.ts`. | **RESOLVED** (21 tests green) |
| **BUG-002** | High | CometChat Calls / Auth | Call join fails with `ERROR_AUTH_TOKEN_MISSING` if `generateToken()` runs before user session is active. | `CometChatCalls.loginWithAuthToken()` is asynchronous and must be fully awaited before `generateToken()` can access the active user session. | Enforced strict async pipeline in `callsRunner.ts`: `init` -> `loginWithAuthToken` -> await `isUserLoggedIn` -> `generateToken` -> `joinSession`. Verified in `tests/e2e/spike_s3_s4_stress.test.ts`. | **RESOLVED** (20 tests green) |


---

## 🔬 RCA Protocol (Mandatory on Every Runtime Defect)

Whenever a runtime defect or unexpected failure occurs:
1. **Document Reproduction:** Log the exact input, steps, and error stack trace in a new table row.
2. **Trace Upstream:** Locate where the invalid state originated (do not apply a symptom-patch or optional chaining `?.` at the crash site).
3. **Lock with Failing Test:** Write a deterministic unit/integration test reproducing the failure before modifying production code.
4. **Apply Surgical Fix:** Patch origin of invalid state and confirm test runs green with exit code 0.
5. **Update Status:** Change status from `ACTIVE` to `RESOLVED` and synchronize with [implementation_plan.md](./implementation_plan.md).
