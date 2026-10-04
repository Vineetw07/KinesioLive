import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Target System Under Test (SUT)
import { CallsJoinRunner, type CallsJoinOptions } from '../../client/src/spikes/s3-calls/callsRunner';
import {
  PersistenceBenchmarkRunner,
  type CustomMessageBurstOptions,
} from '../../client/src/spikes/s4-custom/persistenceRunner';
import { requestSession, checkBackendHealth } from '../../client/src/spikes/utils/tokenService';
import type { SessionResponse } from '../../shared/src/index.js';

// Mock States for CometChat SDKs (configured via vitest resolve.alias)
import { callsMockState, CometChatCalls } from '../mocks/calls-sdk';
import { chatMockState, CometChat, MockCustomMessage } from '../mocks/chat-sdk';

describe('Challenger 2 Empirical Stress Suite: S3 Calls v5 & S4 Persistence Contract', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    callsMockState.reset();
    chatMockState.reset();

    // Default mock fetch responding to /api/session and /api/health
    globalThis.fetch = vi.fn().mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('/api/session')) {
        const body = init?.body ? JSON.parse(String(init.body)) : {};
        const role = body.role || 'clinician';
        const uid = role === 'clinician' ? 'dr-demo' : 'pt-demo';
        const sessionId = body.sessionId || `kine-${Date.now()}`;
        const resp: SessionResponse = {
          sessionId,
          authToken: `mock_auth_token_${uid}_${sessionId.slice(0, 8)}`,
          uid,
          appId: 'mock_app_id_alpha',
          region: 'IN',
        };
        return {
          ok: true,
          status: 200,
          json: async () => resp,
        } as unknown as Response;
      }
      if (url.includes('/api/health')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ status: 'ok', uptime: 120, timestamp: Date.now() }),
        } as unknown as Response;
      }
      return {
        ok: false,
        status: 404,
        json: async () => ({ error: 'Not found' }),
      } as unknown as Response;
    });
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  // =========================================================================
  // SECTION 1: SPIKE S3 CALLS V5 LOGIC & ROLE-BASED AUDIO MUTING
  // =========================================================================

  describe('Spike S3: Calls v5 startAudioMuted & Role Separation Invariant', () => {
    it('S3-CHALLENGE.1: Clinician role strictly enforces startAudioMuted: true to prevent acoustic feedback', async () => {
      const runner = new CallsJoinRunner();
      const mockContainer = { tagName: 'DIV' } as unknown as HTMLElement;
      const logs: Array<{ level: string; msg: string }> = [];

      const metrics = await runner.joinCall({
        role: 'clinician',
        sessionId: 'kine-s3-clinician-room',
        containerElement: mockContainer,
        onLog: (level, msg) => logs.push({ level, msg }),
      });

      // Assert joinSession received startAudioMuted: true
      expect(callsMockState.joinSessionSpy).toHaveBeenCalledTimes(1);
      const [tokenArg, settingsArg, containerArg] = callsMockState.joinSessionSpy.mock.calls[0]!;

      expect(tokenArg).toBe('mock_call_token_for_kine-s3-clinician-room');
      expect(settingsArg.startAudioMuted).toBe(true);
      expect(settingsArg.sessionType).toBe('VIDEO');
      expect(settingsArg.layout).toBe('TILE');
      expect(containerArg).toBe(mockContainer);

      // Verify SessionSettings parameters completeness
      expect(settingsArg.startVideoPaused).toBe(false);
      expect(settingsArg.hideControlPanel).toBe(false);
      expect(settingsArg.idleTimeoutPeriodBeforePrompt).toBe(60000);
      expect(settingsArg.idleTimeoutPeriodAfterPrompt).toBe(180000);

      // Assert returned metrics match S3CallsMetrics contract
      expect(metrics.role).toBe('clinician');
      expect(metrics.uid).toBe('dr-demo');
      expect(metrics.audioMuted).toBe(true);
      expect(metrics.videoConnected).toBe(true);
      expect(metrics.containerRendered).toBe(true);
      expect(metrics.pass).toBe(true);
      expect(runner.getIsConnected()).toBe(true);

      // Verify teardown
      runner.leaveCall();
      expect(callsMockState.leaveSessionSpy).toHaveBeenCalledTimes(1);
      expect(runner.getIsConnected()).toBe(false);
    });

    it('S3-CHALLENGE.2: Patient role strictly enforces startAudioMuted: false for two-way coaching audio', async () => {
      const runner = new CallsJoinRunner();
      const mockContainer = { tagName: 'DIV' } as unknown as HTMLElement;

      const metrics = await runner.joinCall({
        role: 'patient',
        sessionId: 'kine-s3-patient-room',
        containerElement: mockContainer,
      });

      expect(callsMockState.joinSessionSpy).toHaveBeenCalledTimes(1);
      const [, settingsArg] = callsMockState.joinSessionSpy.mock.calls[0]!;

      expect(settingsArg.startAudioMuted).toBe(false);
      expect(metrics.role).toBe('patient');
      expect(metrics.uid).toBe('pt-demo');
      expect(metrics.audioMuted).toBe(false);
      expect(metrics.pass).toBe(true);
    });

    it('S3-CHALLENGE.3: Connection latency timer measures duration and strictly enforces < 3000 ms threshold', async () => {
      const runner = new CallsJoinRunner();
      const mockContainer = { tagName: 'DIV' } as unknown as HTMLElement;

      // Fast connection (< 3.0s) -> PASS
      const metricsFast = await runner.joinCall({
        role: 'clinician',
        sessionId: 'kine-fast-session',
        containerElement: mockContainer,
      });
      expect(metricsFast.connectLatencyMs).toBeGreaterThanOrEqual(0);
      expect(metricsFast.connectLatencyMs).toBeLessThan(3000);
      expect(metricsFast.pass).toBe(true);

      // Simulate a connection latency exceeding 3000ms boundary -> FAIL
      let callCount = 0;
      vi.spyOn(performance, 'now').mockImplementation(() => {
        callCount++;
        // First call: startConnectTime (1000ms), second call: completion (4200ms)
        return callCount === 1 ? 1000 : 4200;
      });

      const metricsSlow = await runner.joinCall({
        role: 'patient',
        sessionId: 'kine-slow-session',
        containerElement: mockContainer,
      });

      expect(metricsSlow.connectLatencyMs).toBe(3200);
      expect(metricsSlow.connectLatencyMs).toBeGreaterThanOrEqual(3000);
      expect(metricsSlow.pass).toBe(false);

      vi.spyOn(performance, 'now').mockRestore();
    });

    it('S3-CHALLENGE.4: Join session error propagation rejects promise without leaving zombie connection state', async () => {
      const runner = new CallsJoinRunner();
      const mockContainer = { tagName: 'DIV' } as unknown as HTMLElement;

      callsMockState.joinSessionSpy.mockResolvedValueOnce({
        error: { code: 'ERR_CALL_REJECTED', message: 'Room capacity full' },
      });

      await expect(
        runner.joinCall({
          role: 'clinician',
          sessionId: 'kine-error-session',
          containerElement: mockContainer,
        })
      ).rejects.toThrow(/Failed to join call session/);

      expect(runner.getIsConnected()).toBe(false);
    });

    it('S3-CHALLENGE.5: Event listener registration collects unsubs and leaveCall teardown is idempotent', async () => {
      const runner = new CallsJoinRunner();
      const mockContainer = { tagName: 'DIV' } as unknown as HTMLElement;

      await runner.joinCall({
        role: 'clinician',
        containerElement: mockContainer,
      });

      // Verify listeners registered
      expect(callsMockState.eventListeners['onSessionJoined']?.length).toBeGreaterThanOrEqual(1);
      expect(callsMockState.eventListeners['onSessionLeft']?.length).toBeGreaterThanOrEqual(1);
      expect(callsMockState.eventListeners['onConnectionFailed']?.length).toBeGreaterThanOrEqual(1);

      expect(runner.getIsConnected()).toBe(true);

      // First call to leaveCall: executes teardown
      runner.leaveCall();
      expect(runner.getIsConnected()).toBe(false);
      expect(callsMockState.leaveSessionSpy).toHaveBeenCalledTimes(1);

      // Second call to leaveCall: idempotent no-op
      expect(() => runner.leaveCall()).not.toThrow();
      expect(callsMockState.leaveSessionSpy).toHaveBeenCalledTimes(1);
    });
  });

  // =========================================================================
  // SECTION 2: SESSION TOKEN SERVICE & HTTP FAULT TOLERANCE
  // =========================================================================

  describe('Spike S3: Token Service (POST /api/session) Robustness & Error Handling', () => {
    it('S3-TOKEN.1: Dispatches sanitized payload with whitespace trimming on sessionId', async () => {
      const res = await requestSession('clinician', '   kine-padded-room-42   ');
      expect(res.sessionId).toBe('kine-padded-room-42');
      expect(res.uid).toBe('dr-demo');

      const calledBody = JSON.parse((globalThis.fetch as any).mock.calls[0][1].body);
      expect(calledBody.sessionId).toBe('kine-padded-room-42');
      expect(calledBody.role).toBe('clinician');
    });

    it('S3-TOKEN.2: Empty or whitespace-only sessionId converts to undefined for backend auto-generation', async () => {
      await requestSession('patient', '     ');
      const calledBody = JSON.parse((globalThis.fetch as any).mock.calls[0][1].body);
      expect(calledBody.sessionId).toBeUndefined();
      expect(calledBody.role).toBe('patient');
    });

    it('S3-TOKEN.3: Server HTTP 500 JSON error body is surfaced cleanly in exception message', async () => {
      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error: 'CometChat REST Service Unavailable (503)' }),
      } as unknown as Response);

      await expect(requestSession('clinician')).rejects.toThrow(
        'CometChat REST Service Unavailable (503)'
      );
    });

    it('S3-TOKEN.4: Server non-JSON crash (e.g. proxy HTML 502/504) falls back safely without unhandled JSON parse crash', async () => {
      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 502,
        json: async () => {
          throw new SyntaxError('Unexpected token < in JSON at position 0');
        },
      } as unknown as Response);

      await expect(requestSession('patient')).rejects.toThrow(
        'Session minting failed with HTTP status 502'
      );
    });

    it('S3-TOKEN.5: Network disconnection / offline rejection propagates predictably', async () => {
      globalThis.fetch = vi.fn().mockRejectedValueOnce(new TypeError('Failed to fetch'));

      await expect(requestSession('clinician')).rejects.toThrow('Failed to fetch');
    });

    it('S3-TOKEN.6: checkBackendHealth returns true on 200 and false on network failure without throwing', async () => {
      const healthy = await checkBackendHealth();
      expect(healthy).toBe(true);

      globalThis.fetch = vi.fn().mockRejectedValueOnce(new Error('Network connection refused'));
      const degraded = await checkBackendHealth();
      expect(degraded).toBe(false);
    });
  });

  // =========================================================================
  // SECTION 3: SPIKE S4 CUSTOM MESSAGE BURST GENERATION (25 MESSAGES)
  // =========================================================================

  describe('Spike S4: Custom Message Burst Generator (25 Messages) Specification', () => {
    it('S4-CHALLENGE.1: Generates exactly 25 custom messages with tripartite type distribution', async () => {
      const runner = new PersistenceBenchmarkRunner();
      const progressTracker: Array<{ sent: number; total: number }> = [];

      const { metrics, messages } = await runner.runPersistenceTest({
        burstCount: 25,
        onProgress: (sent, total) => progressTracker.push({ sent, total }),
      });

      // Verify exactly 25 messages sent
      expect(chatMockState.sentMessages.length).toBe(25);
      expect(progressTracker.length).toBe(25);
      expect(progressTracker[24]).toEqual({ sent: 25, total: 25 });

      // Count occurrences of each type
      const repMessages = chatMockState.sentMessages.filter((m) => m.getType() === 'kine.rep');
      const alertMessages = chatMockState.sentMessages.filter((m) => m.getType() === 'kine.alert');
      const cueMessages = chatMockState.sentMessages.filter((m) => m.getType() === 'kine.cue');

      // Distribution for burstCount = 25:
      // i % 3 === 1 (9 times): rep
      // i % 3 === 2 (8 times): alert
      // i % 3 === 0 (8 times): cue
      expect(repMessages.length).toBe(9);
      expect(alertMessages.length).toBe(8);
      expect(cueMessages.length).toBe(8);
      expect(repMessages.length + alertMessages.length + cueMessages.length).toBe(25);

      // Verify all 3 types are recorded in metrics
      expect(metrics.sentCount).toBe(25);
      expect(metrics.retrievedCount).toBe(25);
      expect(metrics.messageTypesRetrieved).toContain('kine.rep');
      expect(metrics.messageTypesRetrieved).toContain('kine.alert');
      expect(metrics.messageTypesRetrieved).toContain('kine.cue');
      expect(messages.length).toBe(25);
    });

    it('S4-CHALLENGE.2: Enforces RECEIVER_TYPE.GROUP and shouldUpdateConversation(false) on all 25 messages', async () => {
      const runner = new PersistenceBenchmarkRunner();

      await runner.runPersistenceTest({ burstCount: 25 });

      expect(chatMockState.sentMessages.length).toBe(25);
      for (const sentMsg of chatMockState.sentMessages) {
        expect(sentMsg.getReceiverType()).toBe('group');
        expect(sentMsg.getShouldUpdateConversation()).toBe(false);
      }
    });

    it('S4-CHALLENGE.3: Validates payload schemas for kine.rep, kine.alert, and kine.cue messages', async () => {
      const runner = new PersistenceBenchmarkRunner();

      await runner.runPersistenceTest({ burstCount: 6 });

      const messages = chatMockState.sentMessages;

      // Message 1: kine.rep
      const rep = messages[0].getCustomData();
      expect(rep.type).toBe('kine.rep');
      expect(rep.v).toBe(1);
      expect(typeof rep.minKneeDeg).toBe('number');
      expect(typeof rep.durMs).toBe('number');
      expect(typeof rep.n).toBe('number');
      expect(rep.depth).toBe('good');

      // Message 2: kine.alert
      const alert = messages[1].getCustomData();
      expect(alert.type).toBe('kine.alert');
      expect(alert.kind).toBe('knee_valgus');
      expect(alert.side).toBe('L');
      expect(typeof alert.value).toBe('number');
      expect(typeof alert.thresholdPct).toBe('number');

      // Message 3: kine.cue
      const cue = messages[2].getCustomData();
      expect(cue.type).toBe('kine.cue');
      expect(cue.cue).toBeDefined();
      expect(typeof cue.text).toBe('string');
      expect(cue.text).toContain('Clinician Cue:');
    });
  });

  // =========================================================================
  // SECTION 4: SPIKE S4 CHRONOLOGICAL MONOTONICITY & QUERY PARAMETERS
  // =========================================================================

  describe('Spike S4: Chronological Monotonicity Oracle & MessagesRequestBuilder Parameters', () => {
    it('S4-CHALLENGE.4: MessagesRequestBuilder executes with uppercase setGUID, category "custom", and limit >= 30', async () => {
      const runner = new PersistenceBenchmarkRunner();

      await runner.runPersistenceTest({ sessionId: 'kine-query-guid-check', burstCount: 25 });

      const config = chatMockState.capturedQueryConfig;
      expect(config).toBeDefined();
      expect(config.guid).toBe('kine-query-guid-check');
      expect(config.categories).toEqual(['custom']);
      expect(config.limit).toBeGreaterThanOrEqual(30);
    });

    it('S4-CHALLENGE.5: Chronological monotonicity passes when timestamps are strictly ascending (t1 < t2 < ...)', async () => {
      const runner = new PersistenceBenchmarkRunner();
      const baseTime = 1700000000000;

      // Mock messages returned with strictly ascending timestamps
      chatMockState.customFetchPrevious = async () => {
        return Array.from({ length: 25 }, (_, idx) => {
          const msg = new MockCustomMessage('kine-room', 'group', 'kine.rep', { type: 'kine.rep' });
          msg.setSentAt(baseTime + idx * 100);
          return msg;
        });
      };

      const { metrics } = await runner.runPersistenceTest({ burstCount: 25 });
      expect(metrics.chronologicalMatch).toBe(true);
      expect(metrics.retrievedCount).toBe(25);
      expect(metrics.pass).toBe(true);
    });

    it('S4-CHALLENGE.6: Chronological monotonicity handles identical timestamps non-decreasingly (t_i == t_{i-1})', async () => {
      const runner = new PersistenceBenchmarkRunner();
      const baseTime = 1700000000000;

      // Clusters of identical timestamps in the same millisecond
      chatMockState.customFetchPrevious = async () => {
        return Array.from({ length: 25 }, (_, idx) => {
          const msg = new MockCustomMessage('kine-room', 'group', 'kine.rep', { type: 'kine.rep' });
          msg.setSentAt(baseTime + Math.floor(idx / 2) * 100);
          return msg;
        });
      };

      const { metrics } = await runner.runPersistenceTest({ burstCount: 25 });
      expect(metrics.chronologicalMatch).toBe(true);
      expect(metrics.pass).toBe(true);
    });

    it('S4-CHALLENGE.7: Adversarial out-of-order arrival correctly triggers chronologicalMatch: false and FAIL status', async () => {
      const runner = new PersistenceBenchmarkRunner();
      const baseTime = 1700000000000;

      // Invert timestamp on message #10 (simulating network inversion)
      chatMockState.customFetchPrevious = async () => {
        return Array.from({ length: 25 }, (_, idx) => {
          const msg = new MockCustomMessage('kine-room', 'group', 'kine.rep', { type: 'kine.rep' });
          if (idx === 10) {
            msg.setSentAt(baseTime + 50); // Inverted: earlier than index 9 which is at baseTime + 900
          } else {
            msg.setSentAt(baseTime + idx * 100);
          }
          return msg;
        });
      };

      const { metrics } = await runner.runPersistenceTest({ burstCount: 25 });
      expect(metrics.chronologicalMatch).toBe(false);
      expect(metrics.pass).toBe(false);
    });

    it('S4-CHALLENGE.8: Dropped messages (retrieval count < 25) correctly triggers pass: false', async () => {
      const runner = new PersistenceBenchmarkRunner();
      const baseTime = 1700000000000;

      // Only returns 24 messages (1 message lost)
      chatMockState.customFetchPrevious = async () => {
        return Array.from({ length: 24 }, (_, idx) => {
          const msg = new MockCustomMessage('kine-room', 'group', 'kine.rep', { type: 'kine.rep' });
          msg.setSentAt(baseTime + idx * 100);
          return msg;
        });
      };

      const { metrics } = await runner.runPersistenceTest({ burstCount: 25 });
      expect(metrics.retrievedCount).toBe(24);
      expect(metrics.targetCount).toBe(25);
      expect(metrics.pass).toBe(false);
    });
  });

  // =========================================================================
  // SECTION 5: CROSS-SPIKE INTEGRATION & SYSTEM COHESION
  // =========================================================================

  describe('Cross-Spike S3 x S4 Integration & Milestone D2.5 Readiness', () => {
    it('S3-S4-INT.1: S3 Calls v5 and S4 Persistence operate concurrently on the same session ID without interference', async () => {
      const s3Runner = new CallsJoinRunner();
      const s4Runner = new PersistenceBenchmarkRunner();
      const mockContainer = { tagName: 'DIV' } as unknown as HTMLElement;

      const sharedSessionId = 'kine-dual-active-session-alpha';

      // Execute S3 join and S4 persistence burst on the same session ID
      const s3Metrics = await s3Runner.joinCall({
        role: 'clinician',
        sessionId: sharedSessionId,
        containerElement: mockContainer,
      });

      const { metrics: s4Metrics } = await s4Runner.runPersistenceTest({
        sessionId: sharedSessionId,
        burstCount: 25,
      });

      expect(s3Metrics.pass).toBe(true);
      expect(s3Metrics.sessionId).toBe(sharedSessionId);
      expect(s3Metrics.audioMuted).toBe(true);

      expect(s4Metrics.pass).toBe(true);
      expect(s4Metrics.retrievedCount).toBe(25);
      expect(s4Metrics.chronologicalMatch).toBe(true);

      s3Runner.leaveCall();
    });
  });
});
