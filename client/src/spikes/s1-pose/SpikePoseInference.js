import React, { useState, useRef, useEffect, useCallback } from 'react';
import { initializePoseLandmarker, startVideoPosePipeline, drawPoseSkeleton, calculateKneeFlexionAngle, FpsMeter, } from './poseRunner';
import { ProceduralHumanVideoGenerator } from './syntheticVideo';
import BenchmarkMetricCard from '../components/BenchmarkMetricCard';
import SpikeStatusChip from '../components/SpikeStatusChip';
export const SpikePoseInference = ({ onMetricsUpdate, onLog, onComplete, isAutoRun = false, }) => {
    const [sourceType, setSourceType] = useState('synthetic');
    const [status, setStatus] = useState('idle');
    const [delegate, setDelegate] = useState('GPU');
    const [instantFps, setInstantFps] = useState(0);
    const [sustainedFps, setSustainedFps] = useState(0);
    const [avgLatencyMs, setAvgLatencyMs] = useState(0);
    const [keypointCount, setKeypointCount] = useState(0);
    const [kneeAngle, setKneeAngle] = useState({
        L: null,
        R: null,
    });
    const [errorMessage, setErrorMessage] = useState(null);
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const landmarkerRef = useRef(null);
    const cleanupPipelineRef = useRef(null);
    const fpsMeterRef = useRef(new FpsMeter());
    const synthGenRef = useRef(null);
    const activeStreamRef = useRef(null);
    const autoRunTimerRef = useRef(null);
    const log = useCallback((level, message, details) => {
        onLog?.({ level, message, details });
    }, [onLog]);
    // Stop current stream & pipeline
    const stopStream = useCallback(() => {
        if (cleanupPipelineRef.current) {
            cleanupPipelineRef.current();
            cleanupPipelineRef.current = null;
        }
        if (synthGenRef.current) {
            synthGenRef.current.stop();
            synthGenRef.current = null;
        }
        if (activeStreamRef.current) {
            activeStreamRef.current.getTracks().forEach((track) => track.stop());
            activeStreamRef.current = null;
        }
        if (videoRef.current) {
            videoRef.current.srcObject = null;
        }
        if (autoRunTimerRef.current) {
            window.clearTimeout(autoRunTimerRef.current);
            autoRunTimerRef.current = null;
        }
    }, []);
    const startBenchmark = useCallback(async () => {
        stopStream();
        setErrorMessage(null);
        setStatus('running');
        fpsMeterRef.current.reset();
        setInstantFps(0);
        setSustainedFps(0);
        setKeypointCount(0);
        log('info', 'Initializing MediaPipe PoseLandmarker (WASM & model weights)...');
        try {
            // 1. Initialize landmarker if not already created
            if (!landmarkerRef.current) {
                const { landmarker, delegateUsed } = await initializePoseLandmarker();
                landmarkerRef.current = landmarker;
                setDelegate(delegateUsed);
                log('success', `PoseLandmarker initialized using ${delegateUsed} delegate`);
            }
            // 2. Setup video source (Webcam or Synthetic generator)
            let stream;
            if (sourceType === 'webcam') {
                log('info', 'Requesting user camera stream (640x480)...');
                stream = await navigator.mediaDevices.getUserMedia({
                    video: { width: 640, height: 480, frameRate: 30 },
                    audio: false,
                });
            }
            else {
                log('info', 'Starting Tier 3 Procedural Canvas Stream (30 FPS, squat cycle)...');
                const generator = new ProceduralHumanVideoGenerator(640, 480);
                synthGenRef.current = generator;
                stream = generator.start();
            }
            activeStreamRef.current = stream;
            const video = videoRef.current;
            if (!video)
                throw new Error('Video element not mounted in DOM');
            video.srcObject = stream;
            await video.play();
            log('info', 'Video active. Tapping frames via requestVideoFrameCallback...');
            // 3. Connect Video Pose Pipeline
            const landmarker = landmarkerRef.current;
            const meter = fpsMeterRef.current;
            let lastUiUpdate = performance.now();
            let maxDetectedKeypoints = 0;
            const cleanup = startVideoPosePipeline(video, landmarker, (result, latencyMs) => {
                meter.recordFrame(latencyMs);
                const canvas = canvasRef.current;
                if (canvas && result.landmarks && result.landmarks[0]) {
                    const lms = result.landmarks[0];
                    drawPoseSkeleton(canvas.getContext('2d'), lms, canvas.width, canvas.height);
                    if (lms.length > maxDetectedKeypoints) {
                        maxDetectedKeypoints = lms.length;
                    }
                    // Calculate 3D knee angle if worldLandmarks present
                    if (result.worldLandmarks && result.worldLandmarks[0]) {
                        const wlms = result.worldLandmarks[0];
                        const hipL = wlms[23];
                        const kneeL = wlms[25];
                        const ankleL = wlms[27];
                        const hipR = wlms[24];
                        const kneeR = wlms[26];
                        const ankleR = wlms[28];
                        if (hipL && kneeL && ankleL && hipR && kneeR && ankleR) {
                            const angleL = calculateKneeFlexionAngle(hipL, kneeL, ankleL);
                            const angleR = calculateKneeFlexionAngle(hipR, kneeR, ankleR);
                            setKneeAngle({ L: Math.round(angleL), R: Math.round(angleR) });
                        }
                    }
                }
                // Throttle UI state updates to 5 Hz
                const now = performance.now();
                if (now - lastUiUpdate > 200) {
                    lastUiUpdate = now;
                    const stats = meter.getSustainedStats();
                    setInstantFps(Math.round(meter.getInstantFps() * 10) / 10);
                    setSustainedFps(stats.sustainedFps);
                    setAvgLatencyMs(stats.avgLatencyMs);
                    setKeypointCount(maxDetectedKeypoints);
                    const currentMetrics = {
                        instantFps: Math.round(meter.getInstantFps() * 10) / 10,
                        sustainedFps: stats.sustainedFps,
                        avgLatencyMs: stats.avgLatencyMs,
                        totalFrames: meter.getTotalFrames(),
                        keypointsDetected: maxDetectedKeypoints,
                        delegateUsed: delegate,
                        videoSource: sourceType,
                        pass: stats.sustainedFps >= 15.0 && maxDetectedKeypoints === 33,
                    };
                    onMetricsUpdate?.(currentMetrics);
                }
            });
            cleanupPipelineRef.current = cleanup;
            // In auto-run or normal benchmark, sample for 6 seconds then conclude
            autoRunTimerRef.current = window.setTimeout(() => {
                const stats = meter.getSustainedStats();
                const finalMetrics = {
                    instantFps: Math.round(meter.getInstantFps() * 10) / 10,
                    sustainedFps: stats.sustainedFps,
                    avgLatencyMs: stats.avgLatencyMs,
                    totalFrames: meter.getTotalFrames(),
                    keypointsDetected: maxDetectedKeypoints,
                    delegateUsed: delegate,
                    videoSource: sourceType,
                    pass: stats.sustainedFps >= 15.0 && maxDetectedKeypoints === 33,
                };
                const pass = finalMetrics.pass;
                setStatus(pass ? 'pass' : 'fail');
                log(pass ? 'success' : 'warn', `S1 Benchmark Concluded: Sustained ${finalMetrics.sustainedFps} FPS (${finalMetrics.keypointsDetected} landmarks) -> ${pass ? 'PASS' : 'FAIL'}`);
                onMetricsUpdate?.(finalMetrics);
                onComplete?.(finalMetrics);
            }, 6000);
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            setErrorMessage(msg);
            setStatus('fail');
            log('error', `Pose Landmarker initialization failed: ${msg}`);
            stopStream();
        }
    }, [sourceType, delegate, log, onMetricsUpdate, onComplete, stopStream]);
    // Handle auto-run prop
    useEffect(() => {
        if (isAutoRun && status === 'idle') {
            startBenchmark();
        }
    }, [isAutoRun, status, startBenchmark]);
    // Teardown on unmount
    useEffect(() => {
        return () => {
            stopStream();
            if (landmarkerRef.current) {
                landmarkerRef.current.close();
                landmarkerRef.current = null;
            }
        };
    }, [stopStream]);
    return (<div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* S1 Header & Controls */}
      <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '1rem',
            backgroundColor: 'var(--bg-surface)',
            padding: '1rem 1.25rem',
            borderRadius: '0.75rem',
            border: '1px solid var(--border-subtle)',
        }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <h3 style={{ fontSize: '1.125rem', fontWeight: 600 }}>
              Spike S1 (D2.1): MediaPipe Pose Inference
            </h3>
            <SpikeStatusChip status={status}/>
          </div>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
            BlazePose 33-landmark inference on DOM video texture via requestVideoFrameCallback.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {/* Source selector */}
          <select className="kine-input" style={{ width: 'auto', padding: '0.5rem 0.75rem' }} value={sourceType} onChange={(e) => setSourceType(e.target.value)} disabled={status === 'running'}>
            <option value="synthetic">Tier 3: Procedural Canvas Stream (30 FPS)</option>
            <option value="webcam">Tier 1: Physical Webcam (getUserMedia)</option>
          </select>

          {status !== 'running' ? (<button type="button" className="kine-btn-run-all" onClick={startBenchmark}>
              ▶ Run S1 Benchmark (6s)
            </button>) : (<button type="button" className="kine-button kine-button-secondary" onClick={() => {
                stopStream();
                setStatus('idle');
                log('info', 'Benchmark stopped by user');
            }}>
              Stop Benchmark
            </button>)}
        </div>
      </div>

      {errorMessage && (<div style={{
                padding: '0.75rem 1rem',
                borderRadius: '0.5rem',
                backgroundColor: 'rgba(244, 63, 94, 0.1)',
                border: '1px solid var(--accent-rose)',
                color: 'var(--accent-rose)',
                fontSize: '0.875rem',
            }}>
          {errorMessage}
        </div>)}

      {/* Metrics Row */}
      <div className="kine-metric-grid">
        <BenchmarkMetricCard title="Sustained Inference" value={sustainedFps.toFixed(1)} unit="FPS" threshold="≥ 15.0 FPS" status={status === 'idle' ? 'idle' : sustainedFps >= 15 ? 'pass' : 'fail'} subtext={`Instantaneous: ${instantFps.toFixed(1)} FPS`}/>
        <BenchmarkMetricCard title="Inference Latency" value={avgLatencyMs.toFixed(1)} unit="ms" threshold="< 45.0 ms" status={status === 'idle' ? 'idle' : avgLatencyMs < 45 ? 'pass' : 'fail'}/>
        <BenchmarkMetricCard title="Keypoints Detected" value={`${keypointCount} / 33`} threshold="33 Full Skeleton" status={status === 'idle' ? 'idle' : keypointCount === 33 ? 'pass' : 'fail'}/>
        <BenchmarkMetricCard title="Knee Flexion Angle" value={kneeAngle.L !== null ? `${kneeAngle.L}° L / ${kneeAngle.R}° R` : '--'} threshold="3D Dot Product" status="idle" subtext={`Delegate: ${delegate} | ${sourceType}`}/>
      </div>

      {/* Video & Skeleton Overlay Canvas */}
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <div className="kine-video-canvas-container">
          <video ref={videoRef} className="kine-video-element" muted playsInline autoPlay/>
          <canvas ref={canvasRef} className="kine-canvas-overlay" width={640} height={480}/>
        </div>
      </div>
    </div>);
};
export default SpikePoseInference;
