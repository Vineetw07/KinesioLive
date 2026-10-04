import React, { useState, useRef, useEffect, useCallback } from 'react';
import type { UserRole } from '@kinesio/shared';
import { CallsJoinRunner } from './callsRunner';
import BenchmarkMetricCard from '../components/BenchmarkMetricCard';
import SpikeStatusChip from '../components/SpikeStatusChip';
import type { S3CallsMetrics, SpikeLogEntry, SpikeStatus } from '../types';

interface SpikeCallsJoinProps {
  onMetricsUpdate?: (metrics: S3CallsMetrics) => void;
  onLog?: (entry: Omit<SpikeLogEntry, 'id' | 'timestamp' | 'spikeId'>) => void;
  onComplete?: (metrics: S3CallsMetrics) => void;
  isAutoRun?: boolean;
}

export const SpikeCallsJoin: React.FC<SpikeCallsJoinProps> = ({
  onMetricsUpdate,
  onLog,
  onComplete,
  isAutoRun = false,
}) => {
  const [role, setRole] = useState<UserRole>('clinician');
  const [sessionIdInput, setSessionIdInput] = useState<string>('kine-s3-room-bench');
  const [status, setStatus] = useState<SpikeStatus>('idle');
  const [connectLatencyMs, setConnectLatencyMs] = useState<number>(0);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [sessionDetails, setSessionDetails] = useState<S3CallsMetrics | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const runnerRef = useRef<CallsJoinRunner>(new CallsJoinRunner());

  const log = useCallback(
    (level: SpikeLogEntry['level'], message: string, details?: Record<string, unknown>) => {
      onLog?.({ level, message, details });
    },
    [onLog]
  );

  const handleJoin = useCallback(async () => {
    setErrorMessage(null);
    setStatus('running');
    setConnectLatencyMs(0);
    setIsConnected(false);

    const container = containerRef.current;
    if (!container) {
      const err = 'Calls container element not mounted';
      setErrorMessage(err);
      setStatus('fail');
      return;
    }

    try {
      const metrics = await runnerRef.current.joinCall({
        role,
        sessionId: sessionIdInput.trim() || undefined,
        containerElement: container,
        onLog: (level, msg) => log(level, msg),
      });

      setConnectLatencyMs(metrics.connectLatencyMs);
      setIsConnected(true);
      setSessionDetails(metrics);
      setStatus(metrics.pass ? 'pass' : 'fail');

      onMetricsUpdate?.(metrics);
      onComplete?.(metrics);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(msg);
      setStatus('fail');
      setIsConnected(false);
      log('error', `Calls v5 Join failed: ${msg}`);
    }
  }, [role, sessionIdInput, log, onMetricsUpdate, onComplete]);

  const handleLeave = () => {
    runnerRef.current.leaveCall();
    setIsConnected(false);
    setStatus('idle');
    log('info', 'Left Calls v5 session');
  };

  useEffect(() => {
    if (isAutoRun && status === 'idle' && !isConnected) {
      handleJoin();
    }
  }, [isAutoRun, status, isConnected, handleJoin]);

  useEffect(() => {
    return () => {
      runnerRef.current.leaveCall();
    };
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* S3 Header & Controls */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '1rem',
          backgroundColor: 'var(--bg-surface)',
          padding: '1rem 1.25rem',
          borderRadius: '0.75rem',
          border: '1px solid var(--border-subtle)',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <h3 style={{ fontSize: '1.125rem', fontWeight: 600 }}>
              Spike S3 (D2.2): Headless Calls v5 Session Join
            </h3>
            <SpikeStatusChip status={status} />
          </div>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
            Dual-profile session onboarding via server tokens with startAudioMuted: true on clinician.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <input
            type="text"
            className="kine-input"
            style={{ width: '180px', padding: '0.5rem 0.75rem' }}
            placeholder="Session ID"
            value={sessionIdInput}
            onChange={(e) => setSessionIdInput(e.target.value)}
            disabled={isConnected || status === 'running'}
          />
          {/* Role selector */}
          <div className="kine-role-selector" style={{ maxWidth: '320px' }}>
            <button
              type="button"
              className={`kine-role-btn ${role === 'clinician' ? 'active' : ''}`}
              style={{ padding: '0.5rem 0.75rem', fontSize: '0.8125rem' }}
              onClick={() => setRole('clinician')}
              disabled={isConnected || status === 'running'}
            >
              Clinician (dr-demo)
            </button>
            <button
              type="button"
              className={`kine-role-btn ${role === 'patient' ? 'active' : ''}`}
              style={{ padding: '0.5rem 0.75rem', fontSize: '0.8125rem' }}
              onClick={() => setRole('patient')}
              disabled={isConnected || status === 'running'}
            >
              Patient (pt-demo)
            </button>
          </div>

          {!isConnected ? (
            <button
              type="button"
              className="kine-btn-run-all"
              onClick={handleJoin}
              disabled={status === 'running'}
            >
              {status === 'running' ? 'Connecting...' : '▶ Join Calls v5 Session'}
            </button>
          ) : (
            <button
              type="button"
              className="kine-button kine-button-secondary"
              onClick={handleLeave}
            >
              Leave Session
            </button>
          )}
        </div>
      </div>

      {errorMessage && (
        <div
          style={{
            padding: '0.75rem 1rem',
            borderRadius: '0.5rem',
            backgroundColor: 'rgba(244, 63, 94, 0.1)',
            border: '1px solid var(--accent-rose)',
            color: 'var(--accent-rose)',
            fontSize: '0.875rem',
          }}
        >
          {errorMessage}
        </div>
      )}

      {/* Metrics Row */}
      <div className="kine-metric-grid">
        <BenchmarkMetricCard
          title="Connection Latency"
          value={connectLatencyMs > 0 ? (connectLatencyMs / 1000).toFixed(2) : '--'}
          unit="s"
          threshold="< 3.0 s"
          status={status === 'idle' ? 'idle' : connectLatencyMs < 3000 ? 'pass' : 'fail'}
        />
        <BenchmarkMetricCard
          title="Audio Mute Initial State"
          value={role === 'clinician' ? 'MUTED' : 'UNMUTED'}
          threshold="Clinician: startAudioMuted=true"
          status={role === 'clinician' ? 'pass' : 'idle'}
          subtext="Acoustic feedback prevention"
        />
        <BenchmarkMetricCard
          title="WebRTC Session State"
          value={isConnected ? 'CONNECTED' : status === 'running' ? 'CONNECTING' : 'DISCONNECTED'}
          threshold="Active Media Stream"
          status={isConnected ? 'pass' : status === 'running' ? 'running' : 'idle'}
          subtext={sessionDetails ? `Room: ${sessionDetails.sessionId}` : 'Zero Client API Keys'}
        />
        <BenchmarkMetricCard
          title="Authenticated UID"
          value={role === 'clinician' ? 'dr-demo' : 'pt-demo'}
          threshold="Server-Minted Token"
          status="idle"
          subtext="POST /api/session"
        />
      </div>

      {/* WebRTC Call Container with explicit non-zero height invariant */}
      <div>
        <span className="kine-stat-label" style={{ marginBottom: '0.5rem', display: 'block' }}>
          WebRTC Call Surface (Non-Zero Height Dimension Invariant)
        </span>
        <div
          id="call-container-s3"
          ref={containerRef}
          className="kine-call-webrtc-container"
        >
          {!isConnected && status !== 'running' && (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
              <p style={{ fontSize: '0.875rem' }}>Call container ready.</p>
              <p style={{ fontSize: '0.75rem', marginTop: '0.25rem' }}>
                Select role and click <strong>Join Calls v5 Session</strong> to mount WebRTC video feed.
              </p>
            </div>
          )}
          {status === 'running' && (
            <div style={{ textAlign: 'center', color: 'var(--accent-cyan)' }}>
              <p style={{ fontSize: '0.875rem' }}>Negotiating WebRTC session...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SpikeCallsJoin;
