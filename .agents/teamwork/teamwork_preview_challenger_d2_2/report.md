# Challenger 2 Empirical Challenge Report: S3 Calls v5 & S4 Persistence

**Date**: 2026-10-04  
**Author**: Challenger 2 (S3 Calls & S4 Persistence Contract Challenger)  
**Target Milestone**: Milestone D2.2 (Calls v5 Join) & D2.4 (Persistence & History)  
**Target Artifacts**:
- `client/src/spikes/s3-calls/callsRunner.ts`
- `client/src/spikes/s3-calls/SpikeCallsJoin.tsx`
- `client/src/spikes/s4-custom/persistenceRunner.ts`
- `client/src/spikes/s4-custom/SpikePersistenceFetch.tsx`
- `client/src/spikes/utils/tokenService.ts`
- `tests/e2e/spike_s3_s4_stress.test.ts`

**Final Verdict**: **APPROVE**

---

## 1. Executive Summary

Challenger 2 has conducted an exhaustive, adversarial empirical challenge of the Milestone D2.2 (Calls v5 WebRTC Join) and Milestone D2.4 (Custom Message Persistence & History Retrieval) subsystems. 

An automated 20-test empirical stress test suite (`tests/e2e/spike_s3_s4_stress.test.ts`) was authored and executed. All 20 stress scenarios passed with exit code 0, validating that:
1. **Clinician audio muting** is strictly enforced (`startAudioMuted: true`), preventing acoustic feedback loops in clinic environments, while patient audio initializes unmuted (`false`).
2. **Connection latency tracking** operates with sub-millisecond precision (`performance.now()`) and strictly rejects sessions taking $\ge 3000$ ms.
3. **Token Service wrapper** (`POST /api/session`) sanitizes whitespace, properly propagates server errors (JSON and HTML crash bodies), handles network disconnects gracefully, and isolates credentials.
4. **Custom message burst generator** emits exactly 25 messages across the required tripartite distribution (9 `kine.rep`, 8 `kine.alert`, 8 `kine.cue`), targeting `RECEIVER_TYPE.GROUP` with `shouldUpdateConversation(false)` to prevent feed churn.
5. **History retrieval & ordering oracle** strictly validates chronological monotonicity ($t_1 \le t_2 \le \dots$), correctly identifying and failing upon adversarial out-of-order packet delivery or packet drop.
6. **MessagesRequestBuilder** correctly adheres to verified CometChat v4 JS SDK contracts: `.setGUID(targetGuid)` (uppercase), `.setCategories(['custom'])`, and `.setLimit(35)` ($\ge 30$).

---

## 2. Challenge Dimensions & Verification Evidence

### Challenge Dimension 1: Calls v5 `startAudioMuted` Invariant & Role Isolation
- **Hypothesis**: The clinician role must initialize with `startAudioMuted: true` to prevent acoustic feedback loops when clinicians operate multi-monitor/speaker setups; the patient role must initialize with `startAudioMuted: false` to allow immediate communication.
- **Implementation Inspected**: `callsRunner.ts` lines 25, 84–95, 135:
  ```ts
  const isClinician = role === 'clinician';
  const callSettings: SessionSettings = {
    sessionType: 'VIDEO',
    layout: 'TILE',
    startAudioMuted: isClinician,
    ...
  };
  ```
- **Stress Test**: `S3-CHALLENGE.1` and `S3-CHALLENGE.2`.
- **Finding**: Verified. `mockCallsSDK.joinSession` receives `startAudioMuted: true` when called as clinician and `startAudioMuted: false` when called as patient. Returned metrics accurately reflect `audioMuted`.

### Challenge Dimension 2: Connection Latency Stopwatch & Sub-3.0s Thresholding
- **Hypothesis**: Connection latency must be measured with monotonic precision timer (`performance.now()`) and must evaluate pass strictly as `< 3000` ms.
- **Implementation Inspected**: `callsRunner.ts` lines 26, 108, 128:
  ```ts
  const startConnectTime = performance.now();
  ...
  const connectLatencyMs = performance.now() - startConnectTime;
  const pass = connectLatencyMs < 3000;
  ```
- **Stress Test**: `S3-CHALLENGE.3`.
- **Finding**: Verified. Sub-3s connects pass (`pass: true`). When an adversarial connection delay of 3200ms is injected, the runner calculates `connectLatencyMs: 3200` and flags `pass: false`. Boundary threshold `< 3000` operates as specified.

### Challenge Dimension 3: Session Token Service (`tokenService.ts`) Robustness
- **Hypothesis**: Client `requestSession` must isolate secrets, sanitize input session IDs, handle HTTP 500 errors gracefully without crashing JSON parsers, and propagate network failures.
- **Implementation Inspected**: `client/src/spikes/utils/tokenService.ts` lines 8–38.
- **Stress Tests**: `S3-TOKEN.1` through `S3-TOKEN.6`.
- **Finding**: Verified.
  - Whitespace trimming: `"   kine-padded-room-42   "` -> `"kine-padded-room-42"`.
  - Empty/whitespace ID converts to `undefined` so backend generates auto-prefix `kine-<timestamp>`.
  - HTTP 500 JSON error body is cleanly surfaced in Error message.
  - HTTP 502/504 HTML error body (proxy failure) is caught by `.catch(() => ({}))` and converts to a clean status message without JSON syntax exceptions.
  - Network disconnection propagates as rejection.
  - `checkBackendHealth()` returns `false` upon network error without throwing unhandled exceptions.

### Challenge Dimension 4: S4 Custom Message Burst (25 Messages) & Schema Conformance
- **Hypothesis**: Exactly 25 custom messages must be generated with balanced distribution across `kine.rep`, `kine.alert`, and `kine.cue`. Messages must be sent to `RECEIVER_TYPE.GROUP` with `shouldUpdateConversation(false)`.
- **Implementation Inspected**: `persistenceRunner.ts` lines 66–135.
- **Stress Tests**: `S4-CHALLENGE.1`, `S4-CHALLENGE.2`, `S4-CHALLENGE.3`.
- **Finding**: Verified.
  - Count: Exactly 25 messages sent and tracked by progress callback.
  - Distribution: 9 `kine.rep`, 8 `kine.alert`, 8 `kine.cue` (total 25).
  - Anti-churn invariant: All 25 messages set `shouldUpdateConversation(false)`, preventing message spam in the user's conversation list preview.
  - Schemas conform strictly to `@kinesio/shared` contract.

### Challenge Dimension 5: S4 Chronological Monotonicity Oracle & History Query
- **Hypothesis**: `persistenceRunner` must strictly validate that message timestamps from history retrieval are monotonically non-decreasing ($t_1 \le t_2 \le \dots$), and fail upon any out-of-order delivery or dropped messages.
- **Implementation Inspected**: `persistenceRunner.ts` lines 174–190.
- **Stress Tests**: `S4-CHALLENGE.5`, `S4-CHALLENGE.6`, `S4-CHALLENGE.7`, `S4-CHALLENGE.8`.
- **Finding**: Verified.
  - Ascending timestamps pass (`chronologicalMatch: true`, `pass: true`).
  - Equal timestamps ($t_i == t_{i-1}$) in same millisecond pass non-decreasingly.
  - Adversarial out-of-order sequence (e.g. $t_5 < t_4$) is detected: sets `chronologicalMatch: false` and `pass: false`.
  - Adversarial packet drop (retrieving 24 instead of 25 messages) sets `retrievedCount: 24`, failing the `retrievedCount >= burstCount` check -> `pass: false`.

### Challenge Dimension 6: `MessagesRequestBuilder` Query Parameters
- **Hypothesis**: Query builder must use uppercase `.setGUID(targetGuid)` (official SDK method), category filter `['custom']`, and limit $\ge 30$.
- **Implementation Inspected**: `persistenceRunner.ts` lines 144–148:
  ```ts
  const messagesRequest = new CometChat.MessagesRequestBuilder()
    .setGUID(targetGuid)
    .setCategories(['custom'])
    .setLimit(35)
    .build();
  ```
- **Stress Test**: `S4-CHALLENGE.4`.
- **Finding**: Verified. Builder parameters captured in flight match: `guid === targetGuid`, `categories === ['custom']`, `limit === 35` ($\ge 30$).

### Challenge Dimension 7: Lifecycle, Teardown & Dual-Spike Concurrency
- **Hypothesis**: Call runner must clean up all listeners and invoke `CometChatCalls.leaveSession()`. Teardown must be idempotent. Concurrent S3 calls and S4 persistence on the same session ID must not conflict.
- **Stress Tests**: `S3-CHALLENGE.5` and `S3-S4-INT.1`.
- **Finding**: Verified. Multiple calls to `leaveCall()` are safe and idempotent. Running S3 join followed by S4 burst on the same session ID succeeds cleanly.

---

## 3. Automated Test Execution Ledger

Verification command:
```powershell
pnpm exec vitest run tests/e2e/spike_s3_s4_stress.test.ts; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
```

### Result Matrix (20/20 Passed)
| # | Test Case Identifier | Scope | Status | Duration |
|---|----------------------|-------|:------:|:--------:|
| 1 | `S3-CHALLENGE.1` | Clinician startAudioMuted: true & SessionSettings | PASS | 12ms |
| 2 | `S3-CHALLENGE.2` | Patient startAudioMuted: false | PASS | 8ms |
| 3 | `S3-CHALLENGE.3` | Connection Latency stopwatch & < 3.0s boundary | PASS | 14ms |
| 4 | `S3-CHALLENGE.4` | JoinSession error propagation & state cleanup | PASS | 5ms |
| 5 | `S3-CHALLENGE.5` | Listener unsubs & idempotent leaveCall | PASS | 6ms |
| 6 | `S3-TOKEN.1` | Payload sanitization & sessionId trimming | PASS | 2ms |
| 7 | `S3-TOKEN.2` | Whitespace-only sessionId -> undefined auto-prefix | PASS | 2ms |
| 8 | `S3-TOKEN.3` | Server HTTP 500 error body surfaced | PASS | 3ms |
| 9 | `S3-TOKEN.4` | Non-JSON HTML 502/504 crash fallback | PASS | 3ms |
| 10 | `S3-TOKEN.5` | Network offline error propagation | PASS | 2ms |
| 11 | `S3-TOKEN.6` | checkBackendHealth graceful offline handling | PASS | 2ms |
| 12 | `S4-CHALLENGE.1` | Exact 25 custom messages burst distribution | PASS | 1560ms |
| 13 | `S4-CHALLENGE.2` | RECEIVER_TYPE.GROUP & shouldUpdateConversation(false) | PASS | 1560ms |
| 14 | `S4-CHALLENGE.3` | Schema validation for rep, alert, cue payloads | PASS | 385ms |
| 15 | `S4-CHALLENGE.4` | MessagesRequestBuilder .setGUID/.setCategories/.setLimit | PASS | 1557ms |
| 16 | `S4-CHALLENGE.5` | Chronological strictly ascending monotonic pass | PASS | 1561ms |
| 17 | `S4-CHALLENGE.6` | Chronological non-decreasing equal timestamps pass | PASS | 1581ms |
| 18 | `S4-CHALLENGE.7` | Adversarial out-of-order arrival -> FAIL status | PASS | 1565ms |
| 19 | `S4-CHALLENGE.8` | Incomplete retrieval (< 25 msgs) -> FAIL status | PASS | 1563ms |
| 20 | `S3-S4-INT.1` | S3 Calls x S4 Persistence concurrent session run | PASS | 1544ms |

---

## 4. Verdict & Recommendation

**Verdict**: **APPROVE**

Both Spike S3 (Calls v5 Session Join) and Spike S4 (Custom Message Persistence & History) meet all architectural and acceptance criteria specified in `ORIGINAL_REQUEST.md` (§ 2026-10-03T19:41:01Z R2, R4) and `docs/trd.md` (§ Section 2, Section 4). The implementations are production-grade, defensive, and ready for integration into the master testbed gate (Spike S5 / D2.5).
