/**
 * client/src/engine/repCounter.ts
 *
 * Decoupled, zero-DOM Deterministic Rep Counter State Machine for KinesioLive.
 * Implements a 5-phase hysteresis finite state machine (standing, descending,
 * bottom, ascending, lost) with shallow-squat reversal deadlock defense,
 * rep validation gate (depth <= 105 deg, duration >= 800 ms, tempo classification),
 * tracking dropout recovery (< 1000 ms resume vs >= 1000 ms reset), and
 * independent bilateral knee valgus alert detector (descending & bottom phases,
 * > +8.0% deviation for >= 3 frames, independent 4000 ms cooldown timers per leg).
 *
 * Strictly adheres to:
 * - ORIGINAL_REQUEST.md § R3
 * - docs/trd.md § Section-2 & Section-3
 * - docs/testing.md § Section-2
 * - PROJECT.md § Interface Contracts
 */

import type {
  Side,
  SquatPhase,
  SquatDepthRating,
  SquatTempo,
  KineRepPayload,
  KineAlertPayload,
} from '@kinesio/shared';
import {
  SCHEMA_VERSION,
  VALGUS_THRESHOLD_PCT,
  VALGUS_COOLDOWN_MS,
} from '@kinesio/shared';

import {
  compute3DKneeFlexion,
  computeValgusDeviation,
  computeDepthRatio,
  type Point3D,
  type Point2D,
  type StandingBaseline,
} from './geometry';

/**
 * Options for configuring the RepCounterStateMachine.
 */
export interface RepCounterOptions {
  /** Session identifier for emitted payloads */
  sessionId?: string;
  /** Maximum knee angle at deepest point to qualify as a valid rep (default: 105.0 deg) */
  minValidKneeDeg?: number;
  /** Knee angle threshold for "deep" depth rating (default: 80.0 deg) */
  deepKneeDeg?: number;
  /** Minimum repetition duration in milliseconds to reject rapid bounce (default: 800 ms) */
  minRepDurationMs?: number;
  /** Threshold percentage for knee valgus form alert (default: 8.0%) */
  valgusThresholdPct?: number;
  /** Consecutive frames required to trigger knee valgus alert (default: 3 frames) */
  valgusConsecutiveFrames?: number;
  /** Independent alert cooldown period per leg in milliseconds (default: 4000 ms) */
  valgusCooldownMs?: number;
  /** Maximum tracking dropout duration in milliseconds before resetting to standing (default: 1000 ms) */
  dropoutResetMs?: number;
  /** Calibrated standing baseline for on-the-fly kinematics computation */
  baseline?: StandingBaseline | null;
}

/**
 * Flexible frame input contract for RepCounterStateMachine.
 * Supports pre-computed biomechanical kinematics as well as raw BlazePose landmark arrays.
 */
export interface RepCounterInput {
  /** Frame timestamp in milliseconds epoch */
  timestamp?: number;
  /** Frame timestamp in milliseconds epoch (fixture alias) */
  timestampMs?: number;
  /** Timestamp alias */
  t?: number;
  /** Representative knee flexion angle (or bilateral object) in degrees */
  kneeAngle?: { L: number | null; R: number | null } | number | null;
  /** Knee flexion angle alias */
  kneeDeg?: { L: number | null; R: number | null } | number | null;
  /** Normalized pelvic depth ratio (0.0 standing, ~1.0 parallel) */
  depthRatio?: number | null;
  /** Bilateral or scalar valgus deviation percentage */
  valgusDevPct?: { L: number | null; R: number | null } | number | null;
  /** Left knee valgus deviation percentage */
  valgusDevPctL?: number | null;
  /** Right knee valgus deviation percentage */
  valgusDevPctR?: number | null;
  /** Tracking landmark visibility in [0, 1] */
  visibility?: number | null;
  /** Visibility alias */
  vis?: number | null;
  /** Raw 2D landmarks (optional, for on-the-fly kinematics) */
  landmarks2D?: Array<Point2D | null | undefined> | null;
  /** Raw 2D landmarks alias */
  landmarks?: Array<Point2D | null | undefined> | null;
  /** Raw 3D metric worldLandmarks (optional, for on-the-fly kinematics) */
  worldLandmarks3D?: Array<Point3D | null | undefined> | null;
  /** Raw 3D metric worldLandmarks alias */
  worldLandmarks?: Array<Point3D | null | undefined> | null;
  /** Standing baseline override for this frame */
  baseline?: StandingBaseline | null;
  /** Session identifier override */
  sessionId?: string;
  /** Session identifier alias */
  sid?: string;
}

/**
 * Frame input type alias for pipeline compatibility.
 */
export type RepCounterFrameInput = RepCounterInput;

/**
 * Result returned by each frame update of RepCounterStateMachine.
 */
export interface RepCounterOutput {
  /** Current FSM squat phase */
  phase: SquatPhase;
  /** Total validated completed repetition count */
  reps: number;
  /** Total validated completed repetition count (alias) */
  count: number;
  /** Validated completed rep payload if a rep finished on this frame, else null */
  completedRep: KineRepPayload | null;
  /** Validated completed rep payload (alias for completedRep) */
  repEvent?: KineRepPayload;
  /** Form alerts triggered on this frame */
  alerts: KineAlertPayload[];
  /** Form alerts alias */
  alertEvents?: KineAlertPayload[];
  /** True if a repetition finished on this frame but was rejected due to shallow depth (> 105 deg) */
  isShallow: boolean;
  /** True if a repetition finished on this frame but was rejected due to rapid bounce (< 800 ms) */
  isBounce: boolean;
  /** Lowest knee angle reached during the current or most recent repetition (degrees) */
  minKneeDeg: number;
  /** Maximum pelvic descent ratio reached during the current repetition */
  maxDepthRatio: number;
  /** Current pelvic descent ratio */
  depthRatio: number;
}

/**
 * State summary interface.
 */
export interface RepCounterState {
  phase: SquatPhase;
  reps: number;
}

/**
 * Type alias for completed rep payload.
 */
export type RepCompletedEvent = KineRepPayload;

/**
 * Type alias for form alert payload.
 */
export type ValgusAlertEvent = KineAlertPayload;

/**
 * Deterministic Rep Counter State Machine.
 *
 * Implements:
 * 1. 5-Phase Hysteresis FSM:
 *    - standing -> descending (depthRatio > 0.25 || kneeDeg < 150.0)
 *    - descending -> bottom (depthRatio > 0.85 || kneeDeg < 100.0)
 *    - descending -> ascending (shallow reversal deadlock defense: kneeDeg > min + 10 && depthRatio decreasing)
 *    - bottom -> ascending (kneeDeg > 110.0 && depthRatio decreasing)
 *    - ascending -> standing (rep validation gate: kneeDeg > 160.0 && depthRatio < 0.20)
 * 2. Rep Validation Gate:
 *    - Valid: minKneeDeg <= 105.0 && durMs >= 800 ms -> increment reps, emit KineRepPayload
 *    - Shallow: minKneeDeg > 105.0 -> rejected, reps unchanged
 *    - Rapid bounce: durMs < 800 ms -> rejected, reps unchanged
 * 3. Tracking Dropout Recovery:
 *    - visibility < 0.65 -> transitions to "lost"
 *    - visibility restored: if upright (> 160 deg) -> standing; if dropout < 1000 ms -> resume; if dropout >= 1000 ms -> reset
 * 4. Valgus Form Alert Detector:
 *    - Active exclusively during descending and bottom phases
 *    - Fires when valgusDevPct > +8.0% persists for >= 3 consecutive frames
 *    - Independent 4000 ms cooldown timers per leg (Left and Right)
 *    - Emits KineAlertPayload
 */
export class RepCounterStateMachine {
  private _sessionId: string;
  private _baseline: StandingBaseline | null = null;
  private _phase: SquatPhase = 'standing';
  private _reps: number = 0;

  // Rep tracking state
  private _repStartTime: number | null = null;
  private _minKneeDeg: number = 180.0;
  private _maxDepthRatio: number = 0.0;
  private _currentDepthRatio: number = 0.0;

  // Dropout tracking
  private _previousPhaseBeforeLost: SquatPhase | null = null;
  private _lostStartTime: number | null = null;
  private _requiresUprightBeforeDescent: boolean = false;

  // Valgus alert detector state
  private _valgusFramesL: number = 0;
  private _valgusFramesR: number = 0;
  private _lastAlertTimeL: number;
  private _lastAlertTimeR: number;

  // Rejection flags for the most recent rep completion
  private _lastRepRejectedShallow: boolean = false;
  private _lastRepRejectedBounce: boolean = false;

  // Configuration options
  public readonly minValidKneeDeg: number;
  public readonly deepKneeDeg: number;
  public readonly minRepDurationMs: number;
  public readonly valgusThresholdPct: number;
  public readonly valgusConsecutiveFrames: number;
  public readonly valgusCooldownMs: number;
  public readonly dropoutResetMs: number;

  /**
   * Constructs a new RepCounterStateMachine instance.
   *
   * @param sessionIdOrOptions Optional session identifier string or options object.
   * @param maybeOptions Optional configuration options if first argument was a session ID.
   */
  constructor(
    sessionIdOrOptions?: string | RepCounterOptions,
    maybeOptions?: RepCounterOptions
  ) {
    let opts: RepCounterOptions = {};
    if (typeof sessionIdOrOptions === 'string') {
      this._sessionId = sessionIdOrOptions;
      if (maybeOptions && typeof maybeOptions === 'object') {
        opts = maybeOptions;
      }
    } else if (sessionIdOrOptions && typeof sessionIdOrOptions === 'object') {
      opts = sessionIdOrOptions;
      this._sessionId = opts.sessionId ?? '';
    } else {
      this._sessionId = '';
    }

    this.minValidKneeDeg = opts.minValidKneeDeg ?? 105.0;
    this.deepKneeDeg = opts.deepKneeDeg ?? 80.0;
    this.minRepDurationMs = opts.minRepDurationMs ?? 800;
    this.valgusThresholdPct = opts.valgusThresholdPct ?? VALGUS_THRESHOLD_PCT;
    this.valgusConsecutiveFrames = opts.valgusConsecutiveFrames ?? 3;
    this.valgusCooldownMs = opts.valgusCooldownMs ?? VALGUS_COOLDOWN_MS;
    this.dropoutResetMs = opts.dropoutResetMs ?? 1000;
    this._baseline = opts.baseline ?? null;

    // Initialize alert cooldowns so first eligible alert triggers immediately
    this._lastAlertTimeL = -this.valgusCooldownMs;
    this._lastAlertTimeR = -this.valgusCooldownMs;
  }

  /**
   * Primary frame processing method.
   * Updates state machine based on the current kinematics or landmarks frame.
   *
   * @param input Frame data.
   * @returns RepCounterOutput with current phase, reps, events, and metrics.
   */
  public update(input: RepCounterInput): RepCounterOutput {
    const timestamp = input.timestamp ?? input.timestampMs ?? input.t ?? Date.now();

    // Session ID update if passed in frame
    if (input.sessionId) {
      this._sessionId = input.sessionId;
    } else if (input.sid) {
      this._sessionId = input.sid;
    }

    // Baseline update if passed in frame
    if (input.baseline) {
      this._baseline = input.baseline;
    }

    // 1. Extract Representative Knee Flexion Angle
    const thetaKnee = this.extractKneeFlexion(input);

    // 2. Extract Visibility
    const visibility = this.extractVisibility(input, thetaKnee);

    // 3. Extract Depth Ratio
    const depthRatio = this.extractDepthRatio(input);
    this._currentDepthRatio = depthRatio;

    // 4. Extract Valgus Deviations
    const { valgusL, valgusR } = this.extractValgus(input);

    const alerts: KineAlertPayload[] = [];
    let completedRep: KineRepPayload | null = null;
    let isShallow = false;
    let isBounce = false;

    // 5. Tracking Dropout / Visibility Guard
    if (visibility < 0.65 || thetaKnee === null) {
      if (this._phase !== 'lost') {
        this._previousPhaseBeforeLost = this._phase;
        this._lostStartTime = timestamp;
        this._phase = 'lost';
      }
      this._valgusFramesL = 0;
      this._valgusFramesR = 0;
      return this.buildOutput(null, alerts, false, false, depthRatio);
    }

    // 6. Recovery from 'lost' State
    if (this._phase === 'lost') {
      const dropoutMs = this._lostStartTime !== null ? (timestamp - this._lostStartTime) : 0;
      if (thetaKnee > 160.0) {
        this._phase = 'standing';
        this.resetRepState();
        this._requiresUprightBeforeDescent = false;
      } else if (
        this._previousPhaseBeforeLost &&
        this._previousPhaseBeforeLost !== 'lost' &&
        dropoutMs < this.dropoutResetMs
      ) {
        // Transient dropout (< 1000 ms): cleanly resume previous phase
        this._phase = this._previousPhaseBeforeLost;
      } else {
        // Extended dropout (>= 1000 ms): reset rep state to standing
        this._phase = 'standing';
        this.resetRepState();
        // If subject is still bent, require returning to upright before starting a new rep
        if (thetaKnee <= 160.0) {
          this._requiresUprightBeforeDescent = true;
        }
      }
      this._previousPhaseBeforeLost = null;
      this._lostStartTime = null;
    }

    // 7. FSM Phase State Machine
    switch (this._phase) {
      case 'standing': {
        // If flagged to require standing upright first after long dropout
        if (this._requiresUprightBeforeDescent) {
          if (thetaKnee > 160.0 && depthRatio < 0.20) {
            this._requiresUprightBeforeDescent = false;
          }
          break;
        }

        // Transition 1: standing -> descending
        if (depthRatio > 0.25 || thetaKnee < 150.0) {
          this._phase = 'descending';
          this._repStartTime = timestamp;
          this._minKneeDeg = thetaKnee;
          this._maxDepthRatio = depthRatio;
          this._valgusFramesL = 0;
          this._valgusFramesR = 0;
          this._lastRepRejectedShallow = false;
          this._lastRepRejectedBounce = false;

          // Check valgus on first frame of descent
          this.checkValgusAlert(valgusL, 'L', timestamp, alerts);
          this.checkValgusAlert(valgusR, 'R', timestamp, alerts);
        }
        break;
      }

      case 'descending': {
        if (thetaKnee < this._minKneeDeg) this._minKneeDeg = thetaKnee;
        if (depthRatio > this._maxDepthRatio) this._maxDepthRatio = depthRatio;

        // Transition 2: descending -> bottom
        if (depthRatio > 0.85 || thetaKnee < 100.0) {
          this._phase = 'bottom';
        }
        // Transition 3: descending -> ascending (Shallow Squat Reversal Path)
        // Prevents FSM deadlock when user reverses without reaching bottom threshold
        else if (thetaKnee > this._minKneeDeg + 10.0 && depthRatio < this._maxDepthRatio) {
          this._phase = 'ascending';
        }

        // Valgus alert detector active during descending
        this.checkValgusAlert(valgusL, 'L', timestamp, alerts);
        this.checkValgusAlert(valgusR, 'R', timestamp, alerts);
        break;
      }

      case 'bottom': {
        if (thetaKnee < this._minKneeDeg) this._minKneeDeg = thetaKnee;
        if (depthRatio > this._maxDepthRatio) this._maxDepthRatio = depthRatio;

        // Transition 4: bottom -> ascending
        if (thetaKnee > 110.0 && depthRatio < this._maxDepthRatio) {
          this._phase = 'ascending';
        }

        // Valgus alert detector active during bottom
        this.checkValgusAlert(valgusL, 'L', timestamp, alerts);
        this.checkValgusAlert(valgusR, 'R', timestamp, alerts);
        break;
      }

      case 'ascending': {
        if (thetaKnee < this._minKneeDeg) this._minKneeDeg = thetaKnee;

        // Transition 5: ascending -> standing (Rep Validation Gate)
        if (thetaKnee > 160.0 && depthRatio < 0.20) {
          const durMs = this._repStartTime !== null ? (timestamp - this._repStartTime) : 0;

          // Validation Gate:
          // Valid Rep: min(theta_knee) <= 105.0 deg AND duration >= 800 ms
          if (this._minKneeDeg <= this.minValidKneeDeg && durMs >= this.minRepDurationMs) {
            this._reps++;
            const depth: SquatDepthRating =
              this._minKneeDeg <= this.deepKneeDeg ? 'deep' : 'good';
            const tempo: SquatTempo =
              durMs < 1200 ? 'fast' : (durMs <= 3500 ? 'controlled' : 'slow');

            completedRep = {
              v: SCHEMA_VERSION,
              sid: this._sessionId,
              t: timestamp,
              type: 'kine.rep',
              n: this._reps,
              minKneeDeg: Math.round(this._minKneeDeg * 10) / 10,
              depth,
              durMs,
              tempo,
            };
            isShallow = false;
            isBounce = false;
            this._lastRepRejectedShallow = false;
            this._lastRepRejectedBounce = false;
          } else {
            // Shallow squat: min(theta_knee) > 105 deg
            if (this._minKneeDeg > this.minValidKneeDeg) {
              isShallow = true;
              this._lastRepRejectedShallow = true;
            }
            // Rapid bounce: duration < 800 ms
            if (durMs < this.minRepDurationMs) {
              isBounce = true;
              this._lastRepRejectedBounce = true;
            }
          }

          this._phase = 'standing';
          this.resetRepState();
        }
        break;
      }
    }

    return this.buildOutput(completedRep, alerts, isShallow, isBounce, depthRatio);
  }

  /**
   * Alias for update(input) for pipeline compatibility.
   */
  public processFrame(input: RepCounterInput): RepCounterOutput {
    return this.update(input);
  }

  /**
   * Resets the entire state machine back to neutral standing, zeroing all counters and history.
   */
  public reset(): void {
    this._phase = 'standing';
    this._reps = 0;
    this.resetRepState();
    this._previousPhaseBeforeLost = null;
    this._lostStartTime = null;
    this._requiresUprightBeforeDescent = false;
    this._lastAlertTimeL = -this.valgusCooldownMs;
    this._lastAlertTimeR = -this.valgusCooldownMs;
    this._lastRepRejectedShallow = false;
    this._lastRepRejectedBounce = false;
    this._currentDepthRatio = 0.0;
  }

  /**
   * Resets intra-repetition tracking variables.
   */
  private resetRepState(): void {
    this._repStartTime = null;
    this._minKneeDeg = 180.0;
    this._maxDepthRatio = 0.0;
    this._valgusFramesL = 0;
    this._valgusFramesR = 0;
  }

  /**
   * Checks knee valgus deviation and triggers alert if threshold is sustained for consecutive frames.
   */
  private checkValgusAlert(
    valgusDevPct: number | null,
    side: Side,
    timestamp: number,
    alerts: KineAlertPayload[]
  ): void {
    const isExceeded =
      valgusDevPct !== null &&
      valgusDevPct !== undefined &&
      Number.isFinite(valgusDevPct) &&
      valgusDevPct > this.valgusThresholdPct;

    if (isExceeded) {
      if (side === 'L') this._valgusFramesL++;
      else this._valgusFramesR++;
    } else {
      if (side === 'L') this._valgusFramesL = 0;
      else this._valgusFramesR = 0;
    }

    const consecutiveFrames = side === 'L' ? this._valgusFramesL : this._valgusFramesR;
    const lastAlertTime = side === 'L' ? this._lastAlertTimeL : this._lastAlertTimeR;

    if (
      consecutiveFrames >= this.valgusConsecutiveFrames &&
      timestamp - lastAlertTime >= this.valgusCooldownMs
    ) {
      if (side === 'L') this._lastAlertTimeL = timestamp;
      else this._lastAlertTimeR = timestamp;

      alerts.push({
        v: SCHEMA_VERSION,
        sid: this._sessionId,
        t: timestamp,
        type: 'kine.alert',
        kind: 'knee_valgus',
        side,
        value: Math.round(valgusDevPct! * 10) / 10,
        thresholdPct: this.valgusThresholdPct,
        repN: this._reps + 1,
        phase: this._phase,
        note: 'Form alert (biomechanical feedback)',
      });
    }
  }

  /**
   * Extracts representative knee angle from input.
   * If input contains bilateral numbers, takes the active/minimum angle.
   * If input contains worldLandmarks3D, computes via 3D dot product.
   */
  private extractKneeFlexion(input: RepCounterInput): number | null {
    // 1. Direct scalar kneeDeg
    if (typeof input.kneeDeg === 'number') {
      return Number.isFinite(input.kneeDeg) ? input.kneeDeg : null;
    }

    // 2. Direct scalar kneeAngle
    if (typeof input.kneeAngle === 'number') {
      return Number.isFinite(input.kneeAngle) ? input.kneeAngle : null;
    }

    // 3. Bilateral object kneeDeg: { L, R }
    if (typeof input.kneeDeg === 'object' && input.kneeDeg !== null) {
      const angles: number[] = [];
      if (typeof input.kneeDeg.L === 'number' && Number.isFinite(input.kneeDeg.L)) {
        angles.push(input.kneeDeg.L);
      }
      if (typeof input.kneeDeg.R === 'number' && Number.isFinite(input.kneeDeg.R)) {
        angles.push(input.kneeDeg.R);
      }
      return angles.length > 0 ? Math.min(...angles) : null;
    }

    // 4. Bilateral object kneeAngle: { L, R }
    if (typeof input.kneeAngle === 'object' && input.kneeAngle !== null) {
      const angles: number[] = [];
      if (typeof input.kneeAngle.L === 'number' && Number.isFinite(input.kneeAngle.L)) {
        angles.push(input.kneeAngle.L);
      }
      if (typeof input.kneeAngle.R === 'number' && Number.isFinite(input.kneeAngle.R)) {
        angles.push(input.kneeAngle.R);
      }
      return angles.length > 0 ? Math.min(...angles) : null;
    }

    // 5. On-the-fly computation from worldLandmarks3D / worldLandmarks
    const worldLandmarks = input.worldLandmarks3D ?? input.worldLandmarks;
    if (worldLandmarks && worldLandmarks.length >= 29) {
      const thetaL = compute3DKneeFlexion(
        worldLandmarks[23],
        worldLandmarks[25],
        worldLandmarks[27]
      );
      const thetaR = compute3DKneeFlexion(
        worldLandmarks[24],
        worldLandmarks[26],
        worldLandmarks[28]
      );
      const angles: number[] = [];
      if (thetaL !== null && Number.isFinite(thetaL)) angles.push(thetaL);
      if (thetaR !== null && Number.isFinite(thetaR)) angles.push(thetaR);
      return angles.length > 0 ? Math.min(...angles) : null;
    }

    return null;
  }

  /**
   * Extracts visibility from input or landmarks.
   */
  private extractVisibility(input: RepCounterInput, thetaKnee: number | null): number {
    if (input.visibility !== undefined && input.visibility !== null) {
      return Number.isFinite(input.visibility) ? input.visibility : 0.0;
    }
    if (input.vis !== undefined && input.vis !== null) {
      return Number.isFinite(input.vis) ? input.vis : 0.0;
    }

    // If landmarks are provided, check minimum visibility of keypoints
    const landmarks = input.worldLandmarks3D ?? input.worldLandmarks ?? input.landmarks2D ?? input.landmarks;
    if (landmarks && landmarks.length >= 29) {
      const indices = [23, 24, 25, 26, 27, 28];
      let minVis = 1.0;
      for (const idx of indices) {
        const lm = landmarks[idx];
        if (!lm) {
          minVis = 0.0;
          break;
        }
        if (lm.visibility !== undefined && lm.visibility < minVis) {
          minVis = lm.visibility;
        }
      }
      return minVis;
    }

    // Fallback: if knee angle is present and finite, assume visible; else lost
    return thetaKnee !== null ? 1.0 : 0.0;
  }

  /**
   * Extracts depth ratio from input or computes from landmarks2D and baseline.
   */
  private extractDepthRatio(input: RepCounterInput): number {
    if (typeof input.depthRatio === 'number' && Number.isFinite(input.depthRatio)) {
      return input.depthRatio;
    }

    const baseline = input.baseline ?? this._baseline;
    const landmarks2D = input.landmarks2D ?? input.landmarks;
    if (landmarks2D && landmarks2D.length >= 29 && baseline) {
      const lm23 = landmarks2D[23];
      const lm24 = landmarks2D[24];
      if (
        lm23 && lm24 &&
        typeof lm23.y === 'number' && Number.isFinite(lm23.y) &&
        typeof lm24.y === 'number' && Number.isFinite(lm24.y)
      ) {
        const currentHipY = (lm23.y + lm24.y) / 2.0;
        return computeDepthRatio(currentHipY, baseline);
      }
    }

    return 0.0;
  }

  /**
   * Extracts Left and Right knee valgus deviation percentages from input.
   */
  private extractValgus(input: RepCounterInput): { valgusL: number | null; valgusR: number | null } {
    let valgusL: number | null = null;
    let valgusR: number | null = null;

    if (typeof input.valgusDevPctL === 'number' && Number.isFinite(input.valgusDevPctL)) {
      valgusL = input.valgusDevPctL;
    }
    if (typeof input.valgusDevPctR === 'number' && Number.isFinite(input.valgusDevPctR)) {
      valgusR = input.valgusDevPctR;
    }

    if (valgusL === null && typeof input.valgusDevPct === 'object' && input.valgusDevPct !== null) {
      if (typeof input.valgusDevPct.L === 'number' && Number.isFinite(input.valgusDevPct.L)) {
        valgusL = input.valgusDevPct.L;
      }
    }
    if (valgusR === null && typeof input.valgusDevPct === 'object' && input.valgusDevPct !== null) {
      if (typeof input.valgusDevPct.R === 'number' && Number.isFinite(input.valgusDevPct.R)) {
        valgusR = input.valgusDevPct.R;
      }
    }

    if (
      valgusL === null && valgusR === null &&
      typeof input.valgusDevPct === 'number' && Number.isFinite(input.valgusDevPct)
    ) {
      valgusL = input.valgusDevPct;
      valgusR = input.valgusDevPct;
    }

    // On-the-fly computation from landmarks2D / landmarks and baseline if available
    const baseline = input.baseline ?? this._baseline;
    const landmarks2D = input.landmarks2D ?? input.landmarks;
    if (valgusL === null && valgusR === null && landmarks2D && landmarks2D.length >= 29 && baseline) {
      valgusL = computeValgusDeviation(
        landmarks2D[23],
        landmarks2D[25],
        landmarks2D[27],
        baseline,
        'L'
      );
      valgusR = computeValgusDeviation(
        landmarks2D[24],
        landmarks2D[26],
        landmarks2D[28],
        baseline,
        'R'
      );
    }

    return { valgusL, valgusR };
  }

  /**
   * Helper to construct a unified RepCounterOutput.
   */
  private buildOutput(
    completedRep: KineRepPayload | null,
    alerts: KineAlertPayload[],
    isShallow: boolean,
    isBounce: boolean,
    depthRatio: number
  ): RepCounterOutput {
    return {
      phase: this._phase,
      reps: this._reps,
      count: this._reps,
      completedRep,
      repEvent: completedRep ?? undefined,
      alerts,
      alertEvents: alerts.length > 0 ? alerts : undefined,
      isShallow,
      isBounce,
      minKneeDeg: this._minKneeDeg,
      maxDepthRatio: this._maxDepthRatio,
      depthRatio,
    };
  }

  // Convenience Accessors
  public get phase(): SquatPhase {
    return this._phase;
  }

  public get reps(): number {
    return this._reps;
  }

  public get count(): number {
    return this._reps;
  }

  public get minKneeDeg(): number {
    return this._minKneeDeg;
  }

  public get maxDepthRatio(): number {
    return this._maxDepthRatio;
  }

  public get currentDepthRatio(): number {
    return this._currentDepthRatio;
  }

  public get sessionId(): string {
    return this._sessionId;
  }

  public set sessionId(sid: string) {
    this._sessionId = sid;
  }

  public get baseline(): StandingBaseline | null {
    return this._baseline;
  }

  public set baseline(b: StandingBaseline | null) {
    this._baseline = b;
  }

  public getPhase(): SquatPhase {
    return this._phase;
  }

  public getReps(): number {
    return this._reps;
  }

  public getCount(): number {
    return this._reps;
  }

  public getState(): RepCounterState {
    return {
      phase: this._phase,
      reps: this._reps,
    };
  }

  public getMinKneeDeg(): number {
    return this._minKneeDeg;
  }

  public getMaxDepthRatio(): number {
    return this._maxDepthRatio;
  }

  public getCurrentDepthRatio(): number {
    return this._currentDepthRatio;
  }

  public getSessionId(): string {
    return this._sessionId;
  }

  public setSessionId(sid: string): void {
    this._sessionId = sid;
  }

  public getBaseline(): StandingBaseline | null {
    return this._baseline;
  }

  public setBaseline(baseline: StandingBaseline | null): void {
    this._baseline = baseline;
  }

  public isLastRepShallow(): boolean {
    return this._lastRepRejectedShallow;
  }

  public isLastRepBounce(): boolean {
    return this._lastRepRejectedBounce;
  }
}

// Aliases for compatibility
export { RepCounterStateMachine as RepCounter };
