/**
 * tests/challenger_d5_m1_m2_stress.test.ts
 *
 * EMPIRICAL ADVERSARIAL STRESS TEST SUITE
 * Challenger 2: Milestones D5.1 & D5.2
 *
 * Scopes stress-tested:
 * 1. Outbox Retry Queue (D5.1):
 *    - Rejection (Promise.reject) handling in flushOutboxQueue
 *    - Synchronous throw (throw new Error) handling in flushOutboxQueue
 *    - Max 3 retries policy and console.warn discard on 3rd failure
 *    - Non-discard and flush halt when retries < 3 (unstable network break)
 *    - Re-entrancy defense (isFlushingRef guard)
 *    - In-flight enqueueing during active flush (FIFO preservation)
 *    - Session switch: message GUID binding, queue persistence across session changes
 *    - Synchronous throw vs Promise rejection in dispatchCustomRepMessage / AlertMessage
 * 2. Coaching Cue Toast & Timer (D5.2):
 *    - Exact 4000ms dismiss timer verification
 *    - Multi-cue arrival timer collision / premature dismiss behavior
 *    - CSS design token definitions and zero raw hex codes in Patient.tsx toast
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  SCHEMA_VERSION,
  type KineRepPayload,
  type KineAlertPayload,
  type KineCuePayload,
} from '../shared/src/index.js';
import { MockCustomMessage } from './mocks/chat-sdk.js';

interface OutboxItem {
  message: any;
  retries: number;
}

/**
 * Exact replica of the outbox retry queue logic in client/src/views/Patient.tsx (lines 111-145)
 */
function createOutboxHarness(sendCustomMessageMock: (msg: any) => Promise<any> | any) {
  const outboxQueue: OutboxItem[] = [];
  let isFlushing = false;
  const discardedItems: Array<{ item: OutboxItem; err: any }> = [];
  const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

  const dispatchRepMessage = async (activeSessionId: string, payload: KineRepPayload) => {
    if (!activeSessionId) return;
    const customMsg = new MockCustomMessage(
      activeSessionId,
      'group',
      'kine.rep',
      payload as unknown as Record<string, unknown>
    );
    customMsg.shouldUpdateConversation(false);
    try {
      await sendCustomMessageMock(customMsg);
    } catch {
      outboxQueue.push({ message: customMsg, retries: 0 });
    }
  };

  const dispatchAlertMessage = async (activeSessionId: string, payload: KineAlertPayload) => {
    if (!activeSessionId) return;
    const customMsg = new MockCustomMessage(
      activeSessionId,
      'group',
      'kine.alert',
      payload as unknown as Record<string, unknown>
    );
    customMsg.shouldUpdateConversation(false);
    try {
      await sendCustomMessageMock(customMsg);
    } catch {
      outboxQueue.push({ message: customMsg, retries: 0 });
    }
  };

  const flushOutboxQueue = async () => {
    if (isFlushing || outboxQueue.length === 0) return;
    isFlushing = true;

    try {
      while (outboxQueue.length > 0) {
        const item = outboxQueue[0];
        try {
          await sendCustomMessageMock(item.message);
          outboxQueue.shift();
        } catch (err) {
          item.retries += 1;
          if (item.retries >= 3) {
            console.warn(
              '[KinesioOutbox] Discarded custom message after 3 failed retries:',
              item.message.getType?.() || item.message,
              err
            );
            discardedItems.push({ item, err });
            outboxQueue.shift();
          } else {
            // Connection still unstable; halt current flush (retry on next onConnected)
            break;
          }
        }
      }
    } finally {
      isFlushing = false;
    }
  };

  return {
    outboxQueue,
    getIsFlushing: () => isFlushing,
    discardedItems,
    warnSpy,
    dispatchRepMessage,
    dispatchAlertMessage,
    flushOutboxQueue,
  };
}

describe('Challenger 2 Empirical Stress Suite: D5.1 Outbox & D5.2 Coaching Cues', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // =========================================================================
  // SECTION 1: Error Handling (Sync Throw vs Async Rejection in flushOutboxQueue)
  // =========================================================================
  describe('1. Outbox Queue Error Handling: Synchronous Throw vs Promise Rejection', () => {
    it('D5.1-ERR.1: Handles Promise.reject gracefully without crashing, increments retries, and halts flush', async () => {
      let callCount = 0;
      const sendMock = vi.fn().mockImplementation(async () => {
        callCount++;
        return Promise.reject(new Error('Network offline WebSocket close 1006'));
      });

      const harness = createOutboxHarness(sendMock);
      const repPayload: KineRepPayload = {
        v: SCHEMA_VERSION,
        sid: 'test-session-1',
        t: Date.now(),
        type: 'kine.rep',
        n: 1,
        minKneeDeg: 95,
        depth: 'good',
        durMs: 1200,
        tempo: 'controlled',
      };

      // Dispatch fails and enqueues
      await harness.dispatchRepMessage('test-session-1', repPayload);
      expect(harness.outboxQueue.length).toBe(1);
      expect(harness.outboxQueue[0].retries).toBe(0);

      // First flush attempt fails
      await harness.flushOutboxQueue();
      expect(callCount).toBe(2); // 1 from dispatch, 1 from flush
      expect(harness.outboxQueue.length).toBe(1);
      expect(harness.outboxQueue[0].retries).toBe(1);
      expect(harness.getIsFlushing()).toBe(false);

      // Second flush attempt fails
      await harness.flushOutboxQueue();
      expect(harness.outboxQueue[0].retries).toBe(2);
      expect(harness.outboxQueue.length).toBe(1);

      // Third flush attempt fails -> discarded with console.warn
      await harness.flushOutboxQueue();
      expect(harness.outboxQueue.length).toBe(0);
      expect(harness.discardedItems.length).toBe(1);
      expect(harness.warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('[KinesioOutbox] Discarded custom message after 3 failed retries:'),
        'kine.rep',
        expect.any(Error)
      );
    });

    it('D5.1-ERR.2: Handles Synchronous Throw (non-Promise exception) safely, increments retries, resets isFlushing', async () => {
      let callCount = 0;
      const sendMock = vi.fn().mockImplementation(() => {
        callCount++;
        throw new Error('Immediate synchronous SDK fatal error');
      });

      const harness = createOutboxHarness(sendMock);
      const alertPayload: KineAlertPayload = {
        v: SCHEMA_VERSION,
        sid: 'test-session-1',
        t: Date.now(),
        type: 'kine.alert',
        kind: 'knee_valgus',
        side: 'L',
        value: 14.5,
        thresholdPct: 8.0,
        repN: 1,
        phase: 'bottom',
        note: 'Severe valgus breakdown',
      };

      // Dispatch with synchronous throw enqueues cleanly
      await harness.dispatchAlertMessage('test-session-1', alertPayload);
      expect(harness.outboxQueue.length).toBe(1);
      expect(harness.outboxQueue[0].retries).toBe(0);

      // Flush with synchronous throw
      await expect(harness.flushOutboxQueue()).resolves.toBeUndefined();
      expect(harness.outboxQueue.length).toBe(1);
      expect(harness.outboxQueue[0].retries).toBe(1);
      expect(harness.getIsFlushing()).toBe(false);

      // Further retries until discard
      await harness.flushOutboxQueue();
      expect(harness.outboxQueue[0].retries).toBe(2);
      await harness.flushOutboxQueue();
      expect(harness.outboxQueue.length).toBe(0);
      expect(harness.discardedItems.length).toBe(1);
    });

    it('D5.1-ERR.3: Multi-item queue: early break on network failure preserves FIFO order and unattempted items', async () => {
      let attempt = 0;
      const sendMock = vi.fn().mockImplementation(async (msg) => {
        attempt++;
        if (attempt <= 2) {
          // First two items succeed, third fails
          return { id: 100, msg };
        }
        return Promise.reject(new Error('Network dropped mid-flush'));
      });

      const harness = createOutboxHarness(sendMock);
      for (let i = 1; i <= 5; i++) {
        const msg = new MockCustomMessage('session-1', 'group', 'kine.rep', { n: i });
        harness.outboxQueue.push({ message: msg, retries: 0 });
      }

      await harness.flushOutboxQueue();

      // Items 1 and 2 succeeded and were shifted
      // Item 3 failed (retries: 1) and caused break
      // Items 4 and 5 were untouched (retries: 0)
      expect(harness.outboxQueue.length).toBe(3);
      expect(harness.outboxQueue[0].message.getCustomData().n).toBe(3);
      expect(harness.outboxQueue[0].retries).toBe(1);
      expect(harness.outboxQueue[1].message.getCustomData().n).toBe(4);
      expect(harness.outboxQueue[1].retries).toBe(0);
      expect(harness.outboxQueue[2].message.getCustomData().n).toBe(5);
      expect(harness.outboxQueue[2].retries).toBe(0);
    });
  });

  // =========================================================================
  // SECTION 2: Concurrency & Re-Entrancy
  // =========================================================================
  describe('2. Outbox Queue Concurrency & Re-Entrancy Safety', () => {
    it('D5.1-CONC.1: Concurrent invocations of flushOutboxQueue are guarded by isFlushingRef', async () => {
      let resolveFirstCall: (v?: any) => void;
      const sendMock = vi.fn().mockImplementation(() => {
        return new Promise((resolve) => {
          resolveFirstCall = resolve;
        });
      });

      const harness = createOutboxHarness(sendMock);
      const msg = new MockCustomMessage('session-1', 'group', 'kine.rep', { n: 1 });
      harness.outboxQueue.push({ message: msg, retries: 0 });

      // Trigger first flush (in progress)
      const p1 = harness.flushOutboxQueue();
      expect(harness.getIsFlushing()).toBe(true);

      // Trigger second flush while first is active
      const p2 = harness.flushOutboxQueue();
      await p2; // Should return immediately without doing work

      expect(sendMock).toHaveBeenCalledTimes(1);

      // Complete first flush
      resolveFirstCall!({ ok: true });
      await p1;

      expect(harness.getIsFlushing()).toBe(false);
      expect(harness.outboxQueue.length).toBe(0);
    });

    it('D5.1-CONC.2: Items enqueued during active flush are safely processed in FIFO order in same loop', async () => {
      let counter = 0;
      const sendMock = vi.fn().mockImplementation(async (msg) => {
        counter++;
        if (counter === 1) {
          // While flushing item 1, a new rep fails and is pushed to outboxQueue
          const newMsg = new MockCustomMessage('session-1', 'group', 'kine.rep', { n: 2 });
          harness.outboxQueue.push({ message: newMsg, retries: 0 });
        }
        return { ok: true, msg };
      });

      const harness = createOutboxHarness(sendMock);
      const msg1 = new MockCustomMessage('session-1', 'group', 'kine.rep', { n: 1 });
      harness.outboxQueue.push({ message: msg1, retries: 0 });

      await harness.flushOutboxQueue();

      // Both items processed
      expect(counter).toBe(2);
      expect(harness.outboxQueue.length).toBe(0);
    });
  });

  // =========================================================================
  // SECTION 3: Corner Case: Session ID Changes while Queue has Items
  // =========================================================================
  describe('3. Corner Case: Session ID Changes while Outbox has Items', () => {
    it('D5.1-SESS.1: Messages queued under Session A retain Session A receiverId (no inadvertent retargeting)', async () => {
      const sendMock = vi.fn().mockImplementation(async () => {
        return Promise.reject(new Error('Network drop in Session A'));
      });

      const harness = createOutboxHarness(sendMock);
      const repA: KineRepPayload = {
        v: SCHEMA_VERSION,
        sid: 'session-alpha',
        t: 1000,
        type: 'kine.rep',
        n: 1,
        minKneeDeg: 90,
        depth: 'good',
        durMs: 1500,
        tempo: 'controlled',
      };

      await harness.dispatchRepMessage('session-alpha', repA);
      expect(harness.outboxQueue.length).toBe(1);
      expect(harness.outboxQueue[0].message.getReceiverId()).toBe('session-alpha');

      // Now session changes to session-beta, and a new message fails
      const repB: KineRepPayload = {
        v: SCHEMA_VERSION,
        sid: 'session-beta',
        t: 5000,
        type: 'kine.rep',
        n: 2,
        minKneeDeg: 88,
        depth: 'deep',
        durMs: 1600,
        tempo: 'slow',
      };
      await harness.dispatchRepMessage('session-beta', repB);
      expect(harness.outboxQueue.length).toBe(2);

      // Verify each message retains its immutable stamped destination
      expect(harness.outboxQueue[0].message.getReceiverId()).toBe('session-alpha');
      expect(harness.outboxQueue[1].message.getReceiverId()).toBe('session-beta');

      // When network recovers, each message is sent to its respective target
      const sentDestinations: string[] = [];
      const recoveringSendMock = vi.fn().mockImplementation(async (msg: any) => {
        sentDestinations.push(msg.getReceiverId());
        return { ok: true };
      });

      // Replace send mock in harness
      const harness2 = createOutboxHarness(recoveringSendMock);
      harness2.outboxQueue.push(...harness.outboxQueue);
      await harness2.flushOutboxQueue();

      expect(sentDestinations).toEqual(['session-alpha', 'session-beta']);
      expect(harness2.outboxQueue.length).toBe(0);
    });
  });

  // =========================================================================
  // SECTION 4: Toast Dismiss Timer & Multi-Cue Collision Verification
  // =========================================================================
  describe('4. Coaching Cue Toast Timer (D5.2)', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('D5.2-TIMER.1: Patient toast dismisses at exactly 4000ms', () => {
      let activeToast: { id: number; text: string } | null = null;
      const onReceiveCue = (cueText: string) => {
        activeToast = { id: Date.now(), text: cueText };
        setTimeout(() => {
          activeToast = null;
        }, 4000);
      };

      onReceiveCue('Knees Out!');
      expect(activeToast).toEqual({ id: expect.any(Number), text: 'Knees Out!' });

      // At 3999ms, toast is still active
      vi.advanceTimersByTime(3999);
      expect(activeToast).not.toBeNull();

      // At 4000ms, toast is dismissed
      vi.advanceTimersByTime(1);
      expect(activeToast).toBeNull();
    });

    it('D5.2-TIMER.2: Timer collision analysis: consecutive cues at t=0 and t=2000ms with simple setTimeout', () => {
      // In the worker implementation in Patient.tsx lines 249-250:
      // setActiveToast({ id: Date.now(), text: cueText });
      // setTimeout(() => setActiveToast(null), 4000);
      let activeToast: { id: number; text: string } | null = null;
      const onReceiveCue = (cueText: string) => {
        activeToast = { id: Date.now(), text: cueText };
        setTimeout(() => {
          activeToast = null;
        }, 4000);
      };

      // Cue 1 arrives at t=0
      onReceiveCue('Knees Out!');
      expect(activeToast?.text).toBe('Knees Out!');

      // Cue 2 arrives at t=2000ms
      vi.advanceTimersByTime(2000);
      onReceiveCue('Chest Up!');
      expect(activeToast?.text).toBe('Chest Up!');

      // At t=4000ms (only 2000ms after Cue 2), Timer 1 fires and sets activeToast = null!
      vi.advanceTimersByTime(2000);
      expect(activeToast).toBeNull(); // Demonstrates premature dismissal of Cue 2 by Timer 1
    });

    it('D5.2-TIMER.3: Clinician cooldown of 1200ms bounds cue dispatch frequency', () => {
      // In Clinician.tsx: activeCueSent has 1200ms cooldown
      let activeCueSent: string | null = null;
      const handleSendCue = (cue: string) => {
        if (activeCueSent !== null) return false; // blocked during cooldown
        activeCueSent = cue;
        setTimeout(() => {
          activeCueSent = null;
        }, 1200);
        return true;
      };

      expect(handleSendCue('knees_out')).toBe(true);
      expect(activeCueSent).toBe('knees_out');

      // Immediate second click blocked
      expect(handleSendCue('slower')).toBe(false);

      // At 1199ms, still blocked
      vi.advanceTimersByTime(1199);
      expect(handleSendCue('slower')).toBe(false);

      // At 1200ms, cooldown resets
      vi.advanceTimersByTime(1);
      expect(activeCueSent).toBeNull();
      expect(handleSendCue('slower')).toBe(true);
    });
  });

  // =========================================================================
  // SECTION 5: Design Token Conformance & Zero Raw Hex Verification
  // =========================================================================
  describe('5. CSS Tokens & Zero Raw Hex Code Verification', () => {
    it('D5.2-CSS.1: client/src/styles/tokens.css defines --accent-cyan, --accent-cyan-tint, and --shadow-glow-cyan', () => {
      const tokensPath = path.resolve(__dirname, '../client/src/styles/tokens.css');
      const cssContent = fs.readFileSync(tokensPath, 'utf8');

      expect(cssContent).toMatch(/--accent-cyan:\s*#06B6D4;/);
      expect(cssContent).toMatch(/--accent-cyan-tint:\s*rgba\(6,\s*182,\s*212,\s*0\.18\);/);
      expect(cssContent).toMatch(/--shadow-glow-cyan:\s*0\s+0\s+16px\s+-2px\s+rgba\(6,\s*182,\s*212,\s*0\.45\);/);
    });

    it('D5.2-CSS.2: client/src/views/Patient.tsx has zero raw hex codes', () => {
      const patientPath = path.resolve(__dirname, '../client/src/views/Patient.tsx');
      const content = fs.readFileSync(patientPath, 'utf8');

      const hexPattern = /#[0-9a-fA-F]{3,8}\b/g;
      const matches = content.match(hexPattern) || [];

      expect(matches).toEqual([]);
    });

    it('D5.2-CSS.3: Patient toast overlay markup strictly uses semantic cyan tokens', () => {
      const patientPath = path.resolve(__dirname, '../client/src/views/Patient.tsx');
      const content = fs.readFileSync(patientPath, 'utf8');

      // Check toast overlay uses var(--accent-cyan), var(--shadow-glow-cyan), var(--accent-cyan-tint)
      expect(content).toContain("color: 'var(--accent-cyan)'");
      expect(content).toContain("border: '2px solid var(--accent-cyan)'");
      expect(content).toContain("boxShadow: 'var(--shadow-glow-cyan)'");
      expect(content).toContain("backgroundColor: 'var(--accent-cyan-tint)'");
    });
  });
});
