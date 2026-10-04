/**
 * tests/challenger_outbox_stress.test.ts
 *
 * Adversarial & Stress-Testing Suite for Milestone D5.1 (Outbox Queue) & D5.2 (Coaching Cues & Tokens).
 * Authored by Challenger 1 (teamwork_preview_challenger) to empirically test:
 *
 * 1. Concurrency & Reentrancy:
 *    - isFlushingRef guard against 50 concurrent onConnected invocations.
 *    - Sequential execution guarantee (no overlapping sends).
 *    - FIFO delivery order preserved.
 *
 * 2. Retry Progression & Error Handling:
 *    - Retry counter increments up to 3 on network failures.
 *    - Discard occurs on 3rd failure with console.warn.
 *    - Queue does not halt forever; continues to next items.
 *    - Temporary network failure breaks loop early (prevents spamming dead connection).
 *
 * 3. Dynamic Interleaved Enqueueing:
 *    - Enqueueing new items while flush is active processes all items in FIFO order.
 *
 * 4. Exception Resilience:
 *    - Synchronous throw in sendCustomMessage resets isFlushingRef via finally block.
 *
 * 5. Lifecycle Hygiene & Teardown:
 *    - Proper removeConnectionListener execution.
 *
 * 6. Design Token & Toast Invariants:
 *    - Zero raw hex codes in Patient.tsx.
 *    - Valid tokens in tokens.css.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Define the Outbox implementation under test identical to Patient.tsx lines 111-145
interface OutboxItem {
  message: { id: string; type: string; getType?: () => string };
  retries: number;
}

function createOutboxHarness(sendCustomMessageMock: (msg: any) => Promise<any>) {
  const outboxQueue: OutboxItem[] = [];
  let isFlushing = false;
  let activeSends = 0;
  let maxConcurrentSends = 0;

  const flushOutboxQueue = async () => {
    if (isFlushing || outboxQueue.length === 0) return;
    isFlushing = true;

    try {
      while (outboxQueue.length > 0) {
        const item = outboxQueue[0];
        try {
          activeSends++;
          maxConcurrentSends = Math.max(maxConcurrentSends, activeSends);
          await sendCustomMessageMock(item.message);
          activeSends--;
          outboxQueue.shift();
        } catch (err) {
          activeSends--;
          item.retries += 1;
          if (item.retries >= 3) {
            console.warn(
              '[KinesioOutbox] Discarded custom message after 3 failed retries:',
              item.message.getType?.() || item.message,
              err
            );
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
    queue: outboxQueue,
    isFlushing: () => isFlushing,
    getMaxConcurrentSends: () => maxConcurrentSends,
    flush: flushOutboxQueue,
  };
}

describe('Challenger 1 Empirical Stress Suite: Outbox Queue (D5.1)', () => {
  let warnSpy: any;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
    vi.restoreAllMocks();
  });

  it('OBOX-STRESS.1: isFlushingRef prevents overlapping concurrent executions under rapid onConnected bursts', async () => {
    let callCount = 0;
    const sendMock = vi.fn(async (_msg: any) => {
      callCount++;
      await new Promise((r) => setTimeout(r, 10)); // simulate network delay
      return { status: 'sent' };
    });

    const harness = createOutboxHarness(sendMock);

    // Enqueue 5 items
    for (let i = 1; i <= 5; i++) {
      harness.queue.push({
        message: { id: `rep-${i}`, type: 'kine.rep', getType: () => 'kine.rep' },
        retries: 0,
      });
    }

    // Trigger 50 rapid simultaneous flushes (simulating connection flapping)
    const flushes = Array.from({ length: 50 }, () => harness.flush());
    await Promise.all(flushes);

    expect(callCount).toBe(5);
    expect(harness.getMaxConcurrentSends()).toBe(1); // strictly sequential!
    expect(harness.queue.length).toBe(0);
    expect(harness.isFlushing()).toBe(false);
  });

  it('OBOX-STRESS.2: Preserves strict FIFO order across queue drainage', async () => {
    const sentOrder: string[] = [];
    const sendMock = vi.fn(async (msg: any) => {
      sentOrder.push(msg.id);
      await new Promise((r) => setTimeout(r, 2));
      return { status: 'sent' };
    });

    const harness = createOutboxHarness(sendMock);

    harness.queue.push(
      { message: { id: 'rep-1', type: 'kine.rep' }, retries: 0 },
      { message: { id: 'alert-1', type: 'kine.alert' }, retries: 0 },
      { message: { id: 'rep-2', type: 'kine.rep' }, retries: 0 }
    );

    await harness.flush();

    expect(sentOrder).toEqual(['rep-1', 'alert-1', 'rep-2']);
    expect(harness.queue.length).toBe(0);
  });

  it('OBOX-STRESS.3: Increments retry counter and halts flush early on network failure', async () => {
    const sendMock = vi.fn(async (msg: any) => {
      if (msg.id === 'rep-fail') {
        throw new Error('WebSocket connection closed');
      }
      return { status: 'sent' };
    });

    const harness = createOutboxHarness(sendMock);

    harness.queue.push(
      { message: { id: 'rep-fail', type: 'kine.rep' }, retries: 0 },
      { message: { id: 'rep-2', type: 'kine.rep' }, retries: 0 }
    );

    // Flush 1: Fails once, retries becomes 1, loop breaks early
    await harness.flush();
    expect(harness.queue.length).toBe(2);
    expect(harness.queue[0].retries).toBe(1);
    expect(harness.isFlushing()).toBe(false);
    expect(warnSpy).not.toHaveBeenCalled();

    // Flush 2: Fails second time, retries becomes 2, loop breaks early
    await harness.flush();
    expect(harness.queue.length).toBe(2);
    expect(harness.queue[0].retries).toBe(2);
    expect(warnSpy).not.toHaveBeenCalled();

    // Flush 3: Fails third time, retries reaches 3 -> discarded with console.warn!
    // And loop continues to process rep-2!
    await harness.flush();

    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0][0]).toContain('[KinesioOutbox] Discarded custom message after 3 failed retries:');
    // rep-fail was discarded, and rep-2 was then successfully sent
    expect(harness.queue.length).toBe(0);
  });

  it('OBOX-STRESS.4: Newly enqueued items during active flush are drained in same flush loop', async () => {
    let flushHasStarted = false;
    const sendMock = vi.fn(async (msg: any) => {
      flushHasStarted = true;
      await new Promise((r) => setTimeout(r, 20));
      return { status: 'sent' };
    });

    const harness = createOutboxHarness(sendMock);
    harness.queue.push({ message: { id: 'item-1', type: 'kine.rep' }, retries: 0 });

    const flushPromise = harness.flush();

    // Mid-flush enqueue
    setTimeout(() => {
      expect(flushHasStarted).toBe(true);
      harness.queue.push({ message: { id: 'item-2', type: 'kine.alert' }, retries: 0 });
    }, 5);

    await flushPromise;

    expect(sendMock).toHaveBeenCalledTimes(2);
    expect(harness.queue.length).toBe(0);
  });

  it('OBOX-STRESS.5: Synchronous error in sendCustomMessage does not deadlock isFlushing', async () => {
    const sendMock = vi.fn((_msg: any) => {
      throw new Error('CometChat synchronous fatal error');
    });

    const harness = createOutboxHarness(sendMock);
    harness.queue.push({ message: { id: 'bad-msg', type: 'kine.rep' }, retries: 0 });

    await harness.flush();

    expect(harness.isFlushing()).toBe(false);
    expect(harness.queue[0].retries).toBe(1);
  });
});

describe('Challenger 1 Empirical Code Invariants: Patient.tsx & tokens.css (D5.2)', () => {
  const patientPath = resolve(__dirname, '../client/src/views/Patient.tsx');
  const tokensPath = resolve(__dirname, '../client/src/styles/tokens.css');

  it('INVAR.1: Zero raw hex codes in client/src/views/Patient.tsx', () => {
    const patientContent = readFileSync(patientPath, 'utf-8');
    // Regex for hex color codes: #[0-9a-fA-F]{3,8}
    const hexRegex = /#[0-9a-fA-F]{3,8}/g;
    const matches = patientContent.match(hexRegex) || [];
    expect(matches).toEqual([]);
  });

  it('INVAR.2: tokens.css defines --accent-cyan and glow shadow tokens', () => {
    const tokensContent = readFileSync(tokensPath, 'utf-8');
    expect(tokensContent).toContain('--accent-cyan: #06B6D4;');
    expect(tokensContent).toContain('--accent-cyan-tint: rgba(6, 182, 212, 0.18);');
    expect(tokensContent).toContain('--shadow-glow-cyan: 0 0 16px -2px rgba(6, 182, 212, 0.45);');
  });

  it('INVAR.3: Patient.tsx toast dismiss timeout is exactly 4000ms', () => {
    const patientContent = readFileSync(patientPath, 'utf-8');
    expect(patientContent).toContain('setTimeout(() => setActiveToast(null), 4000)');
  });

  it('INVAR.4: Patient.tsx cleans up connection listener on unmount/teardown', () => {
    const patientContent = readFileSync(patientPath, 'utf-8');
    expect(patientContent).toContain('CometChat.addConnectionListener(');
    expect(patientContent).toContain('CometChat.removeConnectionListener(connListenerId)');
  });

  it('INVAR.5: rVFC handlePoseFrame dispatches custom messages without awaiting (zero blocking)', () => {
    const patientContent = readFileSync(patientPath, 'utf-8');
    // Ensure dispatchCustomRepMessage and dispatchCustomAlertMessage are called fire-and-forget
    expect(patientContent).toMatch(/dispatchCustomRepMessage\(fsmOutput\.completedRep\);/);
    expect(patientContent).not.toMatch(/await\s+dispatchCustomRepMessage/);
    expect(patientContent).not.toMatch(/await\s+dispatchCustomAlertMessage/);
  });
});
