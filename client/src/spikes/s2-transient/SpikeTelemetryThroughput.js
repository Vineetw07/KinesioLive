import React, { useState, useRef, useEffect, useCallback } from 'react';
import { CometChat } from '@cometchat/chat-sdk-javascript';
import { TelemetryBenchmarkRunner } from './telemetryRunner';
import { requestSession } from '../utils/tokenService';
import BenchmarkMetricCard from '../components/BenchmarkMetricCard';
import SpikeStatusChip from '../components/SpikeStatusChip';
export const SpikeTelemetryThroughput = ({ onMetricsUpdate, onLog, onComplete, isAutoRun = false, }) => {
    const [status, setStatus] = useState('idle');
    const [targetCount, setTargetCount] = useState(600);
    const [sentCount, setSentCount] = useState(0);
    const [p50Latency, setP50Latency] = useState(0);
    const [p95Latency, setP95Latency] = useState(0);
    const [lossPct, setLossPct] = useState(0);
    const [effectiveHz, setEffectiveHz] = useState(0);
    const [sessionId, setSessionId] = useState('kine-s2-telemetry-bench');
    const [errorMessage, setErrorMessage] = useState(null);
    const runnerRef = useRef(null);
    const log = useCallback((level, message, details) => {
        onLog?.({ level, message, details });
    }, [onLog]);
    const runBenchmark = useCallback(async (countToRun = targetCount) => {
        setErrorMessage(null);
        setStatus('running');
        setSentCount(0);
        setP50Latency(0);
        setP95Latency(0);
        setLossPct(0);
        log('info', `Connecting to session for Spike S2 benchmark (${countToRun} messages @ 10 Hz)...`);
        try {
            // 1. Obtain authenticated session from server
            const session = await requestSession('patient', sessionId);
            setSessionId(session.sessionId);
            log('info', `Session verified: ${session.sessionId} (UID: ${session.uid})`);
            // 2. Initialize Chat SDK if needed
            const appSettings = new CometChat.AppSettingsBuilder()
                .subscribePresenceForAllUsers()
                .setRegion(session.region)
                .build();
            await CometChat.init(session.appId, appSettings);
            const loggedInUser = await CometChat.getLoggedinUser();
            if (!loggedInUser || loggedInUser.getUid() !== session.uid) {
                log('info', `Authenticating Chat SDK with server-minted token...`);
                await CometChat.login(session.authToken);
                log('success', `Logged in as ${session.uid}`);
            }
            // 3. Run Benchmark
            const runner = new TelemetryBenchmarkRunner();
            runnerRef.current = runner;
            const metrics = await runner.runBenchmark({
                sessionId: session.sessionId,
                targetCount: countToRun,
                onProgress: (sent, _total, currentLat) => {
                    setSentCount(sent);
                    setP95Latency(Math.round(currentLat * 10) / 10);
                },
                onLog: (level, msg) => log(level, msg),
            });
            setP50Latency(metrics.p50LatencyMs);
            setP95Latency(metrics.p95LatencyMs);
            setLossPct(metrics.lossPct);
            setEffectiveHz(metrics.effectiveHz);
            setStatus(metrics.pass ? 'pass' : 'fail');
            onMetricsUpdate?.(metrics);
            onComplete?.(metrics);
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            setErrorMessage(msg);
            setStatus('fail');
            log('error', `Spike S2 execution failed: ${msg}`);
        }
        finally {
            runnerRef.current = null;
        }
    }, [sessionId, targetCount, log, onMetricsUpdate, onComplete]);
    const stopBenchmark = () => {
        if (runnerRef.current) {
            runnerRef.current.stop();
            runnerRef.current = null;
        }
        setStatus('idle');
        log('info', 'Telemetry benchmark stopped by user');
    };
    useEffect(() => {
        if (isAutoRun && status === 'idle') {
            // In auto-run mode, execute quick burst of 100 packets to validate fast without waiting full 60s
            runBenchmark(100);
        }
    }, [isAutoRun, status, runBenchmark]);
    useEffect(() => {
        return () => {
            if (runnerRef.current) {
                runnerRef.current.stop();
                runnerRef.current = null;
            }
        };
    }, []);
    const progressPct = targetCount > 0 ? Math.min(100, Math.round((sentCount / targetCount) * 100)) : 0;
    return (<div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* S2 Header & Controls */}
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
              Spike S2 (D2.3): 10 Hz Transient Telemetry
            </h3>
            <SpikeStatusChip status={status}/>
          </div>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
            10 Hz token-bucket rate limiter transmitting kine.pose messages via CometChat.sendTransientMessage.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {/* Burst size selector */}
          <select className="kine-input" style={{ width: 'auto', padding: '0.5rem 0.75rem' }} value={targetCount} onChange={(e) => setTargetCount(Number(e.target.value))} disabled={status === 'running'}>
            <option value={600}>Full Benchmark (600 pkts / 60s)</option>
            <option value={100}>Validation Burst (100 pkts / 10s)</option>
            <option value={50}>Fast Smoke (50 pkts / 5s)</option>
          </select>

          {status !== 'running' ? (<button type="button" className="kine-btn-run-all" onClick={() => runBenchmark(targetCount)}>
              ▶ Start 10 Hz Burst
            </button>) : (<button type="button" className="kine-button kine-button-secondary" onClick={stopBenchmark}>
              Halt Burst
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

      {/* Progress Bar */}
      {status === 'running' && (<div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            <span>Transmitting packets... ({sentCount} / {targetCount})</span>
            <span>{progressPct}%</span>
          </div>
          <div className="kine-progress-bar-wrap">
            <div className="kine-progress-bar-fill" style={{ width: `${progressPct}%` }}/>
          </div>
        </div>)}

      {/* Metrics Row */}
      <div className="kine-metric-grid">
        <BenchmarkMetricCard title="Packets Sent" value={`${sentCount} / ${targetCount}`} threshold={`${targetCount} Packets`} status={status === 'idle' ? 'idle' : sentCount >= targetCount ? 'pass' : 'running'} subtext={`Rate: ${effectiveHz.toFixed(1)} Hz (Token Bucket 100ms)`}/>
        <BenchmarkMetricCard title="p95 Transit Latency" value={p95Latency.toFixed(1)} unit="ms" threshold="< 400.0 ms" status={status === 'idle' ? 'idle' : p95Latency < 400 ? 'pass' : 'fail'} subtext={`p50 Median: ${p50Latency.toFixed(1)} ms`}/>
        <BenchmarkMetricCard title="Packet Loss Rate" value={lossPct.toFixed(2)} unit="%" threshold="< 2.0%" status={status === 'idle' ? 'idle' : lossPct < 2.0 ? 'pass' : 'fail'}/>
        <BenchmarkMetricCard title="Transmission Channel" value="Transient" unit="In-Memory" status="idle" subtext="CometChat.sendTransientMessage (Zero DB Writes)"/>
      </div>
    </div>);
};
export default SpikeTelemetryThroughput;
