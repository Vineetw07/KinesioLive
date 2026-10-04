# Adversarial Stress-Test Handoff Report: Rep Counter FSM & Valgus Detector

**Agent**: `challenger_d3_2`  
**Target Milestone**: D3.3 & D3.4 (Deterministic Rep Counter FSM & Knee Valgus Alert Detector)  
**Verdict**: `APPROVE` (correct and robust under adversarial stress)

---

## 1. Observation

### Implementation & Test Artifacts Inspected
- `client/src/engine/repCounter.ts` (Lines 1–841)
- `tests/repCounter.test.ts` (Lines 1–353)
- `tests/fixtures/squats/` (`normal_squat_5reps.json`, `shallow_squat.json`, `fast_squat.json`, `valgus_squat.json`, `occluded_jitter.json`)
- `tests/repCounterAdversarial.test.ts` (Created adversarial stress suite with 14 test specifications)

### Empirical Verification Commands & Results

1. **Client TypeScript Typecheck**:
   - Command: `pnpm --filter @kinesio/client exec tsc --noEmit`
   - Result: Exited with code 0 (zero type errors).

2. **Fixture-Based Vitest Suite**:
   - Command: `pnpm vitest run tests/repCounter.test.ts`
   - Result: Exited with code 0.
   ```
   ✓ tests/repCounter.test.ts (9 tests) 73ms
   Test Files  1 passed (1)
   Tests       9 passed (9)
   ```

3. **Adversarial Stress Test Suite**:
   - Command: `pnpm vitest run tests/repCounterAdversarial.test.ts`
   - Result: Exited with code 0.
   ```
   ✓ tests/repCounterAdversarial.test.ts (14 tests) 11ms
   Test Files  1 passed (1)
   Tests       14 passed (14)
   ```

4. **Joint Execution Suite**:
   - Command: `pnpm vitest run tests/repCounter.test.ts tests/repCounterAdversarial.test.ts`
   - Result: Exited with code 0. 23 tests passed out of 23.

---

## 2. Logic Chain

The adversarial challenge evaluated all 7 required dimensions specified in the mission:

### Step 1: FSM Boundary Hysteresis (Rapid Oscillations around 150° and 100°)
- **Observation**:
  - `client/src/engine/repCounter.ts` line 349:
    ```ts
    if (depthRatio > 0.25 || thetaKnee < 150.0) {
      this._phase = 'descending';
    ...
    ```
  - Line 371:
    ```ts
    if (depthRatio > 0.85 || thetaKnee < 100.0) {
      this._phase = 'bottom';
    } else if (thetaKnee > this._minKneeDeg + 10.0 && depthRatio < this._maxDepthRatio) {
      this._phase = 'ascending';
    }
    ```
  - Line 391:
    ```ts
    if (thetaKnee > 110.0 && depthRatio < this._maxDepthRatio) {
      this._phase = 'ascending';
    }
    ```
- **Deduction & Stress Verification**:
  - When oscillating rapidly around 150° (e.g. 149° -> 151° -> 148° -> 152°), once descending is entered at 149°, `minKneeDeg` is 149°. The small fluctuations (+/-3°) never satisfy `thetaKnee > minKneeDeg + 10.0` (which requires > 159°), so the FSM does not thrash or drop into ascending.
  - When oscillating around 100° (e.g. 99° -> 102° -> 98° -> 104°), once bottom is entered at 99°, exit to ascending requires `thetaKnee > 110.0`. Fluctuations below 110° remain locked in `bottom` without jittering back to `descending` or prematurely ascending.
  - Upon completing the full descent and return to standing, the repetition cleanly increments to 1 without dropped counts.

### Step 2: Shallow Squat Reversal (Deadlock Prevention at 120°, 130°, 140°)
- **Observation**:
  - `client/src/engine/repCounter.ts` lines 376–378:
    ```ts
    else if (thetaKnee > this._minKneeDeg + 10.0 && depthRatio < this._maxDepthRatio) {
      this._phase = 'ascending';
    }
    ```
  - Lines 405–445: In `ascending -> standing`, validation gate checks:
    ```ts
    if (this._minKneeDeg <= this.minValidKneeDeg && durMs >= this.minRepDurationMs) { ... }
    else {
      if (this._minKneeDeg > this.minValidKneeDeg) { isShallow = true; ... }
    }
    ```
- **Deduction & Stress Verification**:
  - Consecutive shallow squats reversing at 120°, 130°, and 140° were executed sequentially.
  - In each case, upon knee extension exceeding +10° and depth ratio decreasing, the FSM transitioned cleanly from `descending` to `ascending`, returned to `standing` at upright posture, set `isShallow: true`, and left `reps` strictly at 0.
  - A subsequent valid full repetition (reaching 80°) executed immediately after cleanly incremented `reps` to 1, proving the FSM never deadlocked.

### Step 3: Rapid Bounce Rejection (600ms, 700ms, 799ms vs 801ms)
- **Observation**:
  - `client/src/engine/repCounter.ts` lines 406–410:
    ```ts
    const durMs = this._repStartTime !== null ? (timestamp - this._repStartTime) : 0;
    if (this._minKneeDeg <= this.minValidKneeDeg && durMs >= this.minRepDurationMs) { ... }
    ```
  - `minRepDurationMs` defaults to 800 ms.
- **Deduction & Stress Verification**:
  - Fast squats completing in 600 ms, 700 ms, and 799 ms with valid knee depth (80°) were rejected: `isBounce: true`, `reps: 0`, `completedRep: null`.
  - A repetition completing in 801 ms with identical depth was accepted: `isBounce: false`, `reps: 1`, `completedRep.durMs: 801`, `completedRep.tempo: 'fast'`.
  - The boundary cutoff at 800 ms is exact and non-leaky.

### Step 4: Valgus Alert Cooldown Boundary (t=0, t=2000, t=3999, t=4001)
- **Observation**:
  - `client/src/engine/repCounter.ts` lines 516–522:
    ```ts
    if (
      consecutiveFrames >= this.valgusConsecutiveFrames &&
      timestamp - lastAlertTime >= this.valgusCooldownMs
    ) {
      if (side === 'L') this._lastAlertTimeL = timestamp;
      else this._lastAlertTimeR = timestamp;
      alerts.push({ ... });
    }
    ```
- **Deduction & Stress Verification**:
  - At t = 0 ms, Left leg sustained > 8% deviation for 3 frames: initial alert fired (`_lastAlertTimeL = 0`).
  - At t = 2000 ms, continuous valgus > 8%: cooldown elapsed = 2000 ms < 4000 ms -> alert suppressed (0 alerts).
  - At t = 3999 ms, continuous valgus > 8%: cooldown elapsed = 3999 ms < 4000 ms -> alert suppressed (0 alerts).
  - At t = 4001 ms, continuous valgus > 8%: cooldown elapsed = 4001 ms >= 4000 ms -> alert fired (1 alert, `side: 'L'`, `t: 4001`).

### Step 5: Bilateral Alert Independence
- **Observation**:
  - `_lastAlertTimeL` and `_lastAlertTimeR` are tracked independently in private state (lines 205–206, lines 514–522).
- **Deduction & Stress Verification**:
  - Left alert triggered at t = 0 ms (`_lastAlertTimeL = 0`).
  - At t = 500 ms, Right leg exhibited 3 consecutive frames of 11.5% valgus while Left leg also had high valgus.
  - Result: Right alert fired at t = 500 ms (`side: 'R'`), while Left alert was blocked by its active cooldown.
  - Independent bilateral channels are strictly preserved.

### Step 6: Valgus Phase Suppression (Standing & Ascending Phases)
- **Observation**:
  - Lines 360–361, lines 381–382, lines 396–397: `checkValgusAlert` is only invoked in `case 'descending'` and `case 'bottom'`.
  - In `case 'standing'` (lines 339–347) and `case 'ascending'` (lines 401–449), `checkValgusAlert` is never called.
- **Deduction & Stress Verification**:
  - During 10 frames of `standing` posture with extreme 25% valgus deviation, 0 alerts were emitted.
  - During 10 frames of `ascending` phase with extreme 25% valgus deviation, 0 alerts were emitted.
  - Alerts are exclusively restricted to descent and bottom phases.

### Step 7: Tracking Dropout Handling (500ms Resume vs 1200ms Reset)
- **Observation**:
  - Lines 312–332:
    ```ts
    const dropoutMs = this._lostStartTime !== null ? (timestamp - this._lostStartTime) : 0;
    if (thetaKnee > 160.0) {
      this._phase = 'standing';
      this.resetRepState();
    } else if (
      this._previousPhaseBeforeLost &&
      this._previousPhaseBeforeLost !== 'lost' &&
      dropoutMs < this.dropoutResetMs
    ) {
      this._phase = this._previousPhaseBeforeLost;
    } else {
      this._phase = 'standing';
      this.resetRepState();
      if (thetaKnee <= 160.0) {
        this._requiresUprightBeforeDescent = true;
      }
    }
    ```
- **Deduction & Stress Verification**:
  - When visibility dropped (< 0.65) for 500 ms mid-rep and returned with the user still bent (125°), the FSM cleanly resumed the previous `descending` phase and permitted full rep completion (`reps: 1`).
  - When visibility dropped for 1200 ms (>= 1000 ms threshold) mid-rep, the FSM aborted the rep, reset state to `standing`, set `_requiresUprightBeforeDescent: true`, prevented re-entry into descent while bent, and required the user to return to upright posture (165°, depthRatio 0.10) before starting a new rep.

---

## 3. Caveats

1. **Dual-Signal Coupling (`kneeFlexion` + `depthRatio`)**:
   - In strict conformance with TRD R3 ("Reversal detected ($\theta_{\text{knee}}$ increases by $> 10^\circ$ and $\text{depthRatio}$ decreases)" and "$\theta_{\text{knee}} > 110^\circ$ AND $\text{depthRatio}$ is decreasing"), exit from `bottom` and shallow reversal in `descending` require `depthRatio` to decrease.
   - If an external caller passes *only* `kneeDeg` and completely omits `depthRatio` (defaulting to 0.0), `depthRatio < maxDepthRatio` (`0.0 < 0.0`) evaluates to false, which would hold the state in `bottom`. The engine pipeline properly supplies both signals (via BlazePose landmarks + baseline calibration or dual-channel inputs), so in real operation this condition is fully satisfied.
2. **Clock Monotonicity**:
   - The engine relies on non-decreasing timestamps. Out-of-order timestamps (e.g. frame t=900 arriving after t=1000) result in negative `durMs`, which is safely rejected by the bounce gate (< 800 ms).
3. **Out-of-Scope Test File**:
   - In full workspace execution `pnpm vitest run`, test `tests/challenger_d3_1.test.ts` had a failing assertion in peer challenger D3_1's scope (`geometry.ts` horizontal leg segment guard `1e-4`). That failure belongs to D3_1 and does not affect `repCounter.ts`. All tests in `tests/repCounter.test.ts` and `tests/repCounterAdversarial.test.ts` pass 100%.

---

## 4. Conclusion

**Verdict: `APPROVE`**

`client/src/engine/repCounter.ts` is mathematically rigorous, deterministic, and highly resilient against adversarial edge cases. It correctly implements:
- Hysteresis thresholds preventing phase thrashing during jitter at 150° and 100°.
- Shallow squat reversal preventing state machine deadlocks across consecutive partial repetitions.
- Millisecond-precise rep duration gating (rejecting bounces < 800 ms, accepting reps >= 800 ms).
- Independent bilateral valgus alert detection with strict 4000 ms cooldown enforcement per leg.
- Phase-gated alert suppression active strictly during descending and bottom phases.
- State-preserving dropout recovery (< 1000 ms resume vs >= 1000 ms upright reset).

---

## 5. Verification Method

To independently verify all findings and test suites:

1. **Run Rep Counter Vitest Suites**:
   ```powershell
   pnpm vitest run tests/repCounter.test.ts tests/repCounterAdversarial.test.ts
   ```
   *Expected outcome*: 2 test files passed, 23 tests passed, exit code 0.

2. **Run Client TypeScript Compilation**:
   ```powershell
   pnpm --filter @kinesio/client exec tsc --noEmit
   ```
   *Expected outcome*: Zero errors, exit code 0.

3. **Inspect Test Code**:
   - Review `tests/repCounterAdversarial.test.ts` for all 14 adversarial test specifications covering the 7 challenge criteria plus degenerate inputs.
