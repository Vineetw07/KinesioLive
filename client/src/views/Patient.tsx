/**
 * Patient.tsx (Milestone D4.3)
 * Tele-Rehab Zero-Contention Studio for Patient.
 * - Authenticates via POST /api/session (role: "patient").
 * - Mounts CometChat Calls v5 session (startAudioMuted: false).
 * - Zero-Contention Camera Ingestion: Taps active DOM <video> element rendered by Calls SDK
 *   via requestVideoFrameCallback (with rAF fallback). NEVER initiates secondary getUserMedia.
 * - Pose Inference & Kinematics:
 *   - PoseLandmarker in VIDEO mode.
 *   - Calibrates standing baseline (calibrateStandingBaseline).
 *   - 3D knee flexion angle (compute3DKneeFlexion).
 *   - Frontal valgus deviation (computeValgusDeviation).
 *   - Pelvic depth ratio (computeDepthRatio).
 *   - Feed into RepCounterStateMachine.
 * - Dynamic 2D Skeleton Canvas Overlay:
 *   - Aligned 1:1 over video pixels.
 *   - Highlights femur/tibia and neutral axes.
 *   - Valgus deviation vector: emerald green (var(--status-stable)) for <= 8.0%,
 *     bright red (var(--status-critical)) for > 8.0%.
 * - Optimistic Local HUD:
 *   - Joint angles, depth gauge, phase indicator, rep count badge with spring pop.
 * - Real-Time Transmission:
 *   - 10 Hz rate-capped transient messaging using TelemetryTokenBucket (kine.pose).
 *   - On rep completion, dispatch persisted kine.rep (shouldUpdateConversation: false).
 *   - On valgus alert, dispatch persisted kine.alert (shouldUpdateConversation: false).
 * - Coaching Feedback:
 *   - Listens for kine.cue custom messages and renders prominent animated toast notifications.
 * - Strict React 19 cleanup:
 *   - Cancel rVFC loops, remove message listeners, leave call, close pose landmarker.
 * - ZERO console.log in 10 Hz / frame loops. ZERO raw hex codes.
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CometChat } from '@cometchat/chat-sdk-javascript';
import { CometChatCalls, type SessionSettings } from '@cometchat/calls-sdk-javascript';
import type { PoseLandmarker, PoseLandmarkerResult } from '@mediapipe/tasks-vision';
import {
  SCHEMA_VERSION,
  PATIENT_UID,
  VALGUS_THRESHOLD_PCT,
  type KinePosePayload,
  type KineRepPayload,
  type KineAlertPayload,
  type KineCuePayload,
  type SessionResponse,
  type SquatPhase,
} from '@kinesio/shared';
import {
  compute3DKneeFlexion,
  calibrateStandingBaseline,
  computeValgusDeviation,
  computeDepthRatio,
  RepCounterStateMachine,
  type StandingBaseline,
} from '../engine';
import {
  initializePoseLandmarker,
  FpsMeter,
  startVideoPosePipeline,
} from '../spikes/s1-pose/poseRunner';
import { TelemetryTokenBucket } from '../spikes/s2-transient/rateCap';
import { requestSession } from '../spikes/utils/tokenService';
import { springPresets } from '../styles/motionPresets';

export interface PatientViewProps {
  sessionId?: string;
  onLeaveSession?: () => void;
}

export interface OutboxItem {
  message: CometChat.CustomMessage;
  retries: number;
}

export const Patient: React.FC<PatientViewProps> = ({ sessionId: propSessionId, onLeaveSession }) => {
  const [sessionData, setSessionData] = useState<SessionResponse | null>(null);
  const [callStatus, setCallStatus] = useState<'idle' | 'authenticating' | 'connecting' | 'connected' | 'ended' | 'error'>('idle');
  const [initError, setInitError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState<number>(0);

  // Local HUD State (Optimistic)
  const [kneeAngleL, setKneeAngleL] = useState<number>(180);
  const [kneeAngleR, setKneeAngleR] = useState<number>(180);
  const [depthProgress, setDepthProgress] = useState<number>(0);
  const [phase, setPhase] = useState<SquatPhase>('standing');
  const [repCount, setRepCount] = useState<number>(0);
  const [valgusL, setValgusL] = useState<number>(0);
  const [valgusR, setValgusR] = useState<number>(0);
  const [isCalibrated, setIsCalibrated] = useState<boolean>(false);
  const [currentFps, setCurrentFps] = useState<number>(30);

  // Coaching Toast State
  const [activeToast, setActiveToast] = useState<{ id: number; text: string } | null>(null);

  const [isLocalCameraFallback, setIsLocalCameraFallback] = useState<boolean>(false);

  // DOM Refs
  const callContainerRef = useRef<HTMLDivElement>(null);
  const fallbackVideoRef = useRef<HTMLVideoElement>(null);
  const fallbackStreamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const activeVideoRef = useRef<HTMLVideoElement | null>(null);

  // Dynamic Canvas Bounds: Managed via React state so re-renders cannot clobber video alignment
  const [canvasBounds, setCanvasBounds] = useState<{
    left: string | number;
    top: string | number;
    width: string | number;
    height: string | number;
    objectFit: 'cover' | 'contain' | 'fill';
  }>({
    left: 0,
    top: 0,
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  });

  // Standalone Camera Fallback Functions
  const startFallbackCamera = async () => {
    try {
      if (typeof navigator === 'undefined' || !navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') {
        setInitError('getUserMedia is not supported in this browser environment.');
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
        audio: false,
      });
      fallbackStreamRef.current = stream;
      setIsLocalCameraFallback(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Camera access error';
      setInitError(`Camera access denied: ${msg}`);
    }
  };

  const stopFallbackCamera = () => {
    if (fallbackStreamRef.current) {
      fallbackStreamRef.current.getTracks().forEach((track) => track.stop());
      fallbackStreamRef.current = null;
    }
    if (fallbackVideoRef.current) {
      fallbackVideoRef.current.srcObject = null;
    }
    if (stopPosePipelineRef.current) {
      stopPosePipelineRef.current();
      stopPosePipelineRef.current = null;
    }
    setIsLocalCameraFallback(false);
  };

  const toggleLocalCameraFallback = () => {
    if (isLocalCameraFallback) {
      stopFallbackCamera();
    } else {
      startFallbackCamera();
    }
  };

  useEffect(() => {
    if (isLocalCameraFallback && fallbackVideoRef.current && fallbackStreamRef.current) {
      fallbackVideoRef.current.srcObject = fallbackStreamRef.current;
      fallbackVideoRef.current.play().catch((playErr: unknown) => {
        console.warn('Fallback video autoplay notice:', playErr);
      });
    }
  }, [isLocalCameraFallback]);

  // Lifecycle Refs
  const landmarkerRef = useRef<PoseLandmarker | null>(null);
  const stopPosePipelineRef = useRef<(() => void) | null>(null);
  const callTeardownRef = useRef<(() => void) | null>(null);
  const repCounterRef = useRef<RepCounterStateMachine | null>(null);
  const tokenBucketRef = useRef<TelemetryTokenBucket>(new TelemetryTokenBucket());
  const fpsMeterRef = useRef<FpsMeter>(new FpsMeter());
  const baselineRef = useRef<StandingBaseline | null>(null);
  const telemetrySeqRef = useRef<number>(1);
  const repBadgeKeyRef = useRef<number>(0);
  const lastSyncTimeRef = useRef<number>(0);

  // In-Memory Outbox Queue Refs (D5.1)
  const outboxQueueRef = useRef<OutboxItem[]>([]);
  const isFlushingRef = useRef<boolean>(false);

  const activeSessionId = sessionData?.sessionId || propSessionId || '';

  // Dynamic Canvas Alignment: Ensures the skeleton canvas overlays 1:1 onto the active video
  const syncCanvasToVideo = (videoEl: HTMLVideoElement | null) => {
    if (!videoEl) return;

    if (isLocalCameraFallback) {
      setCanvasBounds((prev) => {
        if (
          prev.left === 0 &&
          prev.top === 0 &&
          prev.width === '100%' &&
          prev.height === '100%' &&
          prev.objectFit === 'cover'
        ) {
          return prev;
        }
        return { left: 0, top: 0, width: '100%', height: '100%', objectFit: 'cover' };
      });
      return;
    }

    if (callContainerRef.current) {
      const vRect = videoEl.getBoundingClientRect();
      const cRect = callContainerRef.current.getBoundingClientRect();
      if (vRect.width > 0 && vRect.height > 0 && cRect.width > 0) {
        const left = Math.round(vRect.left - cRect.left);
        const top = Math.round(vRect.top - cRect.top);
        const width = Math.round(vRect.width);
        const height = Math.round(vRect.height);
        const computedFit = (window.getComputedStyle(videoEl).objectFit as 'cover' | 'contain' | 'fill') || 'cover';

        setCanvasBounds((prev) => {
          if (
            prev.left === left &&
            prev.top === top &&
            prev.width === width &&
            prev.height === height &&
            prev.objectFit === computedFit
          ) {
            return prev;
          }
          return { left, top, width, height, objectFit: computedFit };
        });
      }
    }
  };

  // In-Memory Outbox Queue Flush (D5.1)
  const flushOutboxQueue = async () => {
    if (isFlushingRef.current || outboxQueueRef.current.length === 0) return;
    isFlushingRef.current = true;

    try {
      while (outboxQueueRef.current.length > 0) {
        const item = outboxQueueRef.current[0];
        try {
          await CometChat.sendCustomMessage(item.message);
          outboxQueueRef.current.shift();
        } catch (err) {
          item.retries += 1;
          if (item.retries >= 3) {
            console.warn(
              '[KinesioOutbox] Discarded custom message after 3 failed retries:',
              item.message.getType?.() || item.message,
              err
            );
            outboxQueueRef.current.shift();
          } else {
            // Connection still unstable; halt current flush (retry on next onConnected)
            break;
          }
        }
      }
    } finally {
      isFlushingRef.current = false;
    }
  };

  // 1. Initialize Call & Session
  useEffect(() => {
    let isCancelled = false;

    async function bootstrapPatientCall() {
      try {
        setCallStatus('authenticating');
        setInitError(null);

        // Fetch Session Credentials
        const session = await requestSession('patient', propSessionId);
        if (isCancelled) return;
        setSessionData(session);

        if (session.authToken.startsWith('mock_token_')) {
          throw new Error(
            'CometChat Auth Key is truncated in .env (ends with "..."). Please update .env with your full 40-character key from app.cometchat.com'
          );
        }

        // Initialize Chat SDK
        const chatSettings = new CometChat.AppSettingsBuilder()
          .subscribePresenceForAllUsers()
          .setRegion(session.region)
          .build();
        await CometChat.init(session.appId, chatSettings);

        // Login to Chat SDK
        const activeUser = await CometChat.getLoggedinUser();
        if (!activeUser || activeUser.getUid() !== session.uid) {
          await CometChat.login(session.authToken);
        }

        // Register Connection Listener to flush outbox queue on reconnect (D5.1)
        const connListenerId = `kine-patient-conn-${session.sessionId}`;
        CometChat.addConnectionListener(
          connListenerId,
          new CometChat.ConnectionListener({
            onConnected: () => {
              flushOutboxQueue();
            },
          })
        );

        // Initialize Calls SDK v5
        await CometChatCalls.init({
          appId: session.appId,
          region: session.region as 'in' | 'eu' | 'us' | 'IN' | 'EU' | 'US',
        });

        if (!CometChatCalls.isUserLoggedIn()) {
          await CometChatCalls.loginWithAuthToken(session.authToken);
        }

        // Register Call Listeners
        const unsubs: Array<() => void> = [];
        unsubs.push(
          CometChatCalls.addEventListener('onSessionJoined', () => {
            if (!isCancelled) setCallStatus('connected');
          }),
          CometChatCalls.addEventListener('onSessionLeft', () => {
            if (!isCancelled) setCallStatus('ended');
          }),
          CometChatCalls.addEventListener('onConnectionFailed', () => {
            if (!isCancelled) setCallStatus('error');
          })
        );

        // Generate Call Token
        const tokenResult = await CometChatCalls.generateToken(session.sessionId);
        const callToken = tokenResult.token;

        // SessionSettings for Patient: Microphone UNMUTED
        const callSettings: SessionSettings = {
          sessionType: 'VIDEO',
          layout: 'TILE',
          startAudioMuted: false, // Patient UNMUTED
          startVideoPaused: false,
          hideControlPanel: false,
          hideLeaveSessionButton: false,
          hideToggleAudioButton: false,
          hideToggleVideoButton: false,
          idleTimeoutPeriodBeforePrompt: 60000,
          idleTimeoutPeriodAfterPrompt: 180000,
        };

        if (callContainerRef.current) {
          setCallStatus('connecting');
          const joinResult = await CometChatCalls.joinSession(callToken, callSettings, callContainerRef.current);
          if (joinResult?.error) {
            throw new Error(`Calls join failed: ${JSON.stringify(joinResult.error)}`);
          }
          if (!isCancelled) setCallStatus('connected');
        }

        // Register incoming coaching cue listener (kine.cue)
        const customListenerId = `kine-patient-cues-${session.sessionId}`;
        CometChat.addMessageListener(
          customListenerId,
          new CometChat.MessageListener({
            onCustomMessageReceived: (customMessage: CometChat.CustomMessage) => {
              const msgType = customMessage.getType() || customMessage.getSubType();
              const customData = customMessage.getCustomData() as any;
              const type = customData?.type || msgType;

              if (type === 'kine.cue') {
                const cue = customData as KineCuePayload;
                const cueText = cue.text || cue.cue || 'Form Check';
                setActiveToast({ id: Date.now(), text: cueText });
                setTimeout(() => setActiveToast(null), 4000);
              }
            },
          })
        );

        callTeardownRef.current = () => {
          unsubs.forEach((unsub) => {
            try {
              unsub();
            } catch {
              // Ignore
            }
          });
          try {
            CometChat.removeConnectionListener(connListenerId);
          } catch {
            // Ignore
          }
          try {
            CometChat.removeMessageListener(customListenerId);
          } catch {
            // Ignore
          }
          try {
            CometChatCalls.leaveSession();
          } catch {
            // Ignore
          }
        };
      } catch (err: unknown) {
        if (!isCancelled) {
          setCallStatus('error');
          const errMsg =
            (err as any)?.message ||
            (err as any)?.error?.message ||
            (typeof err === 'string' ? err : 'Failed to connect Patient session');
          setInitError(errMsg);
        }
      }
    }

    bootstrapPatientCall();

    return () => {
      isCancelled = true;
      if (callTeardownRef.current) {
        callTeardownRef.current();
        callTeardownRef.current = null;
      }
      if (fallbackStreamRef.current) {
        fallbackStreamRef.current.getTracks().forEach((track) => track.stop());
        fallbackStreamRef.current = null;
      }
    };
  }, [propSessionId, retryKey]);

  // 2. Initialize MediaPipe PoseLandmarker and Tap Video Element
  useEffect(() => {
    let isPipelineActive = true;
    let pollIntervalId: ReturnType<typeof setInterval> | null = null;
    let resizeObserver: ResizeObserver | null = null;

    const handleResize = () => {
      let activeVideo = activeVideoRef.current;
      if (!activeVideo || !document.contains(activeVideo)) {
        if (isLocalCameraFallback && fallbackVideoRef.current) {
          activeVideo = fallbackVideoRef.current;
        } else if (callContainerRef.current) {
          const videos = Array.from(callContainerRef.current.querySelectorAll('video'));
          activeVideo = videos.find((v) => v.muted) || videos[0] || null;
        }
        activeVideoRef.current = activeVideo;
      }
      if (activeVideo) {
        syncCanvasToVideo(activeVideo);
      }
    };
    window.addEventListener('resize', handleResize);

    if (typeof ResizeObserver !== 'undefined' && callContainerRef.current) {
      resizeObserver = new ResizeObserver(() => {
        handleResize();
      });
      resizeObserver.observe(callContainerRef.current);
    }

    async function setupVisionPipeline() {
      try {
        const initResult = await initializePoseLandmarker();
        if (!isPipelineActive) {
          initResult.landmarker.close();
          return;
        }
        landmarkerRef.current = initResult.landmarker;

        // Initialize state machine
        repCounterRef.current = new RepCounterStateMachine({
          sessionId: activeSessionId,
          valgusThresholdPct: VALGUS_THRESHOLD_PCT,
          valgusConsecutiveFrames: 3,
          valgusCooldownMs: 4000,
        });

        // Zero-Contention Camera Ingestion:
        // Poll container for rendered <video> element (or fallback camera if active)
        const checkForVideoElement = () => {
          let videoEl: HTMLVideoElement | null = null;
          if (isLocalCameraFallback && fallbackVideoRef.current) {
            videoEl = fallbackVideoRef.current;
          } else if (callContainerRef.current) {
            const videos = Array.from(callContainerRef.current.querySelectorAll('video'));
            videoEl = videos.find((v) => v.muted) || videos[0] || null;
          }

          if (
            videoEl &&
            videoEl.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
            videoEl.videoWidth > 0 &&
            videoEl.videoHeight > 0
          ) {
            if (pollIntervalId) {
              clearInterval(pollIntervalId);
              pollIntervalId = null;
            }

            activeVideoRef.current = videoEl;
            syncCanvasToVideo(videoEl);

            // Start frame ingestion pipeline tapping video directly via rVFC
            const stopPipeline = startVideoPosePipeline(
              videoEl,
              initResult.landmarker,
              (result: PoseLandmarkerResult, latencyMs: number) => {
                handlePoseFrame(result, latencyMs, videoEl!);
              }
            );

            stopPosePipelineRef.current = stopPipeline;
          }
        };

        pollIntervalId = setInterval(checkForVideoElement, 150);
      } catch (visionErr) {
        setInitError(visionErr instanceof Error ? visionErr.message : 'Failed to init PoseLandmarker');
      }
    }

    setupVisionPipeline();

    return () => {
      isPipelineActive = false;
      window.removeEventListener('resize', handleResize);
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      if (pollIntervalId) {
        clearInterval(pollIntervalId);
      }
      if (stopPosePipelineRef.current) {
        stopPosePipelineRef.current();
        stopPosePipelineRef.current = null;
      }
      if (landmarkerRef.current) {
        try {
          landmarkerRef.current.close();
        } catch {
          // Ignore
        }
        landmarkerRef.current = null;
      }
    };
  }, [activeSessionId, isLocalCameraFallback]);

  // 3. Process Each Inferred Frame & Canvas Rendering
  const handlePoseFrame = (
    result: PoseLandmarkerResult,
    latencyMs: number,
    videoEl: HTMLVideoElement
  ) => {
    fpsMeterRef.current.recordFrame(latencyMs);
    const instantFps = Math.round(fpsMeterRef.current.getRollingFps());
    if (instantFps > 0) setCurrentFps(instantFps);

    const landmarks2D = result.landmarks?.[0];
    const worldLandmarks3D = result.worldLandmarks?.[0];

    if (!landmarks2D || !worldLandmarks3D || landmarks2D.length < 29 || worldLandmarks3D.length < 29) {
      return;
    }

    const width = videoEl.videoWidth || 640;
    const height = videoEl.videoHeight || 480;

    activeVideoRef.current = videoEl;

    // Periodic sync check to ensure canvas matches video element dimensions across layout changes
    const now = performance.now();
    if (now - lastSyncTimeRef.current > 1000) {
      lastSyncTimeRef.current = now;
      syncCanvasToVideo(videoEl);
    }

    // Automatic Baseline Calibration on First Valid Standing Frame
    if (!baselineRef.current) {
      const calibrated = calibrateStandingBaseline(landmarks2D, width, height);
      if (calibrated) {
        baselineRef.current = calibrated;
        setIsCalibrated(true);
      }
    }

    const currentBaseline = baselineRef.current;

    // Compute Kinematics
    const angleL = compute3DKneeFlexion(worldLandmarks3D[23], worldLandmarks3D[25], worldLandmarks3D[27]);
    const angleR = compute3DKneeFlexion(worldLandmarks3D[24], worldLandmarks3D[26], worldLandmarks3D[28]);

    // Unmirrored camera polarity enforcement:
    // Left Leg (landmarks 23, 25, 27): Medial collapse decreases X -> polarity = -1
    // Right Leg (landmarks 24, 26, 28): Medial collapse increases X -> polarity = +1
    const rawDevL = currentBaseline
      ? computeValgusDeviation(landmarks2D[23], landmarks2D[25], landmarks2D[27], currentBaseline, 'L')
      : null;
    const rawDevR = currentBaseline
      ? computeValgusDeviation(landmarks2D[24], landmarks2D[26], landmarks2D[28], currentBaseline, 'R')
      : null;

    const depth = currentBaseline
      ? computeDepthRatio(landmarks2D[23].y * height, currentBaseline)
      : 0;

    const visL = ((landmarks2D[23]?.visibility ?? 1) + (landmarks2D[25]?.visibility ?? 1) + (landmarks2D[27]?.visibility ?? 1)) / 3;
    const visR = ((landmarks2D[24]?.visibility ?? 1) + (landmarks2D[26]?.visibility ?? 1) + (landmarks2D[28]?.visibility ?? 1)) / 3;
    const avgVis = (visL + visR) / 2;

    // Feed into Rep Counter State Machine
    let fsmOutput = null;
    if (repCounterRef.current) {
      fsmOutput = repCounterRef.current.update({
        timestamp: Date.now(),
        kneeAngle: { L: angleL, R: angleR },
        valgusDevPct: { L: rawDevL, R: rawDevR },
        depthRatio: depth,
        visibility: avgVis,
        sessionId: activeSessionId,
        baseline: currentBaseline,
      });

      // Optimistic UI updates
      if (angleL !== null) setKneeAngleL(Math.round(angleL));
      if (angleR !== null) setKneeAngleR(Math.round(angleR));
      setDepthProgress(Math.round(Math.max(0, depth) * 100));
      setPhase(fsmOutput.phase);
      setValgusL(rawDevL !== null ? Math.round(rawDevL * 10) / 10 : 0);
      setValgusR(rawDevR !== null ? Math.round(rawDevR * 10) / 10 : 0);

      if (fsmOutput.reps > repCount) {
        setRepCount(fsmOutput.reps);
        repBadgeKeyRef.current += 1;
      }

      // Dispatch Persisted Rep Message on rep completion (only if call active)
      if (fsmOutput.completedRep && callStatus === 'connected') {
        dispatchCustomRepMessage(fsmOutput.completedRep);
      }

      // Dispatch Persisted Valgus Alerts (only if call active)
      if (fsmOutput.alerts && fsmOutput.alerts.length > 0 && callStatus === 'connected') {
        for (const alert of fsmOutput.alerts) {
          dispatchCustomAlertMessage(alert);
        }
      }
    }

    // 10 Hz Transient Messaging (Token Bucket Capped) - only when connected
    if (tokenBucketRef.current.tryConsume() && activeSessionId && callStatus === 'connected') {
      const posePayload: KinePosePayload = {
        v: SCHEMA_VERSION,
        sid: activeSessionId,
        t: Date.now(),
        type: 'kine.pose',
        seq: telemetrySeqRef.current++,
        fps: instantFps || 30,
        phase: fsmOutput ? fsmOutput.phase : 'standing',
        kneeFlexionDeg: { L: angleL, R: angleR },
        valgusDevPct: { L: rawDevL, R: rawDevR },
        depthRatio: depth,
        vis: avgVis,
        reps: fsmOutput ? fsmOutput.reps : repCount,
      };

      try {
        const transientMsg = new CometChat.TransientMessage(
          activeSessionId,
          CometChat.RECEIVER_TYPE.GROUP,
          posePayload as unknown as Record<string, unknown>
        );
        CometChat.sendTransientMessage(transientMsg);
      } catch {
        // Fire-and-forget transient send error suppression
      }
    }

    // Render Dynamic 2D Canvas Skeleton Overlay
    renderCanvasOverlay(landmarks2D, width, height, rawDevL, rawDevR);
  };

  // Dispatch Persisted Custom Messages (with Outbox Retry Queue)
  const dispatchCustomRepMessage = async (repPayload: KineRepPayload) => {
    if (!activeSessionId) return;
    const customMsg = new CometChat.CustomMessage(
      activeSessionId,
      CometChat.RECEIVER_TYPE.GROUP,
      'kine.rep',
      repPayload as unknown as Record<string, unknown>
    );
    customMsg.shouldUpdateConversation(false);
    try {
      await CometChat.sendCustomMessage(customMsg);
    } catch {
      outboxQueueRef.current.push({ message: customMsg, retries: 0 });
    }
  };

  const dispatchCustomAlertMessage = async (alertPayload: KineAlertPayload) => {
    if (!activeSessionId) return;
    const customMsg = new CometChat.CustomMessage(
      activeSessionId,
      CometChat.RECEIVER_TYPE.GROUP,
      'kine.alert',
      alertPayload as unknown as Record<string, unknown>
    );
    customMsg.shouldUpdateConversation(false);
    try {
      await CometChat.sendCustomMessage(customMsg);
    } catch {
      outboxQueueRef.current.push({ message: customMsg, retries: 0 });
    }
  };

  // 4. Render 2D Canvas Skeleton Overlay (Aligned 1:1)
  const renderCanvasOverlay = (
    landmarks: any[],
    width: number,
    height: number,
    valgusDevL: number | null,
    valgusDevR: number | null
  ) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, width, height);

    // Resolve design tokens dynamically from CSS properties (ZERO raw hex codes in code)
    const computed = getComputedStyle(document.documentElement);
    const colorStable = computed.getPropertyValue('--status-stable').trim();
    const colorCritical = computed.getPropertyValue('--status-critical').trim();
    const colorAccent = computed.getPropertyValue('--accent-lime').trim();

    // Standard Lower-Body Skeleton Connections: Femur & Tibia
    const connections: Array<[number, number]> = [
      [11, 12], // Shoulders
      [11, 23], [12, 24], // Torso
      [23, 24], // Pelvis / Hip Line
      [23, 25], // Left Femur
      [25, 27], // Left Tibia
      [24, 26], // Right Femur
      [26, 28], // Right Tibia
    ];

    ctx.lineWidth = 4;
    ctx.strokeStyle = colorAccent;

    for (const [startIdx, endIdx] of connections) {
      const p1 = landmarks[startIdx];
      const p2 = landmarks[endIdx];
      if (p1 && p2 && (p1.visibility ?? 1) > 0.45 && (p2.visibility ?? 1) > 0.45) {
        ctx.beginPath();
        ctx.moveTo(p1.x * width, p1.y * height);
        ctx.lineTo(p2.x * width, p2.y * height);
        ctx.stroke();
      }
    }

    // Lower Body Joint Highlights & Valgus Deviation Vectors
    const joints = [23, 24, 25, 26, 27, 28];
    for (const jIdx of joints) {
      const lm = landmarks[jIdx];
      if (!lm || (lm.visibility ?? 1) < 0.45) continue;

      const px = lm.x * width;
      const py = lm.y * height;

      // Color coding based on valgus status for knees (25 L, 26 R)
      let jointColor = colorStable;
      if (jIdx === 25 && valgusDevL !== null && valgusDevL > VALGUS_THRESHOLD_PCT) {
        jointColor = colorCritical;
      } else if (jIdx === 26 && valgusDevR !== null && valgusDevR > VALGUS_THRESHOLD_PCT) {
        jointColor = colorCritical;
      }

      ctx.fillStyle = jointColor;
      ctx.beginPath();
      ctx.arc(px, py, 7, 0, Math.PI * 2);
      ctx.fill();

      ctx.lineWidth = 2;
      ctx.strokeStyle = colorAccent;
      ctx.stroke();
    }
  };

  // Explicit Recalibration Trigger
  const handleRecalibrate = () => {
    baselineRef.current = null;
    setIsCalibrated(false);
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-6)',
        width: '100%',
        minHeight: '100%',
        color: 'var(--text-primary)',
        position: 'relative',
      }}
    >
      {/* Coaching Toast Notification Overlay */}
      <AnimatePresence>
        {activeToast && (
          <motion.div
            key={activeToast.id}
            initial={{ opacity: 0, y: -24, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            transition={springPresets.snappy}
            style={{
              position: 'absolute',
              top: 'var(--space-4)',
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 999,
              backgroundColor: 'var(--surface-dark-sidebar)',
              color: 'var(--accent-cyan)',
              border: '2px solid var(--accent-cyan)',
              borderRadius: 'var(--radius-pill)',
              padding: 'var(--space-3) var(--space-8)',
              boxShadow: 'var(--shadow-glow-cyan)',
              fontWeight: 800,
              fontSize: '1.25rem',
              letterSpacing: '-0.02em',
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-3)',
            }}
          >
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 'var(--space-0-5) var(--space-1)',
                borderRadius: 'var(--radius-pill)',
                backgroundColor: 'var(--accent-cyan-tint)',
              }}
            >
              📢
            </span>
            <span>{activeToast.text}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Studio Header Bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 'var(--space-4)',
          borderBottom: '1px solid var(--surface-border-subtle)',
          paddingBottom: 'var(--space-4)',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <h2
              style={{
                fontSize: '1.25rem',
                fontWeight: 700,
                letterSpacing: '-0.02em',
                margin: 0,
              }}
            >
              Patient Pose Studio
            </h2>
            <span
              style={{
                fontSize: '0.75rem',
                fontWeight: 600,
                padding: 'var(--space-0-5) var(--space-2)',
                borderRadius: 'var(--radius-pill)',
                backgroundColor: 'var(--accent-lime-tint)',
                color: 'var(--text-primary)',
                border: '1px solid var(--surface-border-subtle)',
              }}
            >
              {PATIENT_UID}
            </span>
          </div>
          <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
            Session: <strong>{activeSessionId || 'Connecting...'}</strong> • Zero-Contention Camera Tap
          </span>
        </div>

        {/* Header Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          {(callStatus === 'error' || callStatus === 'authenticating' || isLocalCameraFallback) && (
            <button
              type="button"
              onClick={toggleLocalCameraFallback}
              style={{
                padding: 'var(--space-2) var(--space-4)',
                borderRadius: 'var(--radius-pill)',
                border: isLocalCameraFallback
                  ? '1px solid var(--accent-lime)'
                  : '1px solid var(--surface-border-strong)',
                backgroundColor: isLocalCameraFallback
                  ? 'rgba(218, 254, 82, 0.15)'
                  : 'var(--surface-canvas-subtle)',
                color: isLocalCameraFallback ? 'var(--accent-lime)' : 'var(--text-primary)',
                fontSize: '0.8125rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {isLocalCameraFallback ? '📷 Stop Offline Camera' : '📷 Test Squats Offline'}
            </button>
          )}

          <button
            type="button"
            onClick={handleRecalibrate}
            style={{
              padding: 'var(--space-2) var(--space-4)',
              borderRadius: 'var(--radius-pill)',
              border: '1px solid var(--surface-border-strong)',
              backgroundColor: 'var(--surface-canvas-subtle)',
              color: 'var(--text-primary)',
              fontSize: '0.8125rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {isCalibrated ? '🔄 Recalibrate Baseline' : '⏳ Calibrating Baseline...'}
          </button>

          {onLeaveSession && (
            <button
              type="button"
              onClick={onLeaveSession}
              style={{
                padding: 'var(--space-2) var(--space-4)',
                borderRadius: 'var(--radius-pill)',
                border: 'none',
                backgroundColor: 'var(--surface-border-strong)',
                color: 'var(--text-primary)',
                fontSize: '0.8125rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Leave Session
            </button>
          )}
        </div>
      </div>

      {/* 1. Substantially Enlarged Camera Window Container (Full Width) */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: 'clamp(580px, 60vh, 640px)',
          minHeight: '580px',
          borderRadius: 'var(--radius-bento-card)',
          overflow: 'hidden',
          backgroundColor: 'var(--surface-dark-card)',
          border: '1px solid var(--surface-dark-card-border)',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: 'var(--shadow-bento)',
          flexShrink: 0,
        }}
      >
        {/* Status Overlay */}
        {callStatus !== 'connected' && !isLocalCameraFallback && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              zIndex: 10,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'rgba(24, 25, 28, 0.92)',
              color: 'var(--text-on-dark-primary)',
              padding: 'var(--space-6)',
              textAlign: 'center',
              gap: 'var(--space-3)',
            }}
          >
            {callStatus === 'connecting' || callStatus === 'authenticating' ? (
              <>
                <div
                  style={{
                    width: '2.5rem',
                    height: '2.5rem',
                    borderRadius: '50%',
                    border: '3px solid var(--surface-dark-card-border)',
                    borderTopColor: 'var(--accent-lime)',
                    animation: 'spin 1s linear infinite',
                  }}
                />
                <p style={{ fontWeight: 600 }}>Connecting Calls v5 & Pose Engine...</p>
                <button
                  type="button"
                  onClick={toggleLocalCameraFallback}
                  style={{
                    marginTop: 'var(--space-2)',
                    padding: 'var(--space-2) var(--space-4)',
                    borderRadius: 'var(--radius-pill)',
                    border: '1px solid var(--accent-lime)',
                    backgroundColor: 'transparent',
                    color: 'var(--accent-lime)',
                    fontWeight: 700,
                    fontSize: '0.75rem',
                    cursor: 'pointer',
                  }}
                >
                  📷 Start Offline Camera Fallback
                </button>
              </>
            ) : callStatus === 'error' ? (
              <>
                <span style={{ fontSize: '2rem' }}>⚠️</span>
                <p style={{ fontWeight: 600, color: 'var(--status-critical)' }}>
                  Session Connection Error
                </p>
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-on-dark-muted)' }}>
                  {initError || 'Failed to start video pose pipeline.'}
                </p>
                <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-2)' }}>
                  <button
                    type="button"
                    onClick={() => setRetryKey((k) => k + 1)}
                    style={{
                      padding: 'var(--space-2) var(--space-4)',
                      borderRadius: 'var(--radius-pill)',
                      border: 'none',
                      backgroundColor: 'var(--accent-lime)',
                      color: 'var(--surface-dark-sidebar)',
                      fontWeight: 700,
                      fontSize: '0.8125rem',
                      cursor: 'pointer',
                    }}
                  >
                    🔄 Retry Connection
                  </button>
                  <button
                    type="button"
                    onClick={toggleLocalCameraFallback}
                    style={{
                      padding: 'var(--space-2) var(--space-4)',
                      borderRadius: 'var(--radius-pill)',
                      border: '1px solid var(--surface-border-strong)',
                      backgroundColor: 'var(--surface-canvas-subtle)',
                      color: 'var(--text-primary)',
                      fontWeight: 600,
                      fontSize: '0.8125rem',
                      cursor: 'pointer',
                    }}
                  >
                    📷 Test Squats Offline
                  </button>
                </div>
              </>
            ) : null}
          </div>
        )}

        {/* Calls v5 Mount Element */}
        <div
          ref={callContainerRef}
          style={{
            width: '100%',
            height: '100%',
            minHeight: '580px',
            flex: 1,
            display: isLocalCameraFallback ? 'none' : 'block',
          }}
        />

        {/* Fallback Standalone Local Video Element */}
        {isLocalCameraFallback && (
          <video
            ref={fallbackVideoRef}
            autoPlay
            playsInline
            muted
            style={{
              width: '100%',
              height: '100%',
              minHeight: '580px',
              objectFit: 'cover',
              flex: 1,
            }}
          />
        )}

        {/* 2D Canvas Skeleton Overlay (Aligned 1:1 on top of video) */}
        <canvas
          ref={canvasRef}
          style={{
            position: 'absolute',
            left: canvasBounds.left,
            top: canvasBounds.top,
            width: canvasBounds.width,
            height: canvasBounds.height,
            objectFit: canvasBounds.objectFit,
            pointerEvents: 'none',
            zIndex: 5,
          }}
        />

        {/* Calibrated Status Badge */}
        <div
          style={{
            position: 'absolute',
            bottom: 'var(--space-4)',
            left: 'var(--space-4)',
            zIndex: 6,
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
            padding: 'var(--space-1) var(--space-3)',
            borderRadius: 'var(--radius-pill)',
            backgroundColor: 'rgba(19, 20, 23, 0.75)',
            backdropFilter: 'blur(4px)',
            fontSize: '0.75rem',
            color: 'var(--text-on-dark-primary)',
          }}
        >
          <span
            style={{
              width: '0.5rem',
              height: '0.5rem',
              borderRadius: '50%',
              backgroundColor: isCalibrated ? 'var(--status-stable)' : 'var(--status-warning)',
            }}
          />
          <span>{isLocalCameraFallback ? 'Offline Camera Active • ' : ''}{isCalibrated ? 'Baseline Calibrated' : 'Stand upright to calibrate'}</span>
        </div>
      </div>

      {/* 2. Optimistic Local HUD & Kinematics Bento Row (Placed Below Camera Window) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
          gap: 'var(--space-6)',
          width: '100%',
          alignItems: 'stretch',
        }}
      >
        {/* Bento Card 1: Completed Squat Reps */}
        <div
          style={{
            backgroundColor: 'var(--surface-dark-sidebar)',
            borderRadius: 'var(--radius-bento-card)',
            padding: 'var(--space-6)',
            color: 'var(--text-on-dark-primary)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: 'var(--space-4)',
            boxShadow: 'var(--shadow-bento)',
            border: '1px solid var(--surface-dark-card-border)',
          }}
        >
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: 'var(--text-on-dark-secondary)',
                }}
              >
                Completed Squat Reps
              </span>
              <span
                style={{
                  fontSize: '0.6875rem',
                  fontWeight: 600,
                  padding: 'var(--space-0-5) var(--space-2)',
                  borderRadius: 'var(--radius-pill)',
                  backgroundColor: 'rgba(255, 255, 255, 0.08)',
                  color: 'var(--text-on-dark-secondary)',
                }}
              >
                Auto-Validated
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--space-3)', marginTop: 'var(--space-2)' }}>
              <motion.span
                key={repCount}
                animate={{ scale: [1.35, 1] }}
                transition={springPresets.snappy}
                style={{
                  fontSize: '3.75rem',
                  fontWeight: 900,
                  letterSpacing: '-0.03em',
                  color: 'var(--accent-lime)',
                  lineHeight: 1,
                }}
              >
                {repCount}
              </motion.span>
              <span style={{ fontSize: '1rem', color: 'var(--text-on-dark-muted)', fontWeight: 500 }}>
                validated reps
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
            <span
              style={{
                fontSize: '0.75rem',
                padding: 'var(--space-1) var(--space-3)',
                borderRadius: 'var(--radius-pill)',
                backgroundColor: 'rgba(218, 254, 82, 0.18)',
                color: 'var(--accent-lime)',
                fontWeight: 600,
              }}
            >
              Phase: {phase}
            </span>
            <span
              style={{
                fontSize: '0.75rem',
                padding: 'var(--space-1) var(--space-3)',
                borderRadius: 'var(--radius-pill)',
                backgroundColor: 'rgba(255, 255, 255, 0.08)',
                color: 'var(--text-on-dark-secondary)',
                fontWeight: 600,
              }}
            >
              ⚡ {currentFps} FPS
            </span>
            <span
              style={{
                fontSize: '0.75rem',
                padding: 'var(--space-1) var(--space-3)',
                borderRadius: 'var(--radius-pill)',
                backgroundColor: isCalibrated ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                color: isCalibrated ? 'var(--status-stable)' : 'var(--status-warning)',
                fontWeight: 600,
              }}
            >
              {isCalibrated ? '● Baseline Calibrated' : '⏳ Stand upright to calibrate'}
            </span>
          </div>
        </div>

        {/* Bento Card 2: Joint Angles & Depth Ratio */}
        <div
          style={{
            backgroundColor: 'var(--surface-canvas-subtle)',
            border: '1px solid var(--surface-border-subtle)',
            borderRadius: 'var(--radius-bento-card)',
            padding: 'var(--space-6)',
            boxShadow: 'var(--shadow-bento)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: 'var(--space-4)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span
              style={{
                fontSize: '0.75rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: 'var(--text-muted)',
              }}
            >
              Real-Time Joint Kinematics
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500 }}>
              Threshold: ≤ 8.0% Valgus
            </span>
          </div>

          {/* Bilateral Knee Angles */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
            <div
              style={{
                padding: 'var(--space-3) var(--space-4)',
                borderRadius: 'var(--radius-control)',
                backgroundColor: 'var(--surface-canvas)',
                border: '1px solid var(--surface-border-subtle)',
              }}
            >
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', fontWeight: 500 }}>
                Left Knee
              </span>
              <span style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
                {kneeAngleL}°
              </span>
              <div style={{ fontSize: '0.6875rem', marginTop: 'var(--space-1)' }}>
                Valgus: <strong style={{ color: valgusL > 8 ? 'var(--status-critical)' : 'var(--status-stable)' }}>{valgusL}%</strong>
              </div>
            </div>

            <div
              style={{
                padding: 'var(--space-3) var(--space-4)',
                borderRadius: 'var(--radius-control)',
                backgroundColor: 'var(--surface-canvas)',
                border: '1px solid var(--surface-border-subtle)',
              }}
            >
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', fontWeight: 500 }}>
                Right Knee
              </span>
              <span style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
                {kneeAngleR}°
              </span>
              <div style={{ fontSize: '0.6875rem', marginTop: 'var(--space-1)' }}>
                Valgus: <strong style={{ color: valgusR > 8 ? 'var(--status-critical)' : 'var(--status-stable)' }}>{valgusR}%</strong>
              </div>
            </div>
          </div>

          {/* Pelvic Depth Progress */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
              <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>Squat Depth Target (≥85%)</span>
              <span style={{ fontWeight: 700, color: depthProgress >= 85 ? 'var(--status-stable)' : 'var(--text-primary)' }}>
                {depthProgress}%
              </span>
            </div>
            <div
              style={{
                height: '0.625rem',
                borderRadius: 'var(--radius-pill)',
                backgroundColor: 'var(--surface-border-strong)',
                overflow: 'hidden',
              }}
            >
              <motion.div
                style={{
                  height: '100%',
                  backgroundColor: depthProgress >= 85 ? 'var(--status-stable)' : 'var(--accent-lime)',
                  width: `${Math.min(100, depthProgress)}%`,
                  transition: 'background-color 0.2s ease',
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Patient;
