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
import type { SquatPhase, KineRepPayload, KineAlertPayload } from '@kinesio/shared';
import { type Point3D, type Point2D, type StandingBaseline } from './geometry';
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
    kneeAngle?: {
        L: number | null;
        R: number | null;
    } | number | null;
    /** Knee flexion angle alias */
    kneeDeg?: {
        L: number | null;
        R: number | null;
    } | number | null;
    /** Normalized pelvic depth ratio (0.0 standing, ~1.0 parallel) */
    depthRatio?: number | null;
    /** Bilateral or scalar valgus deviation percentage */
    valgusDevPct?: {
        L: number | null;
        R: number | null;
    } | number | null;
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
export declare class RepCounterStateMachine {
    private _sessionId;
    private _baseline;
    private _phase;
    private _reps;
    private _repStartTime;
    private _minKneeDeg;
    private _maxDepthRatio;
    private _currentDepthRatio;
    private _previousPhaseBeforeLost;
    private _lostStartTime;
    private _requiresUprightBeforeDescent;
    private _valgusFramesL;
    private _valgusFramesR;
    private _lastAlertTimeL;
    private _lastAlertTimeR;
    private _lastRepRejectedShallow;
    private _lastRepRejectedBounce;
    readonly minValidKneeDeg: number;
    readonly deepKneeDeg: number;
    readonly minRepDurationMs: number;
    readonly valgusThresholdPct: number;
    readonly valgusConsecutiveFrames: number;
    readonly valgusCooldownMs: number;
    readonly dropoutResetMs: number;
    /**
     * Constructs a new RepCounterStateMachine instance.
     *
     * @param sessionIdOrOptions Optional session identifier string or options object.
     * @param maybeOptions Optional configuration options if first argument was a session ID.
     */
    constructor(sessionIdOrOptions?: string | RepCounterOptions, maybeOptions?: RepCounterOptions);
    /**
     * Primary frame processing method.
     * Updates state machine based on the current kinematics or landmarks frame.
     *
     * @param input Frame data.
     * @returns RepCounterOutput with current phase, reps, events, and metrics.
     */
    update(input: RepCounterInput): RepCounterOutput;
    /**
     * Alias for update(input) for pipeline compatibility.
     */
    processFrame(input: RepCounterInput): RepCounterOutput;
    /**
     * Resets the entire state machine back to neutral standing, zeroing all counters and history.
     */
    reset(): void;
    /**
     * Resets intra-repetition tracking variables.
     */
    private resetRepState;
    /**
     * Checks knee valgus deviation and triggers alert if threshold is sustained for consecutive frames.
     */
    private checkValgusAlert;
    /**
     * Extracts representative knee angle from input.
     * If input contains bilateral numbers, takes the active/minimum angle.
     * If input contains worldLandmarks3D, computes via 3D dot product.
     */
    private extractKneeFlexion;
    /**
     * Extracts visibility from input or landmarks.
     */
    private extractVisibility;
    /**
     * Extracts depth ratio from input or computes from landmarks2D and baseline.
     */
    private extractDepthRatio;
    /**
     * Extracts Left and Right knee valgus deviation percentages from input.
     */
    private extractValgus;
    /**
     * Helper to construct a unified RepCounterOutput.
     */
    private buildOutput;
    get phase(): SquatPhase;
    get reps(): number;
    get count(): number;
    get minKneeDeg(): number;
    get maxDepthRatio(): number;
    get currentDepthRatio(): number;
    get sessionId(): string;
    set sessionId(sid: string);
    get baseline(): StandingBaseline | null;
    set baseline(b: StandingBaseline | null);
    getPhase(): SquatPhase;
    getReps(): number;
    getCount(): number;
    getState(): RepCounterState;
    getMinKneeDeg(): number;
    getMaxDepthRatio(): number;
    getCurrentDepthRatio(): number;
    getSessionId(): string;
    setSessionId(sid: string): void;
    getBaseline(): StandingBaseline | null;
    setBaseline(baseline: StandingBaseline | null): void;
    isLastRepShallow(): boolean;
    isLastRepBounce(): boolean;
}
export { RepCounterStateMachine as RepCounter };
//# sourceMappingURL=repCounter.d.ts.map