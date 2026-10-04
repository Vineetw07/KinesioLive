/**
 * MediaPipe PoseLandmarker Execution Runner & Benchmark Engine
 * Conforms to Spike S1 (Milestone D2.1) & Survey 3 Specifications
 */
import { PoseLandmarker, type PoseLandmarkerResult, type NormalizedLandmark } from '@mediapipe/tasks-vision';
export declare class FpsMeter {
    private timestamps;
    private readonly windowSize;
    private totalFrames;
    private benchmarkStartTime;
    private totalInferenceDurationMs;
    recordFrame(inferenceDurationMs: number): void;
    getInstantFps(): number;
    getRollingFps(): number;
    getTotalFrames(): number;
    getSustainedStats(): {
        sustainedFps: number;
        avgLatencyMs: number;
        pass: boolean;
    };
    reset(): void;
}
export interface PoseLandmarkerInitResult {
    landmarker: PoseLandmarker;
    delegateUsed: 'GPU' | 'CPU';
}
/**
 * Initializes PoseLandmarker with GPU delegate and graceful CPU fallback.
 */
export declare function initializePoseLandmarker(): Promise<PoseLandmarkerInitResult>;
/**
 * Calculates 3D knee flexion angle in degrees using vector dot product.
 */
export declare function calculateKneeFlexionAngle(hip: {
    x: number;
    y: number;
    z: number;
}, knee: {
    x: number;
    y: number;
    z: number;
}, ankle: {
    x: number;
    y: number;
    z: number;
}): number;
/**
 * Starts continuous frame inference tapping the DOM <video> element.
 * Camera contention defense: Uses requestVideoFrameCallback or rAF, reading
 * compositor textures without acquiring a secondary camera track.
 */
export declare function startVideoPosePipeline(video: HTMLVideoElement, landmarker: PoseLandmarker, onPose: (result: PoseLandmarkerResult, latencyMs: number) => void): () => void;
/**
 * Draws the 33-landmark skeleton overlay on the canvas.
 */
export declare function drawPoseSkeleton(ctx: CanvasRenderingContext2D, landmarks: NormalizedLandmark[], width: number, height: number): void;
//# sourceMappingURL=poseRunner.d.ts.map