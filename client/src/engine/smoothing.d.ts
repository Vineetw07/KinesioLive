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
export declare class SlidingMedianFilter {
    readonly windowSize: number;
    private buffer;
    /**
     * @param windowSize Rolling buffer size (default 3 frames).
     */
    constructor(windowSize?: number);
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
    filter(val: number | null | undefined): number | null;
    /**
     * Alias for filter(val) for pipeline compatibility.
     */
    update(val: number | null | undefined): number | null;
    /**
     * Resets the filter buffer to empty state.
     */
    reset(): void;
    /**
     * Returns a copy of the current rolling buffer.
     */
    getBuffer(): number[];
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
export declare class ExponentialMovingAverageFilter {
    readonly alpha: number;
    readonly maxMissingFrames: number;
    readonly holdOnMissing: boolean;
    private current;
    private missingFrames;
    /**
     * @param alpha Smoothing factor in (0, 1]. Default 0.40.
     * @param maxMissingFrames Consecutive missing frames before full reset. Default 3.
     * @param holdOnMissing Whether to hold last filtered value during transient dropouts < maxMissingFrames. Default true.
     */
    constructor(alpha?: number, maxMissingFrames?: number, holdOnMissing?: boolean);
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
    filter(val: number | null | undefined): number | null;
    /**
     * Alias for filter(val) for pipeline compatibility.
     */
    update(val: number | null | undefined): number | null;
    /**
     * Resets the filter to uninitialized state.
     */
    reset(): void;
    /**
     * Returns the current internal filtered state value.
     */
    getCurrent(): number | null;
    /**
     * Returns the count of consecutive missing frames.
     */
    getMissingFrames(): number;
}
export { SlidingMedianFilter as MedianFilter };
export { ExponentialMovingAverageFilter as EmaFilter };
//# sourceMappingURL=smoothing.d.ts.map