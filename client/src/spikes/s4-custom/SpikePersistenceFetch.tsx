import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  PersistenceBenchmarkRunner,
  type RetrievedCustomMessageSummary,
} from './persistenceRunner';
import BenchmarkMetricCard from '../components/BenchmarkMetricCard';
import SpikeStatusChip from '../components/SpikeStatusChip';
import type { S4PersistenceMetrics, SpikeLogEntry, SpikeStatus } from '../types';

interface SpikePersistenceFetchProps {
  onMetricsUpdate?: (metrics: S4PersistenceMetrics) => void;
  onLog?: (entry: Omit<SpikeLogEntry, 'id' | 'timestamp' | 'spikeId'>) => void;
  onComplete?: (metrics: S4PersistenceMetrics) => void;
  isAutoRun?: boolean;
}

export const SpikePersistenceFetch: React.FC<SpikePersistenceFetchProps> = ({
  onMetricsUpdate,
  onLog,
  onComplete,
  isAutoRun = false,
}) => {
  const [status, setStatus] = useState<SpikeStatus>('idle');
  const [sentCount, setSentCount] = useState<number>(0);
  const [retrievedCount, setRetrievedCount] = useState<number>(0);
  const [chronologicalMatch, setChronologicalMatch] = useState<boolean>(false);
  const [retrievalLatencyMs, setRetrievalLatencyMs] = useState<number>(0);
  const [messages, setMessages] = useState<RetrievedCustomMessageSummary[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const runnerRef = useRef<PersistenceBenchmarkRunner>(new PersistenceBenchmarkRunner());

  const log = useCallback(
    (level: SpikeLogEntry['level'], message: string, details?: Record<string, unknown>) => {
      onLog?.({ level, message, details });
    },
    [onLog]
  );

  const runBenchmark = useCallback(async () => {
    setErrorMessage(null);
    setStatus('running');
    setSentCount(0);
    setRetrievedCount(0);
    setChronologicalMatch(false);
    setMessages([]);

    try {
      const { metrics, messages: fetched } = await runnerRef.current.runPersistenceTest({
        burstCount: 25,
        onProgress: (sent) => setSentCount(sent),
        onLog: (level, msg) => log(level, msg),
      });

      setRetrievedCount(metrics.retrievedCount);
      setChronologicalMatch(metrics.chronologicalMatch);
      setRetrievalLatencyMs(metrics.retrievalLatencyMs);
      setMessages(fetched);
      setStatus(metrics.pass ? 'pass' : 'fail');

      onMetricsUpdate?.(metrics);
      onComplete?.(metrics);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(msg);
      setStatus('fail');
      log('error', `Spike S4 execution failed: ${msg}`);
    }
  }, [log, onMetricsUpdate, onComplete]);

  useEffect(() => {
    if (isAutoRun && status === 'idle') {
      runBenchmark();
    }
  }, [isAutoRun, status, runBenchmark]);

  const formatPayload = (data: Record<string, unknown>) => {
    if (data.type === 'kine.rep') {
      return `Rep #${data.n}: ${data.depth} depth, minKnee: ${data.minKneeDeg}°`;
    }
    if (data.type === 'kine.alert') {
      return `Alert: ${data.kind} (${data.side}) - valgus: ${data.value}%`;
    }
    if (data.type === 'kine.cue') {
      return `Cue: ${data.cue} ("${data.text}")`;
    }
    return JSON.stringify(data);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* S4 Header & Controls */}
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
              Spike S4 (D2.4): Custom Message Persistence & History
            </h3>
            <SpikeStatusChip status={status} />
          </div>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
            25-message burst (kine.rep, kine.alert, kine.cue) &amp; chronological retrieval via MessagesRequestBuilder.
          </p>
        </div>

        <div>
          <button
            type="button"
            className="kine-btn-run-all"
            onClick={runBenchmark}
            disabled={status === 'running'}
          >
            {status === 'running'
              ? `Transmitting (${sentCount}/25)...`
              : '▶ Run S4 Persistence Test (25 Msgs)'}
          </button>
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
          title="Custom Messages Burst"
          value={`${sentCount} / 25`}
          threshold="25 Sent"
          status={status === 'idle' ? 'idle' : sentCount === 25 ? 'pass' : 'running'}
        />
        <BenchmarkMetricCard
          title="History Retrieved"
          value={`${retrievedCount} / 25`}
          threshold="100% Retrieval"
          status={status === 'idle' ? 'idle' : retrievedCount >= 25 ? 'pass' : 'fail'}
        />
        <BenchmarkMetricCard
          title="Chronological Sequence"
          value={chronologicalMatch ? 'STRICT MONOTONIC' : status === 'idle' ? '--' : 'FAILED'}
          threshold="100% In-Order"
          status={status === 'idle' ? 'idle' : chronologicalMatch ? 'pass' : 'fail'}
        />
        <BenchmarkMetricCard
          title="Query Latency"
          value={retrievalLatencyMs > 0 ? retrievalLatencyMs : '--'}
          unit="ms"
          threshold="MessagesRequestBuilder"
          status="idle"
          subtext="setCategories(['custom'])"
        />
      </div>

      {/* Retrieved Messages Table */}
      <div className="kine-gate-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="kine-stat-label" style={{ fontWeight: 600 }}>
            Retrieved Custom Message Ledger ({messages.length} messages)
          </span>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Category: <code>custom</code>
          </span>
        </div>

        <div className="kine-gate-table-wrapper" style={{ maxHeight: '300px' }}>
          <table className="kine-gate-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Type</th>
                <th>Sent At</th>
                <th>Sender</th>
                <th>Payload Summary</th>
              </tr>
            </thead>
            <tbody>
              {messages.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
                    No messages retrieved yet. Click <strong>Run S4 Persistence Test</strong> to execute.
                  </td>
                </tr>
              ) : (
                messages.map((m, idx) => (
                  <tr key={String(m.id)}>
                    <td style={{ fontFamily: 'monospace' }}>{idx + 1}</td>
                    <td>
                      <span
                        className="kine-chip"
                        style={{
                          backgroundColor:
                            m.type === 'kine.alert'
                              ? 'rgba(244, 63, 94, 0.15)'
                              : m.type === 'kine.rep'
                              ? 'rgba(16, 185, 129, 0.15)'
                              : 'rgba(6, 182, 212, 0.15)',
                          color:
                            m.type === 'kine.alert'
                              ? 'var(--accent-rose)'
                              : m.type === 'kine.rep'
                              ? 'var(--accent-emerald)'
                              : 'var(--accent-cyan)',
                        }}
                      >
                        {m.type}
                      </span>
                    </td>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                      {new Date(m.sentAt).toLocaleTimeString()}
                    </td>
                    <td style={{ color: 'var(--text-secondary)' }}>{m.sender}</td>
                    <td style={{ fontSize: '0.8125rem' }}>{formatPayload(m.data)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default SpikePersistenceFetch;
