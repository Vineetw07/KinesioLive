import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import './spikes.css';
import SpikeStatusChip from './components/SpikeStatusChip';
import KillSwitchGateTable from './components/KillSwitchGateTable';
import TelemetryLogConsole from './components/TelemetryLogConsole';
import SpikePoseInference from './s1-pose/SpikePoseInference';
import SpikeTelemetryThroughput from './s2-transient/SpikeTelemetryThroughput';
import SpikeCallsJoin from './s3-calls/SpikeCallsJoin';
import SpikePersistenceFetch from './s4-custom/SpikePersistenceFetch';
export const SpikesHarness = ({ onNavigateHome }) => {
    const [activeTab, setActiveTab] = useState('overview');
    const [statuses, setStatuses] = useState({
        s1: 'idle',
        s2: 'idle',
        s3: 'idle',
        s4: 'idle',
    });
    const [metrics, setMetrics] = useState({});
    const [logs, setLogs] = useState([]);
    const [isRunningAll, setIsRunningAll] = useState(false);
    const [autoRunSpike, setAutoRunSpike] = useState(null);
    const addLog = useCallback((spikeId, level, message, details) => {
        const entry = {
            id: `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            timestamp: Date.now(),
            spikeId,
            level,
            message,
            details,
        };
        setLogs((prev) => [...prev.slice(-150), entry]);
    }, []);
    const updateStatus = (spike, status) => {
        setStatuses((prev) => ({ ...prev, [spike]: status }));
    };
    const handleS1Metrics = useCallback((s1) => {
        setMetrics((prev) => ({ ...prev, s1 }));
        updateStatus('s1', s1.pass ? 'pass' : 'fail');
    }, []);
    const handleS2Metrics = useCallback((s2) => {
        setMetrics((prev) => ({ ...prev, s2 }));
        updateStatus('s2', s2.pass ? 'pass' : 'fail');
    }, []);
    const handleS3Metrics = useCallback((s3) => {
        setMetrics((prev) => ({ ...prev, s3 }));
        updateStatus('s3', s3.pass ? 'pass' : 'fail');
    }, []);
    const handleS4Metrics = useCallback((s4) => {
        setMetrics((prev) => ({ ...prev, s4 }));
        updateStatus('s4', s4.pass ? 'pass' : 'fail');
    }, []);
    // Master Test Runner: Sequentially executes all spikes for D2.5 formal sign-off
    const handleRunAll = async () => {
        if (isRunningAll)
            return;
        setIsRunningAll(true);
        addLog('system', 'info', '=== STARTING MASTER RUNNER: SPIKES S1 - S4 ===');
        // Reset statuses
        setStatuses({ s1: 'running', s2: 'running', s3: 'running', s4: 'running' });
        try {
            // 1. Run S1
            setActiveTab('s1');
            addLog('system', 'info', 'Step 1/4: Executing Spike S1 (MediaPipe Pose Inference)...');
            setAutoRunSpike('s1-pose');
            // Wait for S1 to conclude (6 seconds + buffer)
            await new Promise((resolve) => setTimeout(resolve, 7000));
            setAutoRunSpike(null);
            // 2. Run S2
            setActiveTab('s2');
            addLog('system', 'info', 'Step 2/4: Executing Spike S2 (10 Hz Transient Telemetry)...');
            setAutoRunSpike('s2-telemetry');
            await new Promise((resolve) => setTimeout(resolve, 11000));
            setAutoRunSpike(null);
            // 3. Run S3
            setActiveTab('s3');
            addLog('system', 'info', 'Step 3/4: Executing Spike S3 (Calls v5 Session Join)...');
            setAutoRunSpike('s3-calls');
            await new Promise((resolve) => setTimeout(resolve, 5000));
            setAutoRunSpike(null);
            // 4. Run S4
            setActiveTab('s4');
            addLog('system', 'info', 'Step 4/4: Executing Spike S4 (Custom Persistence Fetch)...');
            setAutoRunSpike('s4-persistence');
            await new Promise((resolve) => setTimeout(resolve, 6000));
            setAutoRunSpike(null);
            // 5. Conclude & Return to Overview Gate
            setActiveTab('overview');
            addLog('system', 'success', '=== MASTER RUNNER COMPLETE: EVALUATING GATE STATUS ===');
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            addLog('system', 'error', `Master runner failed: ${msg}`);
        }
        finally {
            setIsRunningAll(false);
            setAutoRunSpike(null);
        }
    };
    const handleResetAll = () => {
        setStatuses({ s1: 'idle', s2: 'idle', s3: 'idle', s4: 'idle' });
        setMetrics({});
        setLogs([]);
        setAutoRunSpike(null);
        setIsRunningAll(false);
        addLog('system', 'info', 'Testbed state and benchmarks reset');
    };
    return (<div className="kine-spikes-root">
      {/* Master Action & Navigation Bar */}
      <div className="kine-master-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              ⚡ Spikes Testbed &amp; Benchmarks
            </h2>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Milestones D2.1 – D2.5 | MediaPipe Pose &amp; CometChat Calls v5
            </span>
          </div>

          <div style={{ display: 'flex', gap: '0.4rem', marginLeft: '0.5rem' }}>
            <SpikeStatusChip status={statuses.s1} label={`S1: ${statuses.s1.toUpperCase()}`}/>
            <SpikeStatusChip status={statuses.s2} label={`S2: ${statuses.s2.toUpperCase()}`}/>
            <SpikeStatusChip status={statuses.s3} label={`S3: ${statuses.s3.toUpperCase()}`}/>
            <SpikeStatusChip status={statuses.s4} label={`S4: ${statuses.s4.toUpperCase()}`}/>
          </div>
        </div>

        <div className="kine-master-actions">
          <button type="button" className="kine-btn-run-all" onClick={handleRunAll} disabled={isRunningAll}>
            {isRunningAll ? 'Executing All Spikes...' : '▶ Run All Spikes'}
          </button>

          <button type="button" className="kine-btn-reset" onClick={handleResetAll} disabled={isRunningAll}>
            ↺ Reset All
          </button>

          {onNavigateHome && (<button type="button" className="kine-btn-reset" onClick={onNavigateHome} title="Return to Live Session View">
              ← Back to Live Session
            </button>)}
        </div>
      </div>

      {/* Tabs Navigation */}
      <nav className="kine-tabs">
        <button type="button" className={`kine-tab-btn ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}>
          📋 Overview &amp; Gate
        </button>
        <button type="button" className={`kine-tab-btn ${activeTab === 's1' ? 'active' : ''}`} onClick={() => setActiveTab('s1')}>
          🧘 S1: Pose Landmarker
        </button>
        <button type="button" className={`kine-tab-btn ${activeTab === 's2' ? 'active' : ''}`} onClick={() => setActiveTab('s2')}>
          ⚡ S2: 10 Hz Telemetry
        </button>
        <button type="button" className={`kine-tab-btn ${activeTab === 's3' ? 'active' : ''}`} onClick={() => setActiveTab('s3')}>
          📞 S3: Calls v5 Join
        </button>
        <button type="button" className={`kine-tab-btn ${activeTab === 's4' ? 'active' : ''}`} onClick={() => setActiveTab('s4')}>
          💾 S4: Custom Persistence
        </button>
      </nav>

      {/* Active Tab View */}
      <AnimatePresence mode="wait">
        <motion.div key={activeTab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
          {activeTab === 'overview' && (<div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <KillSwitchGateTable metrics={metrics} statuses={statuses} onRunAll={handleRunAll} isRunningAll={isRunningAll}/>
            </div>)}

          {activeTab === 's1' && (<SpikePoseInference onMetricsUpdate={handleS1Metrics} onLog={(entry) => addLog('s1-pose', entry.level, entry.message, entry.details)} isAutoRun={autoRunSpike === 's1-pose'}/>)}

          {activeTab === 's2' && (<SpikeTelemetryThroughput onMetricsUpdate={handleS2Metrics} onLog={(entry) => addLog('s2-telemetry', entry.level, entry.message, entry.details)} isAutoRun={autoRunSpike === 's2-telemetry'}/>)}

          {activeTab === 's3' && (<SpikeCallsJoin onMetricsUpdate={handleS3Metrics} onLog={(entry) => addLog('s3-calls', entry.level, entry.message, entry.details)} isAutoRun={autoRunSpike === 's3-calls'}/>)}

          {activeTab === 's4' && (<SpikePersistenceFetch onMetricsUpdate={handleS4Metrics} onLog={(entry) => addLog('s4-persistence', entry.level, entry.message, entry.details)} isAutoRun={autoRunSpike === 's4-persistence'}/>)}
        </motion.div>
      </AnimatePresence>

      {/* Shared Real-Time Telemetry & Event Console */}
      <div style={{ marginTop: '0.5rem' }}>
        <TelemetryLogConsole logs={logs} onClear={() => setLogs([])}/>
      </div>
    </div>);
};
export default SpikesHarness;
