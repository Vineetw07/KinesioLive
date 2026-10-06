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
  public readonly windowSize: number;
  private buffer: number[] = [];

  /**
   * @param windowSize Rolling buffer size (default 3 frames).
   */
  constructor(windowSize: number = 3) {
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
  public filter(val: number | null | undefined): number | null {
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
  public update(val: number | null | undefined): number | null {
    return this.filter(val);
  }

  /**
   * Resets the filter buffer to empty state.
   */
  public reset(): void {
    this.buffer = [];
  }

  /**
   * Returns a copy of the current rolling buffer.
   */
  public getBuffer(): number[] {
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
  public readonly alpha: number;
  public readonly maxMissingFrames: number;
  public readonly holdOnMissing: boolean;

  private current: number | null = null;
  private missingFrames: number = 0;

  /**
   * @param alpha Smoothing factor in (0, 1]. Default 0.40.
   * @param maxMissingFrames Consecutive missing frames before full reset. Default 3.
   * @param holdOnMissing Whether to hold last filtered value during transient dropouts < maxMissingFrames. Default true.
   */
  constructor(
    alpha: number = 0.40,
    maxMissingFrames: number = 3,
    holdOnMissing: boolean = true
  ) {
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
  public filter(val: number | null | undefined): number | null {
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
  public update(val: number | null | undefined): number | null {
    return this.filter(val);
  }

  /**
   * Resets the filter to uninitialized state.
   */
  public reset(): void {
    this.current = null;
    this.missingFrames = 0;
  }

  /**
   * Returns the current internal filtered state value.
   */
  public getCurrent(): number | null {
    return this.current;
  }

  /**
   * Returns the count of consecutive missing frames.
   */
  public getMissingFrames(): number {
    return this.missingFrames;
  }
}

// Aliases for compatibility across engine barrel exports and test suites
export { SlidingMedianFilter as MedianFilter };
export { ExponentialMovingAverageFilter as EmaFilter };

export interface OneEuroFilterOptions {
  /** Minimum cutoff frequency in Hz (default: 1.0). Lower values eliminate stationary jitter. */
  minCutoff?: number;
  /** Speed coefficient (default: 0.007). Higher values dynamically expand cutoff to eliminate phase lag. */
  beta?: number;
  /** Cutoff frequency for derivative filtering in Hz (default: 1.0). */
  dCutoff?: number;
}

/**
 * 1€ (One-Euro) Adaptive Cutoff Filter (Casiez, Roussel, Vogel, CHI 2012).
 *
 * Implements an adaptive low-pass filter specifically tailored for human biomechanics:
 *   f_c = f_{c,min} + beta * |dx_hat|
 *   alpha = 1 / (1 + 1 / (2 * pi * f_c * T))
 *   x_hat_i = alpha * x_i + (1 - alpha) * x_hat_{i-1}
 *
 * Latency vs. Jitter Invariant:
 * - At low velocity (standing/stabilizing): cutoff relaxes to minCutoff (e.g. 1.0 Hz),
 *   eliminating digit flicker and jitter.
 * - At high velocity (rapid descent/ascent): cutoff scales dynamically with |dx|,
 *   driving alpha -> 1 and eliminating phase lag.
 */
export class OneEuroFilter {
  public minCutoff: number;
  public beta: number;
  public dCutoff: number;

  private xHat: number | null = null;
  private dxHat: number = 0;
  private lastTimestamp: number | null = null;
  private lastFc: number = 1.0;
  private lastAlpha: number = 0.5;

  /**
   * Constructs a OneEuroFilter.
   * Supports either positional arguments (minCutoff, beta, dCutoff) or an options object.
   */
  constructor(
    minCutoffOrOptions?: number | OneEuroFilterOptions,
    beta?: number,
    dCutoff?: number
  ) {
    if (typeof minCutoffOrOptions === 'object' && minCutoffOrOptions !== null) {
      const opts = minCutoffOrOptions;
      this.minCutoff = Number.isFinite(opts.minCutoff) && (opts.minCutoff ?? 0) > 0 ? (opts.minCutoff as number) : 1.0;
      this.beta = Number.isFinite(opts.beta) && (opts.beta ?? 0) >= 0 ? (opts.beta as number) : 0.007;
      this.dCutoff = Number.isFinite(opts.dCutoff) && (opts.dCutoff ?? 0) > 0 ? (opts.dCutoff as number) : 1.0;
    } else {
      const mc = minCutoffOrOptions as number | undefined;
      this.minCutoff = Number.isFinite(mc) && (mc ?? 0) > 0 ? (mc as number) : 1.0;
      this.beta = Number.isFinite(beta) && (beta ?? 0) >= 0 ? (beta as number) : 0.007;
      this.dCutoff = Number.isFinite(dCutoff) && (dCutoff ?? 0) > 0 ? (dCutoff as number) : 1.0;
    }
  }

  /**
   * Computes the smoothing factor alpha from cutoff frequency (Hz) and sampling period T (seconds).
   * Equation: alpha = 1 / (1 + 1 / (2 * pi * cutoff * dt))
   */
  public static computeAlpha(cutoff: number, dt: number): number {
    if (cutoff <= 0 || dt <= 0) return 0;
    const denominator = 1.0 + 1.0 / (2.0 * Math.PI * cutoff * dt);
    if (!Number.isFinite(denominator) || denominator === 0) return 0;
    return Math.min(1.0, Math.max(0.0, 1.0 / denominator));
  }

  /**
   * Filters the incoming signal sample.
   *
   * @param val Raw incoming scalar value or null (tracking loss).
   * @param timestamp Optional timestamp in milliseconds or seconds.
   * @returns Filtered scalar value, or null if tracking is lost.
   */
  public filter(val: number | null | undefined, timestamp?: number): number | null {
    if (val === null || val === undefined || !Number.isFinite(val)) {
      this.reset();
      return null;
    }

    // 1st frame initialization
    if (this.xHat === null) {
      this.xHat = val;
      this.dxHat = 0;
      this.lastTimestamp = timestamp !== undefined && Number.isFinite(timestamp) ? timestamp : null;
      this.lastFc = this.minCutoff;
      this.lastAlpha = 1.0;
      return val;
    }

    // Determine sampling period dt (seconds)
    let dt = 1.0 / 30.0; // Default nominal 30 FPS rate
    if (timestamp !== undefined && Number.isFinite(timestamp) && this.lastTimestamp !== null) {
      const delta = timestamp - this.lastTimestamp;
      if (delta > 0) {
        // Automatically determine if timestamp is in ms (delta > 10) or seconds
        dt = delta > 10 ? delta / 1000.0 : delta;
      }
    }

    if (timestamp !== undefined && Number.isFinite(timestamp)) {
      this.lastTimestamp = timestamp;
    }

    // Safeguard against non-positive dt
    if (dt <= 0.0001) {
      dt = 0.0001;
    }

    // 1. Estimate raw derivative and filter it
    const dx = (val - this.xHat) / dt;
    const alphaD = OneEuroFilter.computeAlpha(this.dCutoff, dt);
    this.dxHat = alphaD * dx + (1.0 - alphaD) * this.dxHat;

    // 2. Compute dynamic cutoff frequency: fc = minCutoff + beta * |dx_hat|
    const fc = this.minCutoff + this.beta * Math.abs(this.dxHat);
    this.lastFc = fc;

    // 3. Filter position signal: x_hat = alpha * val + (1 - alpha) * x_hat_{prev}
    const alpha = OneEuroFilter.computeAlpha(fc, dt);
    this.lastAlpha = alpha;
    this.xHat = alpha * val + (1.0 - alpha) * this.xHat;

    return this.xHat;
  }

  /**
   * Alias for filter(val, timestamp) for pipeline compatibility.
   */
  public update(val: number | null | undefined, timestamp?: number): number | null {
    return this.filter(val, timestamp);
  }

  /**
   * Resets the filter to uninitialized state.
   */
  public reset(): void {
    this.xHat = null;
    this.dxHat = 0;
    this.lastTimestamp = null;
    this.lastFc = this.minCutoff;
    this.lastAlpha = 0.5;
  }

  /**
   * Returns current internal state or null.
   */
  public getCurrent(): number | null {
    return this.xHat;
  }

  /**
   * Returns current filtered derivative estimate.
   */
  public getDerivative(): number {
    return this.dxHat;
  }

  /**
   * Returns last computed adaptive cutoff frequency.
   */
  public getCutoff(): number {
    return this.lastFc;
  }

  /**
   * Returns last computed smoothing factor alpha.
   */
  public getAlpha(): number {
    return this.lastAlpha;
  }
}

export { OneEuroFilter as EuroFilter };

