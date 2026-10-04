/**
 * MediaPipe PoseLandmarker Execution Runner & Benchmark Engine
 * Conforms to Spike S1 (Milestone D2.1) & Survey 3 Specifications
 */
import { FilesetResolver, PoseLandmarker, } from '@mediapipe/tasks-vision';
const WASM_CDN_PATH = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm';
const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';
export class FpsMeter {
    timestamps = [];
    windowSize = 30;
    totalFrames = 0;
    benchmarkStartTime = null;
    totalInferenceDurationMs = 0;
    recordFrame(inferenceDurationMs) {
        const now = performance.now();
        this.timestamps.push(now);
        if (this.timestamps.length > this.windowSize) {
            this.timestamps.shift();
        }
        if (this.benchmarkStartTime === null) {
            this.benchmarkStartTime = now;
        }
        this.totalFrames++;
        this.totalInferenceDurationMs += inferenceDurationMs;
    }
    getInstantFps() {
        if (this.timestamps.length < 2)
            return 0;
        const delta = this.timestamps[this.timestamps.length - 1] - this.timestamps[this.timestamps.length - 2];
        return delta > 0 ? 1000 / delta : 0;
    }
    getRollingFps() {
        if (this.timestamps.length < 2)
            return 0;
        const spanMs = this.timestamps[this.timestamps.length - 1] - this.timestamps[0];
        return spanMs > 0 ? ((this.timestamps.length - 1) / spanMs) * 1000 : 0;
    }
    getTotalFrames() {
        return this.totalFrames;
    }
    getSustainedStats() {
        if (this.benchmarkStartTime === null || this.totalFrames < 15) {
            return { sustainedFps: 0, avgLatencyMs: 0, pass: false };
        }
        const elapsedSec = (performance.now() - this.benchmarkStartTime) / 1000;
        const sustainedFps = elapsedSec > 0 ? this.totalFrames / elapsedSec : 0;
        const avgLatencyMs = this.totalFrames > 0 ? this.totalInferenceDurationMs / this.totalFrames : 0;
        return {
            sustainedFps: Math.round(sustainedFps * 10) / 10,
            avgLatencyMs: Math.round(avgLatencyMs * 10) / 10,
            pass: sustainedFps >= 15.0,
        };
    }
    reset() {
        this.timestamps = [];
        this.totalFrames = 0;
        this.benchmarkStartTime = null;
        this.totalInferenceDurationMs = 0;
    }
}
/**
 * Initializes PoseLandmarker with GPU delegate and graceful CPU fallback.
 */
export async function initializePoseLandmarker() {
    const vision = await FilesetResolver.forVisionTasks(WASM_CDN_PATH);
    try {
        const landmarker = await PoseLandmarker.createFromOptions(vision, {
            baseOptions: {
                modelAssetPath: MODEL_URL,
                delegate: 'GPU',
            },
            runningMode: 'VIDEO',
            numPoses: 1,
            minPoseDetectionConfidence: 0.5,
            minPosePresenceConfidence: 0.5,
            minTrackingConfidence: 0.5,
            outputSegmentationMasks: false,
        });
        return { landmarker, delegateUsed: 'GPU' };
    }
    catch (gpuError) {
        console.warn('[MEDIAPIPE] GPU delegate initialization failed; falling back to CPU:', gpuError);
        const landmarker = await PoseLandmarker.createFromOptions(vision, {
            baseOptions: {
                modelAssetPath: MODEL_URL,
                delegate: 'CPU',
            },
            runningMode: 'VIDEO',
            numPoses: 1,
            minPoseDetectionConfidence: 0.5,
            minPosePresenceConfidence: 0.5,
            minTrackingConfidence: 0.5,
            outputSegmentationMasks: false,
        });
        return { landmarker, delegateUsed: 'CPU' };
    }
}
/**
 * Calculates 3D knee flexion angle in degrees using vector dot product.
 */
export function calculateKneeFlexionAngle(hip, knee, ankle) {
    const v1 = { x: hip.x - knee.x, y: hip.y - knee.y, z: hip.z - knee.z };
    const v2 = { x: ankle.x - knee.x, y: ankle.y - knee.y, z: ankle.z - knee.z };
    const dot = v1.x * v2.x + v1.y * v2.y + v1.z * v2.z;
    const mag1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y + v1.z * v1.z);
    const mag2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y + v2.z * v2.z);
    if (mag1 === 0 || mag2 === 0)
        return 180;
    const cosAngle = Math.max(-1, Math.min(1, dot / (mag1 * mag2)));
    return (Math.acos(cosAngle) * 180) / Math.PI;
}
/**
 * Starts continuous frame inference tapping the DOM <video> element.
 * Camera contention defense: Uses requestVideoFrameCallback or rAF, reading
 * compositor textures without acquiring a secondary camera track.
 */
export function startVideoPosePipeline(video, landmarker, onPose) {
    let isRunning = true;
    let rVfcId = null;
    let rafId = null;
    let lastProcessedTime = -1;
    const onFrame = (_now, metadata) => {
        if (!isRunning)
            return;
        if ('requestVideoFrameCallback' in video) {
            rVfcId = video.requestVideoFrameCallback((n, m) => onFrame(n, m));
        }
        if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
            video.videoWidth > 0 &&
            video.videoHeight > 0) {
            const mediaTime = metadata ? metadata.mediaTime : video.currentTime;
            if (mediaTime !== lastProcessedTime) {
                lastProcessedTime = mediaTime;
                const start = performance.now();
                try {
                    const result = landmarker.detectForVideo(video, start);
                    const duration = performance.now() - start;
                    onPose(result, duration);
                }
                catch (inferenceErr) {
                    console.warn('[MEDIAPIPE] Inference frame error:', inferenceErr);
                }
            }
        }
    };
    if ('requestVideoFrameCallback' in video) {
        rVfcId = video.requestVideoFrameCallback((n, m) => onFrame(n, m));
    }
    else {
        const loop = () => {
            if (!isRunning)
                return;
            onFrame(performance.now());
            rafId = requestAnimationFrame(loop);
        };
        rafId = requestAnimationFrame(loop);
    }
    return () => {
        isRunning = false;
        if (rVfcId !== null &&
            'cancelVideoFrameCallback' in video &&
            typeof video.cancelVideoFrameCallback === 'function') {
            video.cancelVideoFrameCallback(rVfcId);
        }
        if (rafId !== null) {
            cancelAnimationFrame(rafId);
        }
    };
}
/**
 * Standard BlazePose skeletal connections.
 */
const POSE_CONNECTIONS = [
    // Torso
    [11, 12],
    [11, 23],
    [12, 24],
    [23, 24],
    // Left Arm
    [11, 13],
    [13, 15],
    // Right Arm
    [12, 14],
    [14, 16],
    // Left Leg
    [23, 25],
    [25, 27],
    [27, 29],
    [29, 31],
    [27, 31],
    // Right Leg
    [24, 26],
    [26, 28],
    [28, 30],
    [30, 32],
    [28, 32],
];
/**
 * Draws the 33-landmark skeleton overlay on the canvas.
 */
export function drawPoseSkeleton(ctx, landmarks, width, height) {
    ctx.clearRect(0, 0, width, height);
    // Draw connections
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#06b6d4'; // Cyan bones
    for (const [startIdx, endIdx] of POSE_CONNECTIONS) {
        const start = landmarks[startIdx];
        const end = landmarks[endIdx];
        if (start && end && (start.visibility ?? 1) > 0.4 && (end.visibility ?? 1) > 0.4) {
            ctx.beginPath();
            ctx.moveTo(start.x * width, start.y * height);
            ctx.lineTo(end.x * width, end.y * height);
            ctx.stroke();
        }
    }
    // Draw joints
    for (let i = 0; i < landmarks.length; i++) {
        const lm = landmarks[i];
        if (!lm || (lm.visibility ?? 1) < 0.4)
            continue;
        const x = lm.x * width;
        const y = lm.y * height;
        // Highlight key lower-body joints in emerald
        const isRehabKeypoint = [23, 24, 25, 26, 27, 28].includes(i);
        ctx.fillStyle = isRehabKeypoint ? '#10b981' : '#f43f5e';
        ctx.beginPath();
        ctx.arc(x, y, isRehabKeypoint ? 6 : 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.stroke();
    }
}
