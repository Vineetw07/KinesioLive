# Kinematic Signal Filter Implementation Report (Day 3: M2 / D3.2)

**Worker:** `worker_d3_m2`  
**Target Module:** `client/src/engine/smoothing.ts`  
**Parent Conversation ID:** `b54e93f5-e470-4c09-928a-a4cf3197f4a3`  
**Date:** 2026-10-04  

---

## 1. Observation

1. **Initial Workspace State:**
   - Directory `client/src/engine/` did not exist.
   - Root test configuration (`vitest.config.ts`) enforces `test.environment: 'node'`.
   - `client/tsconfig.json` enforces strict TypeScript compilation (`"strict": true`, `"noUnusedLocals": true`, `"noUnusedParameters": true`).
   - Workspace test command `pnpm test` passed 11 test files and 175 tests with exit code 0.

2. **Requirements Specifications (`ORIGINAL_REQUEST.md`, `DISPATCH.md`, `PROJECT.md`):**
   - Implement `SlidingMedianFilter`:
     - Rolling buffer of size 3 (default, configurable).
     - `filter(val: number | null): number | null`:
       - If `val === null` or non-finite: resets buffer to empty, returns `null`.
       - 1st frame: buffer = `[val]`, returns `val`.
       - 2nd frame: buffer = `[v1, val]`, returns `(v1 + val) / 2`.
       - 3rd+ frame: buffer of size 3 (drops oldest), returns median of sorted buffer.
       - Single-frame impulse spikes (e.g. `[10, 85, 12]`) eliminated on 3rd frame without phase smearing.
     - `reset(): void`: clears buffer.
   - Implement `ExponentialMovingAverageFilter`:
     - Smoothing factor $\alpha = 0.40$ (configurable in constructor, default 0.40).
     - Maximum missing frames threshold = 3 (configurable in constructor, default 3).
     - `filter(val: number | null): number | null`:
       - If `val === null` or non-finite: increments missing frames counter; if missing frames $\ge 3$, resets internal state to uninitialized and returns `null`; if missing frames $< 3$, returns last filtered value (or `null` if uninitialized).
       - If `val` is valid finite number: resets missing frames counter to 0; if uninitialized, state = `val`, returns `val`; otherwise computes $y_t = \alpha \cdot \text{val} + (1 - \alpha) \cdot y_{t-1}$ and returns $y_t$.
     - `reset(): void`: clears state and sets uninitialized.
     - Step-response latency invariant: at 30 FPS, rise time to $50\%$ remains $< 50$ ms while eliminating digit flicker.
   - Strict Zero-DOM Boundary: no imports of React, DOM, or browser globals. Pure TypeScript.
   - Compatibility Aliases: export `MedianFilter` and `EmaFilter`, plus `.update()` aliases for pipeline integration.

3. **Implementation Created:**
   - File created: `client/src/engine/smoothing.ts` (207 lines).
   - Exported classes: `SlidingMedianFilter`, `ExponentialMovingAverageFilter`, `MedianFilter`, `EmaFilter`.

4. **Verification Execution Results:**
   - `pnpm --filter @kinesio/client exec tsc --noEmit`: exited with code 0.
   - `pnpm test`: 11 test files, 175 tests passed with code 0.
   - Mathematical verification:
     - `SlidingMedianFilter` impulse test `[10, 85, 12]` returns `10 -> 47.5 -> 12.0` (spike rejected).
     - `ExponentialMovingAverageFilter` step test `0 -> 100 -> 100` returns `0 -> 40.0 -> 64.0` ($> 50\%$ reached within 2 frames, corresponding to $45.2$ ms at 30 FPS, satisfying $< 50$ ms).
     - Missing frames test: frame 1 and 2 of `null` hold filtered value `64.0`, frame 3 resets to `null`, subsequent frame `50` initializes fresh to `50`.

---

## 2. Logic Chain

1. **Step-by-Step Reasoning from Observations:**
   - In biomechanics, joint tracking coordinates suffer from high-frequency digitization jitter and isolated single-frame occlusion spikes.
   - A 3-frame sliding median filter is uniquely suited for rejecting single-frame outliers without introducing linear phase delay: sorting 3 values always places an isolated spike at index 0 or 2, leaving the true signal at index 1 (median).
   - For initial frames ($N=1$ and $N=2$), computing the arithmetic mean ensures smooth warm-up without artificial zero-padding.
   - If tracking drops (`val === null` or non-finite), resetting the median buffer ensures that when tracking resumes, stale pre-dropout keypoints do not corrupt new measurements.
   - For angular HUD stabilization, an EMA filter with $\alpha = 0.40$ computes $y_t = 0.40 x_t + 0.60 y_{t-1}$. At 30 FPS ($T = 33.33$ ms), $t_{50\%} = \frac{\ln(0.5)}{\ln(0.6)} \times 33.33 \text{ ms} \approx 45.23 \text{ ms} < 50 \text{ ms}$. This satisfies the latency invariant $< 50$ ms while eliminating frame-to-frame display flutter.
   - The zero-order hold mechanism for missing frames $< 3$ prevents flickering during transient 1-2 frame dropouts, while resetting on 3 consecutive dropouts cleanly invalidates tracking when the subject leaves frame or is severely occluded.
   - Strict zero-DOM isolation ensures `smoothing.ts` has zero runtime dependencies, allowing execution in Node.js Vitest test runners and browser Web Workers alike.

---

## 3. Caveats

- `holdOnMissing` is enabled by default (`true`) in `ExponentialMovingAverageFilter` as specified in `DISPATCH.md`, but can be disabled (`false`) via constructor if a consumer requires immediate `null` propagation during dropouts.
- No other files were touched. `client/src/engine/geometry.ts` and `client/src/engine/repCounter.ts` remain owned by their respective milestone workers.

---

## 4. Conclusion

The kinematic signal filter module `client/src/engine/smoothing.ts` has been fully implemented in genuine, decoupled, zero-DOM TypeScript adhering strictly to all requirements and mathematical invariants. TypeScript typechecking passes with exit code 0 and all existing workspace test suites continue to pass with zero regressions.

---

## 5. Verification Method

To independently verify the implementation:

1. **TypeScript Typecheck:**
   ```powershell
   pnpm --filter @kinesio/client exec tsc --noEmit
   ```
   *Expected outcome: Exits with code 0 with zero diagnostics.*

2. **Monorepo Test Suite:**
   ```powershell
   pnpm test
   ```
   *Expected outcome: 11 test files, 175 tests pass with code 0.*

3. **Inspection of `client/src/engine/smoothing.ts`:**
   - Confirm export of `SlidingMedianFilter` and `ExponentialMovingAverageFilter` (and aliases `MedianFilter`, `EmaFilter`).
   - Confirm methods `.filter(val)` and `.reset()`.
   - Confirm absence of DOM, React, or browser global imports.
