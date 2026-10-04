/**
 * Kinematic Signal Smoothing Filters (Day 3: D3.2)
 *
 * Provides decoupled, zero-DOM signal filters for biomechanical joint kinematics:
 * 1. SlidingMedianFilter: 3-frame rolling median filter eliminating single-frame impulse
 *    noise (outlier coordinate jumps) without introducing phase smearing or phase delay.
 * 2. ExponentialMovingAverageFilter: Single-pole IIR smoothing filter (alpha = 0.40)
 *    eliminating HUD display digit flicker while maintaining step-response latency < 50 ms.
 *
 * Strict Zero-DOM Boundary:
 * - Pure TypeScript mathematics.
 * - No dependencies on DOM, React, browser globals, or MediaPipe vision tasks.
 * - Fully deterministic and testable in headless Node.js environments.
 */
/**
 * 3-Frame Sliding Median Filter.
 *
 * Maintains a rolling window of recent scalar samples.
 * Rejects isolated single-frame impulse spikes without smoothing edges or smearing phase.
 * Resets immediately on tracking dropout (null or non-finite inputs).
 */
export class SlidingMedianFilter {
    windowSize;
    buffer = [];
    /**
     * @param windowSize Rolling buffer size (default 3 frames).
     */
    constructor(windowSize = 3) {
        this.windowSize = Number.isFinite(windowSize) && windowSize > 0 ? Math.floor(windowSize) : 3;
    }
    /**
     * Filters the incoming scalar sample.
     *
     * Rules:
     * - If val is null, undefined, or non-finite: clears buffer and returns null.
     * - 1st frame: buffer = [val], returns val.
     * - 2nd frame: buffer = [v1, val], returns (v1 + val) / 2.
     * - 3rd+ frame: buffer size capped at windowSize (drops oldest), returns median of sorted buffer.
     *
     * @param val Raw incoming scalar value or null (tracking loss).
     * @returns Filtered scalar value, or null if tracking is lost.
     */
    filter(val) {
        if (val === null || val === undefined || !Number.isFinite(val)) {
            this.reset();
            return null;
        }
        this.buffer.push(val);
        if (this.buffer.length > this.windowSize) {
            this.buffer.shift();
        }
        if (this.buffer.length === 1) {
            return this.buffer[0];
        }
        if (this.buffer.length === 2) {
            return (this.buffer[0] + this.buffer[1]) / 2.0;
        }
        // 3 or more elements: calculate exact median of sorted buffer
        const sorted = [...this.buffer].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        if (sorted.length % 2 === 1) {
            return sorted[mid];
        }
        return (sorted[mid - 1] + sorted[mid]) / 2.0;
    }
    /**
     * Alias for filter(val) for pipeline compatibility.
     */
    update(val) {
        return this.filter(val);
    }
    /**
     * Resets the filter buffer to empty state.
     */
    reset() {
        this.buffer = [];
    }
    /**
     * Returns a copy of the current rolling buffer.
     */
    getBuffer() {
        return [...this.buffer];
    }
}
/**
 * Exponential Moving Average (EMA) Angle Filter.
 *
 * Implements a discrete-time first-order IIR filter:
 *   y_t = alpha * x_t + (1 - alpha) * y_{t-1}
 *
 * Latency Invariant:
 *   With alpha = 0.40 at 30 FPS (T = 33.33 ms):
 *   t_50% = (ln(1 - 0.5) / ln(1 - 0.40)) * 33.33 ms ≈ 45.2 ms < 50 ms.
 *   Step-response reaches > 50% within 2 frames while attenuating digitization noise.
 *
 * Dropout Invariant:
 *   Tolerates transient missing frames (up to maxMissingFrames - 1) by zero-order holding
 *   the last filtered value (or returning null if holdOnMissing is false).
 *   After maxMissingFrames (default 3) consecutive missing frames, resets to uninitialized.
 */
export class ExponentialMovingAverageFilter {
    alpha;
    maxMissingFrames;
    holdOnMissing;
    current = null;
    missingFrames = 0;
    /**
     * @param alpha Smoothing factor in (0, 1]. Default 0.40.
     * @param maxMissingFrames Consecutive missing frames before full reset. Default 3.
     * @param holdOnMissing Whether to hold last filtered value during transient dropouts < maxMissingFrames. Default true.
     */
    constructor(alpha = 0.40, maxMissingFrames = 3, holdOnMissing = true) {
        this.alpha = Number.isFinite(alpha) && alpha > 0 && alpha <= 1 ? alpha : 0.40;
        this.maxMissingFrames =
            Number.isFinite(maxMissingFrames) && maxMissingFrames > 0
                ? Math.floor(maxMissingFrames)
                : 3;
        this.holdOnMissing = holdOnMissing;
    }
    /**
     * Filters the incoming scalar sample.
     *
     * Rules:
     * - If val is null, undefined, or non-finite:
     *   - Increments missing frames counter.
     *   - If missingFrames >= maxMissingFrames: resets internal state and returns null.
     *   - If missingFrames < maxMissingFrames: returns last filtered value (or null if uninitialized/hold disabled).
     * - If val is valid finite number:
     *   - Resets missingFrames to 0.
     *   - If uninitialized (first valid frame): initializes state to val and returns val.
     *   - Otherwise: computes y_t = alpha * val + (1 - alpha) * current and returns y_t.
     *
     * @param val Raw incoming scalar value or null (tracking loss).
     * @returns Filtered scalar value, or null if tracking is lost.
     */
    filter(val) {
        if (val === null || val === undefined || !Number.isFinite(val)) {
            this.missingFrames++;
            if (this.missingFrames >= this.maxMissingFrames) {
                this.reset();
                return null;
            }
            return this.holdOnMissing ? this.current : null;
        }
        this.missingFrames = 0;
        if (this.current === null) {
            this.current = val;
            return val;
        }
        this.current = this.alpha * val + (1.0 - this.alpha) * this.current;
        return this.current;
    }
    /**
     * Alias for filter(val) for pipeline compatibility.
     */
    update(val) {
        return this.filter(val);
    }
    /**
     * Resets the filter to uninitialized state.
     */
    reset() {
        this.current = null;
        this.missingFrames = 0;
    }
    /**
     * Returns the current internal filtered state value.
     */
    getCurrent() {
        return this.current;
    }
    /**
     * Returns the count of consecutive missing frames.
     */
    getMissingFrames() {
        return this.missingFrames;
    }
}
// Aliases for compatibility across engine barrel exports and test suites
export { SlidingMedianFilter as MedianFilter };
export { ExponentialMovingAverageFilter as EmaFilter };
