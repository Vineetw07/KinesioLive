import React, { useRef, useEffect } from 'react';
import type { SpikeLogEntry } from '../types';

interface TelemetryLogConsoleProps {
  logs: SpikeLogEntry[];
  onClear?: () => void;
  maxEntries?: number;
}

export const TelemetryLogConsole: React.FC<TelemetryLogConsoleProps> = ({
  logs,
  onClear,
}) => {
  const consoleRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (consoleRef.current) {
      consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
    }
  }, [logs]);

  const formatTimestamp = (ts: number) => {
    const d = new Date(ts);
    return `${d.toLocaleTimeString()}.${String(d.getMilliseconds()).padStart(3, '0')}`;
  };

  const getLevelColor = (level: SpikeLogEntry['level']) => {
    switch (level) {
      case 'success':
        return 'var(--accent-emerald)';
      case 'warn':
        return 'var(--accent-amber)';
      case 'error':
        return 'var(--accent-rose)';
      default:
        return 'var(--accent-cyan)';
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span className="kine-stat-label" style={{ fontSize: '0.75rem', fontWeight: 600 }}>
          Real-Time Telemetry & Event Console ({logs.length} events)
        </span>
        {onClear && (
          <button
            type="button"
            className="kine-button kine-button-secondary"
            style={{ padding: '0.25rem 0.5rem', fontSize: '0.7rem' }}
            onClick={onClear}
          >
            Clear Log
          </button>
        )}
      </div>

      <div ref={consoleRef} className="kine-log-console">
        {logs.length === 0 ? (
          <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>
            Telemetry stream idle. Trigger a spike runner to stream events.
          </span>
        ) : (
          logs.map((log) => (
            <div key={log.id} className={`kine-log-entry kine-log-${log.level}`}>
              <span className="kine-log-time">{formatTimestamp(log.timestamp)}</span>
              <span
                className="kine-log-badge"
                style={{ color: getLevelColor(log.level) }}
              >
                [{log.spikeId.toUpperCase()}]
              </span>
              <span className="kine-log-msg">{log.message}</span>
              {log.details && (
                <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>
                  {JSON.stringify(log.details)}
                </span>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default TelemetryLogConsole;
