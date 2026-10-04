import React from 'react';
import type { SpikeMetrics, SpikeStatus } from '../types';
import SpikeStatusChip from './SpikeStatusChip';

interface KillSwitchGateTableProps {
  metrics: SpikeMetrics;
  statuses: {
    s1: SpikeStatus;
    s2: SpikeStatus;
    s3: SpikeStatus;
    s4: SpikeStatus;
  };
  onRunAll?: () => void;
  isRunningAll?: boolean;
}

export const KillSwitchGateTable: React.FC<KillSwitchGateTableProps> = ({
  metrics,
  statuses,
  onRunAll,
  isRunningAll,
}) => {
  const allPass =
    statuses.s1 === 'pass' &&
    statuses.s2 === 'pass' &&
    statuses.s3 === 'pass' &&
    statuses.s4 === 'pass';

  const anyFail =
    statuses.s1 === 'fail' ||
    statuses.s2 === 'fail' ||
    statuses.s3 === 'fail' ||
    statuses.s4 === 'fail';

  const items = [
    {
      id: 's1',
      spike: 'Spike S1 (D2.1)',
      name: 'MediaPipe Pose Inference',
      requirement: 'Sustained inference ≥ 15.0 FPS; 33 keypoints detected without camera contention',
      status: statuses.s1,
      actual: metrics.s1
        ? `${metrics.s1.sustainedFps.toFixed(1)} FPS (${metrics.s1.keypointsDetected} pts, ${metrics.s1.delegateUsed})`
        : 'Not executed',
      passed: Boolean(metrics.s1?.pass),
    },
    {
      id: 's2',
      spike: 'Spike S2 (D2.3)',
      name: '10 Hz Transient Telemetry',
      requirement: '600 messages @ 10 Hz rate cap; p95 latency < 400 ms; packet loss < 2.0%',
      status: statuses.s2,
      actual: metrics.s2
        ? `${metrics.s2.messagesSent}/${metrics.s2.targetCount} sent, p95: ${metrics.s2.p95LatencyMs.toFixed(1)}ms, loss: ${metrics.s2.lossPct.toFixed(1)}%`
        : 'Not executed',
      passed: Boolean(metrics.s2?.pass),
    },
    {
      id: 's3',
      spike: 'Spike S3 (D2.2)',
      name: 'Calls v5 WebRTC Join',
      requirement: 'Tokens via /api/session; connect latency < 3.0s; clinician startAudioMuted: true',
      status: statuses.s3,
      actual: metrics.s3
        ? `${metrics.s3.role} (${(metrics.s3.connectLatencyMs / 1000).toFixed(2)}s, muted: ${metrics.s3.audioMuted ? 'YES' : 'NO'})`
        : 'Not executed',
      passed: Boolean(metrics.s3?.pass),
    },
    {
      id: 's4',
      spike: 'Spike S4 (D2.4)',
      name: 'Custom Message Persistence',
      requirement: '25 custom messages burst; 100% retrieval in strict chronological order',
      status: statuses.s4,
      actual: metrics.s4
        ? `${metrics.s4.retrievedCount}/${metrics.s4.targetCount} retrieved, chrono: ${metrics.s4.chronologicalMatch ? 'VALID' : 'INVALID'}`
        : 'Not executed',
      passed: Boolean(metrics.s4?.pass),
    },
  ];

  return (
    <div className="kine-gate-card">
      <div className="kine-gate-header">
        <div>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            Milestone D2.5 Kill-Switch Evaluation Gate
          </h3>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
            Formal verification protocol for MediaPipe Pose & CometChat Calls v5 Spikes.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {allPass ? (
            <div className="kine-gate-badge-pass">
              <span>●</span> GATE PASS: GREEN LIGHT (PROCEED TO DAY 3)
            </div>
          ) : anyFail ? (
            <div className="kine-gate-badge-blocked">
              <span>✕</span> GATE BLOCKED: REMEDIATION REQUIRED
            </div>
          ) : (
            <div className="kine-chip kine-chip-idle" style={{ fontSize: '0.875rem', padding: '0.4rem 0.8rem' }}>
              <span>○</span> EVALUATION PENDING (EXECUTE ALL SPIKES)
            </div>
          )}

          {onRunAll && (
            <button
              type="button"
              className="kine-btn-run-all"
              onClick={onRunAll}
              disabled={isRunningAll}
            >
              {isRunningAll ? 'Executing Benchmark Suite...' : '▶ Run All Spikes'}
            </button>
          )}
        </div>
      </div>

      <div className="kine-gate-table-wrapper">
        <table className="kine-gate-table">
          <thead>
            <tr>
              <th>Spike & Scope</th>
              <th>Acceptance Criteria</th>
              <th>Measured Value</th>
              <th>Gate Status</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                    {item.spike}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {item.name}
                  </div>
                </td>
                <td style={{ color: 'var(--text-secondary)', maxWidth: '320px', fontSize: '0.8125rem' }}>
                  {item.requirement}
                </td>
                <td style={{ fontFamily: 'monospace', fontSize: '0.8125rem', color: 'var(--text-primary)' }}>
                  {item.actual}
                </td>
                <td>
                  <SpikeStatusChip status={item.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default KillSwitchGateTable;
