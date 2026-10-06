/**
 * Clinician.tsx (Milestone D4.4)
 * Tele-Rehab Mission-Control Clinician Studio.
 * - Mounts CometChat Calls v5 WebRTC session with MANDATORY startAudioMuted: true.
 * - Ingests 10 Hz kine.pose transient messages via useTelemetryStream.
 * - Applies Framer Motion useSpring dampers for 60 fps smooth telemetry visualization.
 * - Live HUD: Bilateral knee angles, pelvic depth gauge, FPS, squat phase, valgus alerts.
 * - Tactile Coaching Cue Pad (4 cue buttons: Knees Out, Slow Down, Chest Up, Good Depth).
 * - Session Controls: Copy Patient Invite Link and End Session marker.
 * - 100% semantic CSS tokens - ZERO raw hex codes.
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, useMotionValue, useSpring, useMotionValueEvent } from 'framer-motion';
import { CometChat } from '@cometchat/chat-sdk-javascript';
import { CometChatCalls, type SessionSettings } from '@cometchat/calls-sdk-javascript';
import {
  SCHEMA_VERSION,
  CLINICIAN_UID,
  PATIENT_UID,
  type CoachingCueType,
  type KineCuePayload,
  type KineSessionMarkerPayload,
  type KineRepPayload,
  type KineAlertPayload,
  type SessionResponse,
} from '@kinesio/shared';
import { useTelemetryStream } from '../hooks/useTelemetryStream';
import { springPresets } from '../styles/motionPresets';
import { requestSession } from '../spikes/utils/tokenService';
import {
  ensureSessionGroup,
  broadcastTelemetryEvent,
  subscribeToBroadcastEvents,
  extractCustomMessageData,
  isDuplicateMessage,
} from '../utils/telemetryTransport';

export interface ClinicianViewProps {
  sessionId?: string;
  onEndSession?: () => void;
}

export interface CoachingCueItem {
  id: CoachingCueType;
  label: string;
  icon: string;
  category: 'Stance' | 'Tempo' | 'Posture' | 'Depth';
}

const COACHING_CUES: CoachingCueItem[] = [
  { id: 'knees_out', label: 'Knees Out', icon: '↔️', category: 'Stance' },
  { id: 'slower', label: 'Slow Down', icon: '⏱️', category: 'Tempo' },
  { id: 'chest_up', label: 'Chest Up', icon: '⬆️', category: 'Posture' },
  { id: 'good_depth', label: 'Good Depth', icon: '🎯', category: 'Depth' },
];

export const Clinician: React.FC<ClinicianViewProps> = ({ sessionId: propSessionId, onEndSession }) => {
  const [sessionData, setSessionData] = useState<SessionResponse | null>(null);
  const [initError, setInitError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState<number>(0);
  const [callStatus, setCallStatus] = useState<'idle' | 'authenticating' | 'connecting' | 'connected' | 'ended' | 'error'>('idle');
  const [activeCueSent, setActiveCueSent] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const [isPatientMuted, setIsPatientMuted] = useState<boolean>(false);
  const [repCount, setRepCount] = useState<number>(0);
  const [recentAlerts, setRecentAlerts] = useState<KineAlertPayload[]>([]);

  // Video container DOM ref
  const callContainerRef = useRef<HTMLDivElement>(null);
  const callTeardownRef = useRef<(() => void) | null>(null);

  const activeSessionId = sessionData?.sessionId || propSessionId || '';

  // Telemetry stream subscription (active as soon as session ID is available)
  const { currentPose, isConnected: isTelemetryConnected } = useTelemetryStream(
    activeSessionId || null
  );

  // Motion values for smooth 60 fps interpolation
  const kneeLMV = useMotionValue(180);
  const kneeRMV = useMotionValue(180);
  const depthMV = useMotionValue(0);
  const valgusLMV = useMotionValue(0);
  const valgusRMV = useMotionValue(0);

  const smoothKneeL = useSpring(kneeLMV, springPresets.telemetry);
  const smoothKneeR = useSpring(kneeRMV, springPresets.telemetry);
  const smoothDepth = useSpring(depthMV, springPresets.telemetry);
  const smoothValgusL = useSpring(valgusLMV, springPresets.telemetry);
  const smoothValgusR = useSpring(valgusRMV, springPresets.telemetry);

  const [displayKneeL, setDisplayKneeL] = useState<number>(180);
  const [displayKneeR, setDisplayKneeR] = useState<number>(180);
  const [displayDepth, setDisplayDepth] = useState<number>(0);
  const [displayValgusL, setDisplayValgusL] = useState<number>(0);
  const [displayValgusR, setDisplayValgusR] = useState<number>(0);

  useMotionValueEvent(smoothKneeL, 'change', (latest) => setDisplayKneeL(Math.round(latest)));
  useMotionValueEvent(smoothKneeR, 'change', (latest) => setDisplayKneeR(Math.round(latest)));
  useMotionValueEvent(smoothDepth, 'change', (latest) => setDisplayDepth(Math.round(latest * 100)));
  useMotionValueEvent(smoothValgusL, 'change', (latest) => setDisplayValgusL(Math.round(latest * 10) / 10));
  useMotionValueEvent(smoothValgusR, 'change', (latest) => setDisplayValgusR(Math.round(latest * 10) / 10));

  // Update motion values when 10 Hz pose packet arrives
  useEffect(() => {
    if (!currentPose) return;

    if (currentPose.kneeFlexionDeg.L !== null) kneeLMV.set(currentPose.kneeFlexionDeg.L);
    if (currentPose.kneeFlexionDeg.R !== null) kneeRMV.set(currentPose.kneeFlexionDeg.R);
    depthMV.set(Math.max(0, currentPose.depthRatio));
    if (currentPose.valgusDevPct.L !== null) valgusLMV.set(currentPose.valgusDevPct.L);
    if (currentPose.valgusDevPct.R !== null) valgusRMV.set(currentPose.valgusDevPct.R);
    if (typeof currentPose.reps === 'number' && currentPose.reps > repCount) {
      setRepCount(currentPose.reps);
    }
  }, [currentPose, kneeLMV, kneeRMV, depthMV, valgusLMV, valgusRMV, repCount]);

  // Connect Call & Session on Mount
  useEffect(() => {
    let isCancelled = false;

    async function bootstrapClinicianCall() {
      try {
        setCallStatus('authenticating');
        setInitError(null);

        // 1. Fetch Session Credentials
        const session = await requestSession('clinician', propSessionId);
        if (isCancelled) return;
        setSessionData(session);

        if (session.authToken.startsWith('mock_token_')) {
          throw new Error(
            'CometChat Auth Key is truncated in .env (ends with "..."). Please update .env with your full 40-character key from app.cometchat.com'
          );
        }

        // 2. Init Chat SDK
        const chatSettings = new CometChat.AppSettingsBuilder()
          .subscribePresenceForAllUsers()
          .setRegion(session.region)
          .enableAutoJoinForGroups(true)
          .build();
        await CometChat.init(session.appId, chatSettings);

        // 3. Login to Chat SDK
        const activeUser = await CometChat.getLoggedinUser();
        if (!activeUser || activeUser.getUid() !== session.uid) {
          await CometChat.login(session.authToken);
        }

        // 4. Ensure Clinician is joined to the session group
        await ensureSessionGroup(session.sessionId);

        // Register custom message listener for kine.rep and kine.alert immediately
        const customListenerId = `kine-clinician-custom-${session.sessionId}`;
        CometChat.addMessageListener(
          customListenerId,
          new CometChat.MessageListener({
            onCustomMessageReceived: (customMessage: CometChat.CustomMessage) => {
              const msgType = customMessage.getType() || customMessage.getSubType();
              const customData = extractCustomMessageData(customMessage) as any;
              const type = customData?.type || msgType;

              if (type === 'kine.rep') {
                const rep = customData as KineRepPayload;
                const key = `rep_${rep.t}_${rep.n}`;
                if (!isDuplicateMessage(key) && typeof rep.n === 'number') {
                  setRepCount((prev) => Math.max(prev, rep.n));
                }
              } else if (type === 'kine.alert') {
                const alert = customData as KineAlertPayload;
                const key = `alert_${alert.t}_${alert.side}_${alert.repN}`;
                if (!isDuplicateMessage(key)) {
                  setRecentAlerts((prev) => {
                    if (prev.some((a) => a.t === alert.t && a.repN === alert.repN && a.side === alert.side)) {
                      return prev;
                    }
                    return [alert, ...prev.slice(0, 4)];
                  });
                }
              }
            },
          })
        );

        // 5. Init Calls SDK v5
        await CometChatCalls.init({
          appId: session.appId,
          region: session.region as 'in' | 'eu' | 'us' | 'IN' | 'EU' | 'US',
        });

        // 6. Login to Calls SDK
        if (!CometChatCalls.isUserLoggedIn()) {
          await CometChatCalls.loginWithAuthToken(session.authToken);
        }

        // 7. Register Call Listeners
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

        // 8. Generate Call Token
        const tokenResult = await CometChatCalls.generateToken(session.sessionId);
        const callToken = tokenResult.token;

        // 9. Join Session Container
        // MANDATORY INVARIANT: startAudioMuted: true to prevent acoustic feedback loop
        const callSettings: SessionSettings = {
          sessionType: 'VIDEO',
          layout: 'TILE',
          startAudioMuted: true, // NON-NEGOTIABLE ACOUSTIC HOWLING DEFENSE
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

        callTeardownRef.current = () => {
          unsubs.forEach((unsub) => {
            try {
              unsub();
            } catch {
              // Ignore
            }
          });
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
            (typeof err === 'string' ? err : 'Failed to connect Clinician call session');
          setInitError(errMsg);
        }
      }
    }

    bootstrapClinicianCall();

    return () => {
      isCancelled = true;
      if (callTeardownRef.current) {
        callTeardownRef.current();
        callTeardownRef.current = null;
      }
    };
  }, [propSessionId, retryKey]);

  // Dual-transport local BroadcastChannel listener for zero-latency reps and alerts
  useEffect(() => {
    if (!activeSessionId) return;

    const unsubscribe = subscribeToBroadcastEvents(activeSessionId, {
      onRep: (rep) => {
        if (typeof rep.n === 'number') {
          setRepCount((prev) => Math.max(prev, rep.n));
        }
      },
      onAlert: (alert) => {
        setRecentAlerts((prev) => {
          if (prev.some((a) => a.t === alert.t && a.repN === alert.repN && a.side === alert.side)) {
            return prev;
          }
          return [alert, ...prev.slice(0, 4)];
        });
      },
    });

    return () => {
      unsubscribe();
    };
  }, [activeSessionId]);

  // Dispatch Coaching Cue with Dual-Transport (BroadcastChannel + CometChat CustomMessage)
  const handleSendCue = async (cue: CoachingCueType, text: string) => {
    if (!activeSessionId) return;

    setActiveCueSent(cue);
    setTimeout(() => setActiveCueSent(null), 1200);

    const cuePayload: KineCuePayload = {
      v: SCHEMA_VERSION,
      sid: activeSessionId,
      t: Date.now(),
      type: 'kine.cue',
      cue,
      text,
    };

    // 1. Dual-transport: Instant cross-tab sync via BroadcastChannel
    broadcastTelemetryEvent(activeSessionId, cuePayload);

    // 2. CometChat CustomMessage for remote participant delivery
    try {
      const customMsg = new CometChat.CustomMessage(
        activeSessionId,
        CometChat.RECEIVER_TYPE.GROUP,
        'kine.cue',
        cuePayload as unknown as Record<string, unknown>
      );
      customMsg.shouldUpdateConversation(false);
      await CometChat.sendCustomMessage(customMsg);
    } catch (err) {
      console.warn('[Clinician] CometChat sendCustomMessage cue notice:', err);
    }
  };

  // Copy Patient Invite Link
  const handleCopyLink = () => {
    if (!activeSessionId) return;
    const inviteUrl = `${window.location.origin}/?role=patient&session=${encodeURIComponent(activeSessionId)}`;
    navigator.clipboard.writeText(inviteUrl).then(() => {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    });
  };

  // End Session Handler
  const handleEndSession = async () => {
    if (!activeSessionId) return;

    try {
      const markerPayload: KineSessionMarkerPayload = {
        v: SCHEMA_VERSION,
        sid: activeSessionId,
        t: Date.now(),
        type: 'kine.session',
        action: 'end',
        clinicianUid: CLINICIAN_UID,
        patientUid: PATIENT_UID,
      };

      const markerMsg = new CometChat.CustomMessage(
        activeSessionId,
        CometChat.RECEIVER_TYPE.GROUP,
        'kine.session',
        markerPayload as unknown as Record<string, unknown>
      );
      markerMsg.shouldUpdateConversation(false);
      await CometChat.sendCustomMessage(markerMsg);
    } catch {
      // Continue with teardown
    }

    setCallStatus('ended');
    if (onEndSession) onEndSession();
  };

  const handleMutePatient = async () => {
    try {
      // Calls SDK v5 moderator action (COMETCHAT_INTEGRATION.md #10)
      const callsModerator = CometChatCalls as unknown as {
        muteParticipant: (participantId: string) => Promise<unknown>;
      };
      await callsModerator.muteParticipant(PATIENT_UID);
      setIsPatientMuted(true);
      setTimeout(() => setIsPatientMuted(false), 3000);
    } catch (err: unknown) {
      console.warn('Failed to mute participant:', err);
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-6)',
        width: '100%',
        minHeight: '100%',
        position: 'relative',
        color: 'var(--text-primary)',
      }}
    >
      {/* Studio Header & Session Control Bar */}
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
              Clinician Mission Control
            </h2>
            <span
              style={{
                fontSize: '0.75rem',
                fontWeight: 600,
                padding: 'var(--space-0-5) var(--space-2)',
                borderRadius: 'var(--radius-pill)',
                backgroundColor: 'var(--surface-dark-sidebar)',
                color: 'var(--accent-lime)',
              }}
            >
              {CLINICIAN_UID}
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <button
            type="button"
            onClick={handleMutePatient}
            disabled={callStatus !== 'connected'}
            style={{
              padding: 'var(--space-2) var(--space-4)',
              borderRadius: 'var(--radius-pill)',
              border: isPatientMuted ? '1px solid var(--status-critical)' : '1px solid var(--surface-border-strong)',
              backgroundColor: isPatientMuted ? 'rgba(239, 68, 68, 0.15)' : 'var(--surface-canvas-subtle)',
              color: isPatientMuted ? 'var(--status-critical)' : 'var(--text-primary)',
              fontSize: '0.8125rem',
              fontWeight: 600,
              cursor: callStatus !== 'connected' ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-1)',
              transition: 'all 0.15s ease',
            }}
          >
            {isPatientMuted ? '🔇 Patient Muted' : '🔇 Mute Patient'}
          </button>

          <button
            type="button"
            onClick={handleCopyLink}
            style={{
              padding: 'var(--space-2) var(--space-4)',
              borderRadius: 'var(--radius-pill)',
              border: '1px solid var(--surface-border-strong)',
              backgroundColor: 'var(--surface-canvas-subtle)',
              color: 'var(--text-primary)',
              fontSize: '0.8125rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-1)',
              transition: 'background-color 0.15s ease',
            }}
          >
            {copiedLink ? '✓ Link Copied!' : '📋 Copy Patient Invite Link'}
          </button>

          <button
            type="button"
            onClick={handleEndSession}
            style={{
              padding: 'var(--space-2) var(--space-4)',
              borderRadius: 'var(--radius-pill)',
              border: 'none',
              backgroundColor: 'var(--status-critical)',
              color: 'var(--text-on-dark-primary)',
              fontSize: '0.8125rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            End Session
          </button>
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
        {callStatus !== 'connected' && (
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
                <p style={{ fontWeight: 600 }}>Connecting to Calls v5 Session...</p>
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-on-dark-muted)' }}>
                  Setting up peer WebRTC connection with microphone muted.
                </p>
              </>
            ) : callStatus === 'error' ? (
              <>
                <span style={{ fontSize: '2rem' }}>⚠️</span>
                <p style={{ fontWeight: 600, color: 'var(--status-critical)' }}>
                  Connection Interrupted
                </p>
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-on-dark-muted)' }}>
                  {initError || 'Failed to establish Calls v5 session.'}
                </p>
                <button
                  type="button"
                  onClick={() => setRetryKey((k) => k + 1)}
                  style={{
                    marginTop: 'var(--space-2)',
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
              </>
            ) : callStatus === 'ended' ? (
              <>
                <span style={{ fontSize: '2rem' }}>🏁</span>
                <p style={{ fontWeight: 600 }}>Session Concluded</p>
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-on-dark-muted)' }}>
                  Total repetitions completed: {repCount}
                </p>
              </>
            ) : null}
          </div>
        )}

        {/* Calls v5 Mount Element (Explicit Non-Zero Height & Width) */}
        <div
          ref={callContainerRef}
          style={{
            width: '100%',
            height: '100%',
            minHeight: '580px',
            flex: 1,
          }}
        />

        {/* Telemetry Stream Indicator Pill */}
        <div
          style={{
            position: 'absolute',
            top: 'var(--space-3)',
            left: 'var(--space-3)',
            zIndex: 5,
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
              backgroundColor: isTelemetryConnected ? 'var(--status-stable)' : 'var(--status-warning)',
            }}
          />
          <span>{isTelemetryConnected ? '10 Hz Telemetry Live' : 'Waiting for telemetry...'}</span>
        </div>

        {/* Top-Right Feed Display Controls */}
        <div
          style={{
            position: 'absolute',
            top: 'var(--space-3)',
            right: 'var(--space-3)',
            zIndex: 5,
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
          }}
        >
          <button
            type="button"
            onClick={() => {
              if (callContainerRef.current) {
                if (document.fullscreenElement) {
                  document.exitFullscreen().catch(() => {});
                } else {
                  callContainerRef.current.requestFullscreen().catch(() => {});
                }
              }
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-1)',
              padding: 'var(--space-1) var(--space-3)',
              borderRadius: 'var(--radius-pill)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              backgroundColor: 'rgba(19, 20, 23, 0.75)',
              backdropFilter: 'blur(4px)',
              fontSize: '0.75rem',
              color: 'var(--text-on-dark-primary)',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            <span>⛶</span>
            <span>Fullscreen View</span>
          </button>
        </div>
      </div>

      {/* 2. Controls & Kinematics Bento Row (Placed Below Camera Window) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
          gap: 'var(--space-6)',
          width: '100%',
          alignItems: 'stretch',
        }}
      >
        {/* Bento Card 1: Real-Time Joint Angles & Depth */}
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
              Kinematic Gauges (60 FPS Smoothed)
            </span>
            <span
              style={{
                fontSize: '0.75rem',
                fontWeight: 600,
                padding: 'var(--space-0-5) var(--space-2)',
                borderRadius: 'var(--radius-pill)',
                backgroundColor:
                  currentPose?.phase === 'bottom'
                    ? 'var(--accent-lime)'
                    : 'var(--surface-canvas)',
                color: 'var(--text-primary)',
                border: '1px solid var(--surface-border-subtle)',
              }}
            >
              Phase: {currentPose?.phase || 'standing'}
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
                Left Knee Flexion
              </span>
              <span
                style={{
                  fontSize: '1.75rem',
                  fontWeight: 800,
                  letterSpacing: '-0.02em',
                  color: 'var(--text-primary)',
                }}
              >
                {displayKneeL}°
              </span>
              <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: 'var(--space-1)' }}>
                Valgus Dev: <strong style={{ color: displayValgusL > 8 ? 'var(--status-critical)' : 'var(--status-stable)' }}>{displayValgusL}%</strong>
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
                Right Knee Flexion
              </span>
              <span
                style={{
                  fontSize: '1.75rem',
                  fontWeight: 800,
                  letterSpacing: '-0.02em',
                  color: 'var(--text-primary)',
                }}
              >
                {displayKneeR}°
              </span>
              <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: 'var(--space-1)' }}>
                Valgus Dev: <strong style={{ color: displayValgusR > 8 ? 'var(--status-critical)' : 'var(--status-stable)' }}>{displayValgusR}%</strong>
              </div>
            </div>
          </div>

          {/* Depth Gauge */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
              <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>Pelvic Depth Progress</span>
              <span style={{ fontWeight: 600 }}>{displayDepth}%</span>
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
                  backgroundColor: displayDepth >= 85 ? 'var(--status-stable)' : 'var(--accent-lime)',
                  width: `${Math.min(100, displayDepth)}%`,
                }}
              />
            </div>
          </div>

          {/* Rep Counter & FPS Metric */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingTop: 'var(--space-2)',
              borderTop: '1px solid var(--surface-border-subtle)',
            }}
          >
            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', fontWeight: 500 }}>
                Validated Reps
              </span>
              <span style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--accent-slate)' }}>
                {repCount}
              </span>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', fontWeight: 500 }}>
                Inference Rate
              </span>
              <span style={{ fontSize: '0.9375rem', fontWeight: 600 }}>
                {currentPose?.fps ? `${currentPose.fps} FPS` : '30 FPS'}
              </span>
            </div>
          </div>
        </div>

        {/* Bento Card 2: Tactile Coaching Cue Pad */}
        <div
          style={{
            backgroundColor: 'var(--surface-dark-card)',
            borderRadius: 'var(--radius-bento-card)',
            border: '1px solid var(--surface-dark-card-border)',
            padding: 'var(--space-6)',
            boxShadow: 'var(--shadow-bento)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: 'var(--space-4)',
            color: 'var(--text-on-dark-primary)',
          }}
        >
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
              <span
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: 'var(--text-on-dark-secondary)',
                }}
              >
                Tactile Coaching Cue Pad
              </span>
              <span style={{ fontSize: '0.6875rem', color: 'var(--text-on-dark-muted)' }}>
                Dispatches kine.cue
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
              {COACHING_CUES.map((cue) => {
                const isSent = activeCueSent === cue.id;
                return (
                  <motion.button
                    key={cue.id}
                    type="button"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.95 }}
                    transition={springPresets.snappy}
                    onClick={() => handleSendCue(cue.id, cue.label)}
                    style={{
                      padding: 'var(--space-3) var(--space-4)',
                      borderRadius: 'var(--radius-control)',
                      border: isSent
                        ? '1px solid var(--accent-lime)'
                        : '1px solid var(--surface-dark-card-border)',
                      backgroundColor: isSent
                        ? 'var(--accent-lime-tint)'
                        : 'var(--surface-dark-card-hover)',
                      color: isSent ? 'var(--accent-lime)' : 'var(--text-on-dark-primary)',
                      fontWeight: 600,
                      fontSize: '0.8125rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 'var(--space-2)',
                      cursor: 'pointer',
                      transition: 'border-color 0.15s, background-color 0.15s',
                    }}
                  >
                    <span>{cue.icon}</span>
                    <span>{cue.label}</span>
                  </motion.button>
                );
              })}
            </div>
          </div>

          <div
            style={{
              fontSize: '0.75rem',
              color: 'var(--text-on-dark-muted)',
              borderTop: '1px solid var(--surface-dark-card-border)',
              paddingTop: 'var(--space-3)',
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
            }}
          >
            <span>⚡</span>
            <span>Real-time tactile cues dispatch immediately to patient screen via CometChat.</span>
          </div>
        </div>

        {/* Bento Card 3: Recent Biomechanical Event Stream */}
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
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
              <span
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: 'var(--text-muted)',
                }}
              >
                Live Clinical Event Stream
              </span>
              <span
                style={{
                  fontSize: '0.6875rem',
                  fontWeight: 600,
                  padding: 'var(--space-0-5) var(--space-2)',
                  borderRadius: 'var(--radius-pill)',
                  backgroundColor: recentAlerts.length > 0 ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                  color: recentAlerts.length > 0 ? 'var(--status-critical)' : 'var(--status-stable)',
                }}
              >
                {recentAlerts.length > 0 ? `${recentAlerts.length} Alerts Logged` : '0 Alerts Logged'}
              </span>
            </div>

            {recentAlerts.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
                {recentAlerts.map((alert, idx) => (
                  <div
                    key={`${alert.t}-${idx}`}
                    style={{
                      fontSize: '0.75rem',
                      display: 'flex',
                      justifyContent: 'space-between',
                      color: 'var(--status-critical)',
                      padding: 'var(--space-1) 0',
                      borderBottom: idx < recentAlerts.length - 1 ? '1px solid var(--surface-border-subtle)' : 'none',
                    }}
                  >
                    <span>
                      {alert.side === 'L' ? 'Left' : 'Right'} Valgus Dev ({alert.value}%)
                    </span>
                    <span style={{ color: 'var(--text-muted)' }}>Rep #{alert.repN}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div
                style={{
                  padding: 'var(--space-3) 0',
                  color: 'var(--text-muted)',
                  fontSize: '0.8125rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-2)',
                }}
              >
                <span>✅</span>
                <span>No form alerts recorded. Valgus alignment within safe threshold.</span>
              </div>
            )}
          </div>

          <div
            style={{
              fontSize: '0.75rem',
              color: 'var(--text-muted)',
              borderTop: '1px solid var(--surface-border-subtle)',
              paddingTop: 'var(--space-3)',
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
            }}
          >
            <span>🛡️</span>
            <span>Triggered automatically when knee valgus deviation exceeds 8.0%.</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Clinician;
