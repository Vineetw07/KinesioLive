# E2E Test Infra: KinesioLive

## Test Philosophy
- Opaque-box, requirement-driven. No dependency on implementation design.
- Methodology: Category-Partition + Boundary Value Analysis (BVA) + Pairwise Combinatorial + Real-World Workload Testing.
- Derived strictly from `ORIGINAL_REQUEST.md` and user-facing requirements.

## Feature Inventory
| # | Feature | Source (requirement) | Tier 1 | Tier 2 | Tier 3 |
|---|---------|---------------------|:------:|:------:|:------:|
| 1 | Workspace Linking & Package Exports | ORIGINAL_REQUEST §R1 | 5 | 5 | ✓ |
| 2 | Shared Biomechanical Schemas & Types | ORIGINAL_REQUEST §R1 | 5 | 5 | ✓ |
| 3 | Server Health Probe (`/api/health`) | ORIGINAL_REQUEST §R2 | 5 | 5 | ✓ |
| 4 | Session Token Minting (`/api/session`) | ORIGINAL_REQUEST §R2 | 5 | 5 | ✓ |
| 5 | Deterministic User/Role Mapping (`dr-demo`, `pt-demo`) | ORIGINAL_REQUEST §R2 | 5 | 5 | ✓ |
| 6 | Boot Credential Validation & Diagnostics | ORIGINAL_REQUEST §R2.7 | 5 | 5 | ✓ |
| 7 | Client Vite Proxy & Global Define | ORIGINAL_REQUEST §R3 | 5 | 5 | ✓ |
| 8 | Secret Isolation (Zero API Keys in client/src) | ORIGINAL_REQUEST §R3 | 5 | 5 | ✓ |

## Test Architecture
- Test runner: Vitest / Node script test runner.
- Test suite location: `tests/e2e/` or root test suite.
- Pass/Fail semantics: All tests pass with exit code 0.
- When ready, publish `TEST_READY.md` at project root.

## Real-World Application Scenarios (Tier 4)
| # | Scenario | Features Exercised | Complexity |
|---|----------|--------------------|------------|
| 1 | Clinician opens session, receives token, verifies group GUID | F3, F4, F5 | Medium |
| 2 | Patient joins existing session, verifies pt-demo token and same GUID | F4, F5 | Medium |
| 3 | Client build output inspected for secret isolation | F7, F8 | Low |
| 4 | Schema type validity tested against simulated MediaPipe pose packet | F1, F2 | Medium |
| 5 | Token service idempotency when session called concurrently | F4, F5 | High |

## Coverage Thresholds
- Tier 1: >=5 per feature
- Tier 2: >=5 per feature
- Tier 3: pairwise coverage of major feature interactions
- Tier 4: >=5 realistic application scenarios
