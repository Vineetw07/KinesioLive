/**
 * client/src/views/Summary.tsx (Milestone D5.4)
 * Post-Workout Biomechanical Summary Bento View.
 * - Queries CometChat.MessagesRequestBuilder for persisted custom session messages.
 * - Aggregates data deterministically via buildSummary engine.
 * - 4 Stat Cards in a row (Total Reps, Peak Depth, Form Alerts, Coaching Cues).
 * - Anchor Dark Card with hatched diagonal texture, luminous critical pills, depth & tempo distribution.
 * - Scrollable Event Timeline with semantic status pills (stable, critical, cyan, lavender).
 * - Fluid Framer Motion transitions (springPresets.layout & springPresets.snappy).
 * - 100% semantic CSS design tokens - ZERO raw hex codes in style definitions.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { CometChat } from '@cometchat/chat-sdk-javascript';
import { VALGUS_THRESHOLD_PCT, buildSummary, type SessionSummary } from '../engine';
import { springPresets } from '../styles/motionPresets';

export interface SummaryProps {
  sessionId: string;
  guid: string;
  onBack?: () => void;
}

const HATCHED_TEXTURE_DATA_URI =
  'url("data:image/svg+xml,%3Csvg width=\'24\' height=\'24\' viewBox=\'0 0 24 24\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cpath d=\'M0 24L24 0M-6 6L6 -6M18 30L30 18\' stroke=\'rgba(255,255,255,0.045)\' stroke-width=\'1.5\'/%3E%3C/svg%3E")';

export const Summary: React.FC<SummaryProps> = ({ sessionId, guid, onBack }) => {
  const [messages, setMessages] = useState<CometChat.BaseMessage[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSessionHistory = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const targetGuid = guid || sessionId;
      const request = new CometChat.MessagesRequestBuilder()
        .setGUID(targetGuid)
        .setCategories(['custom'])
        .setLimit(100)
        .build();

      const fetched = await request.fetchPrevious();
      setMessages(fetched);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to retrieve session message history';
      console.warn('[Summary] Fetch notice:', message);
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSessionHistory();
  }, [sessionId, guid]);

  // Pure deterministic aggregation
  const summary: SessionSummary = useMemo(() => {
    return buildSummary(sessionId, messages);
  }, [sessionId, messages]);

  const durationSec = Math.round(summary.durationMs / 1000);
  const validPct = summary.totalReps > 0 ? Math.round((summary.validReps / summary.totalReps) * 100) : 0;

  const statCards = [
    {
      id: 'reps',
      label: 'Total Reps',
      value: summary.totalReps,
      detail: `${summary.validReps} valid (${validPct}%)`,
      icon: '🏋️',
    },
    {
      id: 'depth',
      label: 'Peak Depth',
      value: summary.peakDepthDeg > 0 ? `${summary.peakDepthDeg}°` : '0°',
      detail: summary.averageMinKneeDeg > 0 ? `Avg: ${Math.round(summary.averageMinKneeDeg)}° knee flexion` : 'No reps recorded',
      icon: '🎯',
    },
    {
      id: 'alerts',
      label: 'Form Alerts',
      value: summary.alertCount,
      detail: summary.maxValgusDevPct > 0 ? `Max dev: +${summary.maxValgusDevPct.toFixed(1)}%` : 'Zero valgus breaches',
      icon: '⚠️',
    },
    {
      id: 'cues',
      label: 'Coaching Cues',
      value: summary.cuesCount,
      detail: `${summary.cuesDelivered.length} cues delivered by clinician`,
      icon: '📢',
    },
  ];

  if (isLoading) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '400px',
          gap: 'var(--space-4)',
          backgroundColor: 'var(--surface-canvas-subtle)',
          borderRadius: 'var(--radius-bento-card)',
          padding: 'var(--space-8)',
          border: '1px solid var(--surface-border-subtle)',
        }}
      >
        <div style={{ fontSize: '2rem' }}>⚡</div>
        <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 700, color: 'var(--text-primary)' }}>
          Compiling Biomechanical Session Data...
        </h3>
        <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
          Retrieving persisted telemetry from CometChat session: <strong>{sessionId}</strong>
        </span>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={springPresets.layout}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-6)',
        width: '100%',
        color: 'var(--text-primary)',
      }}
    >
      {/* Header & Return Navigation */}
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
                fontSize: '1.375rem',
                fontWeight: 800,
                letterSpacing: '-0.02em',
                margin: 0,
              }}
            >
              Post-Workout Biomechanical Summary
            </h2>
            <span
              style={{
                fontSize: '0.6875rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                padding: 'var(--space-0-5) var(--space-2)',
                borderRadius: 'var(--radius-pill)',
                backgroundColor: 'color-mix(in srgb, var(--status-stable) 15%, transparent)',
                color: 'var(--status-stable)',
                border: '1px solid var(--status-stable)',
              }}
            >
              Session Complete
            </span>
          </div>
          <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
            Session ID: <strong>{sessionId}</strong> • Duration:{' '}
            <strong>{durationSec > 0 ? `${durationSec}s` : 'Active Session'}</strong>
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          {error && (
            <button
              type="button"
              onClick={fetchSessionHistory}
              style={{
                padding: 'var(--space-2) var(--space-4)',
                borderRadius: 'var(--radius-pill)',
                border: '1px solid var(--status-warning)',
                backgroundColor: 'color-mix(in srgb, var(--status-warning) 12%, transparent)',
                color: 'var(--status-warning)',
                fontSize: '0.8125rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Retry Fetch
            </button>
          )}

          {onBack && (
            <button
              type="button"
              onClick={onBack}
              style={{
                padding: 'var(--space-2) var(--space-5)',
                borderRadius: 'var(--radius-pill)',
                border: 'none',
                backgroundColor: 'var(--accent-lime)',
                color: 'var(--surface-dark-sidebar)',
                fontSize: '0.8125rem',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'opacity 0.15s ease',
              }}
            >
              ← Return to Live Studio
            </button>
          )}
        </div>
      </div>

      {/* Row 1: 4 Stat Cards in a Row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
          gap: 'var(--space-4)',
        }}
      >
        {statCards.map((card, index) => (
          <motion.div
            key={card.id}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...springPresets.snappy, delay: index * 0.05 }}
            style={{
              backgroundColor: 'var(--surface-canvas-subtle)',
              border: '1px solid var(--surface-border-subtle)',
              borderRadius: 'var(--radius-bento-card)',
              padding: 'var(--space-5)',
              boxShadow: 'var(--shadow-bento)',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-2)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                {card.label}
              </span>
              <span style={{ fontSize: '1.25rem' }}>{card.icon}</span>
            </div>
            <div
              style={{
                fontSize: '2rem',
                fontWeight: 800,
                letterSpacing: '-0.03em',
                color: 'var(--text-primary)',
              }}
            >
              {card.value}
            </div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500 }}>
              {card.detail}
            </span>
          </motion.div>
        ))}
      </div>

      {/* Row 2: Split Bento Grid (Timeline Left, Anchor Dark Card Right) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1.3fr) minmax(340px, 1fr)',
          gap: 'var(--space-6)',
          alignItems: 'stretch',
        }}
      >
        {/* Left Bento: Scrollable Timeline */}
        <div
          style={{
            backgroundColor: 'var(--surface-canvas-subtle)',
            border: '1px solid var(--surface-border-subtle)',
            borderRadius: 'var(--radius-bento-card)',
            padding: 'var(--space-6)',
            boxShadow: 'var(--shadow-bento)',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-4)',
            minHeight: '440px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontSize: '1.0625rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              Workout Event Timeline
            </h3>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>
              {summary.timeline.length} Events Logged
            </span>
          </div>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-3)',
              maxHeight: '480px',
              overflowY: 'auto',
              paddingRight: 'var(--space-2)',
            }}
          >
            {summary.timeline.length === 0 ? (
              <div
                style={{
                  padding: 'var(--space-10) var(--space-4)',
                  textAlign: 'center',
                  color: 'var(--text-muted)',
                  fontSize: '0.875rem',
                }}
              >
                No workout events were recorded during this session.
              </div>
            ) : (
              summary.timeline.map((event) => {
                let badgeBg = 'color-mix(in srgb, var(--status-stable) 12%, transparent)';
                let badgeBorder = 'var(--status-stable)';
                let badgeColor = 'var(--status-stable)';

                if (event.type === 'alert') {
                  badgeBg = 'color-mix(in srgb, var(--status-critical) 12%, transparent)';
                  badgeBorder = 'var(--status-critical)';
                  badgeColor = 'var(--status-critical)';
                } else if (event.type === 'cue') {
                  badgeBg = 'var(--accent-cyan-tint)';
                  badgeBorder = 'var(--accent-cyan)';
                  badgeColor = 'var(--accent-cyan)';
                } else if (event.type === 'session') {
                  badgeBg = 'var(--accent-lavender-tint)';
                  badgeBorder = 'var(--accent-lavender)';
                  badgeColor = 'var(--text-primary)';
                }

                return (
                  <div
                    key={event.id}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 'var(--space-3)',
                      padding: 'var(--space-3)',
                      borderRadius: 'var(--radius-control)',
                      backgroundColor: 'var(--surface-canvas)',
                      border: '1px solid var(--surface-border-subtle)',
                    }}
                  >
                    <span
                      style={{
                        padding: 'var(--space-0-5) var(--space-2)',
                        borderRadius: 'var(--radius-pill)',
                        backgroundColor: badgeBg,
                        border: `1px solid ${badgeBorder}`,
                        color: badgeColor,
                        fontSize: '0.6875rem',
                        fontWeight: 800,
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                        flexShrink: 0,
                      }}
                    >
                      {event.type}
                    </span>

                    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                          {event.title}
                        </span>
                        <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                          {new Date(event.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                        {event.detail}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Bento: Anchor Dark Card */}
        <div
          style={{
            backgroundColor: 'var(--surface-dark-card)',
            backgroundImage: HATCHED_TEXTURE_DATA_URI,
            backgroundRepeat: 'repeat',
            color: 'var(--text-on-dark-primary)',
            borderRadius: 'var(--radius-bento-card)',
            border: '1px solid var(--surface-dark-card-border)',
            padding: 'var(--space-6)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: 'var(--space-5)',
            boxShadow: 'var(--shadow-bento)',
          }}
        >
          {/* Top Label */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span
                style={{
                  fontSize: '0.6875rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  color: 'var(--text-on-dark-muted)',
                  fontWeight: 700,
                }}
              >
                Biomechanical Kinematics
              </span>
              <span
                style={{
                  fontSize: '0.6875rem',
                  color: 'var(--accent-lime)',
                  fontWeight: 600,
                }}
              >
                Threshold: {VALGUS_THRESHOLD_PCT}%
              </span>
            </div>
            <h3 style={{ margin: 'var(--space-1) 0 0 0', fontSize: '1.25rem', fontWeight: 800 }}>
              Form Quality & Valgus Analysis
            </h3>
          </div>

          {/* Valgus Peak & Luminous Breakdown Pills */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={{ fontSize: '0.8125rem', color: 'var(--text-on-dark-secondary)' }}>
                Max Valgus Deviation:
              </span>
              <span
                style={{
                  fontSize: '1.5rem',
                  fontWeight: 800,
                  color:
                    summary.maxValgusDevPct > VALGUS_THRESHOLD_PCT
                      ? 'var(--status-critical)'
                      : 'var(--status-stable)',
                }}
              >
                +{summary.maxValgusDevPct.toFixed(1)}%
              </span>
            </div>

            <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
              {/* Luminous Pill Left */}
              <div
                style={{
                  flex: 1,
                  padding: 'var(--space-2) var(--space-3)',
                  borderRadius: 'var(--radius-pill)',
                  backgroundColor: 'color-mix(in srgb, var(--status-critical) 16%, transparent)',
                  border: '1px solid var(--status-critical)',
                  boxShadow: '0 0 12px color-mix(in srgb, var(--status-critical) 40%, transparent)',
                  color: 'var(--text-on-dark-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                }}
              >
                <span>Left Knee</span>
                <span style={{ color: 'var(--status-critical)' }}>{summary.alertBreakdown.L} alerts</span>
              </div>

              {/* Luminous Pill Right */}
              <div
                style={{
                  flex: 1,
                  padding: 'var(--space-2) var(--space-3)',
                  borderRadius: 'var(--radius-pill)',
                  backgroundColor: 'color-mix(in srgb, var(--status-critical) 16%, transparent)',
                  border: '1px solid var(--status-critical)',
                  boxShadow: '0 0 12px color-mix(in srgb, var(--status-critical) 40%, transparent)',
                  color: 'var(--text-on-dark-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                }}
              >
                <span>Right Knee</span>
                <span style={{ color: 'var(--status-critical)' }}>{summary.alertBreakdown.R} alerts</span>
              </div>
            </div>
          </div>

          {/* Depth Distribution Bars */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            <span
              style={{
                fontSize: '0.6875rem',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: 'var(--text-on-dark-muted)',
                fontWeight: 700,
              }}
            >
              Squat Depth Distribution
            </span>

            {[
              { label: 'Deep (<80°)', count: summary.depthDistribution.deep, color: 'var(--status-stable)' },
              { label: 'Good (80-100°)', count: summary.depthDistribution.good, color: 'var(--accent-lime)' },
              { label: 'Shallow (>100°)', count: summary.depthDistribution.shallow, color: 'var(--status-warning)' },
            ].map((d) => {
              const pct = summary.totalReps > 0 ? (d.count / summary.totalReps) * 100 : 0;
              return (
                <div key={d.label} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.6875rem' }}>
                    <span style={{ color: 'var(--text-on-dark-secondary)' }}>{d.label}</span>
                    <span style={{ color: 'var(--text-on-dark-primary)', fontWeight: 600 }}>
                      {d.count} ({Math.round(pct)}%)
                    </span>
                  </div>
                  <div
                    style={{
                      height: '6px',
                      borderRadius: 'var(--radius-pill)',
                      backgroundColor: 'color-mix(in srgb, var(--text-on-dark-primary) 10%, transparent)',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        height: '100%',
                        width: `${pct}%`,
                        backgroundColor: d.color,
                        borderRadius: 'var(--radius-pill)',
                        transition: 'width 0.4s ease',
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Tempo Distribution Badges */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            <span
              style={{
                fontSize: '0.6875rem',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: 'var(--text-on-dark-muted)',
                fontWeight: 700,
              }}
            >
              Tempo Cadence
            </span>
            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              {[
                { label: 'Fast (<1.2s)', count: summary.tempoDistribution.fast },
                { label: 'Controlled (1.2-3.5s)', count: summary.tempoDistribution.controlled },
                { label: 'Slow (>3.5s)', count: summary.tempoDistribution.slow },
              ].map((tempo) => (
                <div
                  key={tempo.label}
                  style={{
                    flex: 1,
                    padding: 'var(--space-2)',
                    borderRadius: 'var(--radius-control)',
                    backgroundColor: 'color-mix(in srgb, var(--text-on-dark-primary) 5%, transparent)',
                    border: '1px solid var(--surface-dark-card-border)',
                    textAlign: 'center',
                  }}
                >
                  <div style={{ fontSize: '0.875rem', fontWeight: 800, color: 'var(--accent-lime)' }}>
                    {tempo.count}
                  </div>
                  <div style={{ fontSize: '0.625rem', color: 'var(--text-on-dark-muted)', marginTop: '2px' }}>
                    {tempo.label.split(' ')[0]}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default Summary;
