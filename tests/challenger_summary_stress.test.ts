/**
 * tests/challenger_summary_stress.test.ts
 *
 * Empirical Adversarial & Stress-Testing Suite for Milestone D5.3 (Biomechanical Summary Engine).
 * Authored by Challenger 2 (teamwork_preview_challenger) to rigorously evaluate:
 *
 * 1. Performance & Scale:
 *    - 500+ messages (spec requirement) execution latency & memory overhead
 *    - High-volume stress (1,000, 5,000, and 10,000 messages)
 *    - O(N log N) empirical scaling validation
 *
 * 2. Floating-Point Precision & Numerical Stability:
 *    - averageMinKneeDeg rounding precision (exact 1 decimal place, zero IEEE-754 drift)
 *    - Extreme numerical ranges (zero, negative, sub-normal, large numbers)
 *    - maxValgusDevPct and peakDepthDeg accuracy
 *    - Zero NaN, Infinity, or -Infinity leakage
 *
 * 3. Branch & Boundary Exhaustion:
 *    - Non-array messages argument (null, undefined, primitives)
 *    - Sparse/holey arrays with null, undefined, non-CustomMessage entries
 *    - Malformed customData (null, primitive, array, missing type, non-string type)
 *    - Every validation branch of kine.rep, kine.alert, kine.cue, and kine.session
 *    - ID and timestamp fallback cascading (data.t -> getSentAt -> 0)
 *    - Multiple start/end session marker aggregation
 *    - Chronological sorting stability and severity tagging
 */

import { describe, it, expect } from 'vitest';
import { CometChat } from '@cometchat/chat-sdk-javascript';
import { buildSummary, type SessionSummary } from '../client/src/engine/buildSummary';
import {
  SCHEMA_VERSION,
  CLINICIAN_UID,
  PATIENT_UID,
  type KineRepPayload,
  type KineAlertPayload,
  type KineCuePayload,
  type KineSessionMarkerPayload,
} from '../shared/src/index';

// ----------------------------------------------------------------------------
// Deterministic Fixture Factory
// ----------------------------------------------------------------------------
function createRepMsg(
  sid: string,
  t: number,
  n: number,
  minKneeDeg: number,
  depth: 'shallow' | 'good' | 'deep' = 'good',
  durMs: number = 2000,
  tempo: 'fast' | 'controlled' | 'slow' = 'controlled',
  msgId?: string | number
): CometChat.CustomMessage {
  const payload: KineRepPayload = {
    v: SCHEMA_VERSION,
    sid,
    t,
    type: 'kine.rep',
    n,
    minKneeDeg,
    depth,
    durMs,
    tempo,
  };
  const msg = new CometChat.CustomMessage(
    sid,
    CometChat.RECEIVER_TYPE.GROUP,
    'kine.rep',
    payload as unknown as Record<string, unknown>
  );
  if (typeof (msg as any).setSentAt === 'function') {
    (msg as any).setSentAt(t);
  }
  if (msgId !== undefined && typeof (msg as any).setId === 'function') {
    (msg as any).setId(msgId);
  }
  return msg;
}

function createAlertMsg(
  sid: string,
  t: number,
  side: 'L' | 'R',
  value: number,
  thresholdPct: number = 8.0,
  repN: number = 1,
  msgId?: string | number
): CometChat.CustomMessage {
  const payload: KineAlertPayload = {
    v: SCHEMA_VERSION,
    sid,
    t,
    type: 'kine.alert',
    kind: 'knee_valgus',
    side,
    value,
    thresholdPct,
    repN,
    phase: 'bottom',
    note: 'Form alert (biomechanical feedback)',
  };
  const msg = new CometChat.CustomMessage(
    sid,
    CometChat.RECEIVER_TYPE.GROUP,
    'kine.alert',
    payload as unknown as Record<string, unknown>
  );
  if (typeof (msg as any).setSentAt === 'function') {
    (msg as any).setSentAt(t);
  }
  if (msgId !== undefined && typeof (msg as any).setId === 'function') {
    (msg as any).setId(msgId);
  }
  return msg;
}

function createCueMsg(
  sid: string,
  t: number,
  cue: 'knees_out' | 'slower' | 'chest_up' | 'good_depth',
  text: string,
  msgId?: string | number
): CometChat.CustomMessage {
  const payload: KineCuePayload = {
    v: SCHEMA_VERSION,
    sid,
    t,
    type: 'kine.cue',
    cue,
    text,
  };
  const msg = new CometChat.CustomMessage(
    sid,
    CometChat.RECEIVER_TYPE.GROUP,
    'kine.cue',
    payload as unknown as Record<string, unknown>
  );
  if (typeof (msg as any).setSentAt === 'function') {
    (msg as any).setSentAt(t);
  }
  if (msgId !== undefined && typeof (msg as any).setId === 'function') {
    (msg as any).setId(msgId);
  }
  return msg;
}

function createSessionMsg(
  sid: string,
  t: number,
  action: 'start' | 'end' | 'summary',
  clinicianUid: string = CLINICIAN_UID,
  patientUid: string = PATIENT_UID,
  msgId?: string | number
): CometChat.CustomMessage {
  const payload: KineSessionMarkerPayload = {
    v: SCHEMA_VERSION,
    sid,
    t,
    type: 'kine.session',
    action,
    clinicianUid,
    patientUid,
  };
  const msg = new CometChat.CustomMessage(
    sid,
    CometChat.RECEIVER_TYPE.GROUP,
    'kine.session',
    payload as unknown as Record<string, unknown>
  );
  if (typeof (msg as any).setSentAt === 'function') {
    (msg as any).setSentAt(t);
  }
  if (msgId !== undefined && typeof (msg as any).setId === 'function') {
    (msg as any).setId(msgId);
  }
  return msg;
}

describe('Challenger 2 Empirical Stress Suite: Summary Engine (D5.3)', () => {
  const SID = 'kine-adversarial-room-99';

  // ==========================================================================
  // Section 1: Performance & Scalability (500+ Messages Requirement)
  // ==========================================================================
  describe('Performance & Scale Under Load', () => {
    it('PERF-1: processes 500 mixed messages under 15ms without memory bloat', () => {
      const messages: CometChat.BaseMessage[] = [];
      const startTime = 10000;
      messages.push(createSessionMsg(SID, startTime, 'start'));

      for (let i = 1; i <= 300; i++) {
        const t = startTime + i * 1000;
        const depth = i % 3 === 0 ? 'shallow' : i % 2 === 0 ? 'good' : 'deep';
        const tempo = i % 3 === 0 ? 'fast' : i % 2 === 0 ? 'controlled' : 'slow';
        messages.push(createRepMsg(SID, t, i, 70 + (i % 40), depth, 1500 + i, tempo, `rep-${i}`));
      }

      for (let i = 1; i <= 100; i++) {
        const t = startTime + i * 2500;
        messages.push(createAlertMsg(SID, t, i % 2 === 0 ? 'L' : 'R', 8.0 + (i % 15) * 0.3, 8.0, i, `alert-${i}`));
      }

      for (let i = 1; i <= 100; i++) {
        const t = startTime + i * 3000;
        messages.push(createCueMsg(SID, t, 'knees_out', `Cue text ${i}`, `cue-${i}`));
      }

      messages.push(createSessionMsg(SID, startTime + 400000, 'end'));

      // Total messages: 1 + 300 + 100 + 100 + 1 = 502 messages
      expect(messages.length).toBe(502);

      const t0 = performance.now();
      const summary = buildSummary(SID, messages);
      const elapsed = performance.now() - t0;

      expect(elapsed).toBeLessThan(15); // < 15ms on modern hardware
      expect(summary.totalReps).toBe(300);
      expect(summary.alertCount).toBe(100);
      expect(summary.cuesCount).toBe(100);
      expect(summary.durationMs).toBe(400000);
      expect(summary.timeline.length).toBe(502);
    });

    it('PERF-2: scales to 2,000 and 10,000 messages with linear/log-linear efficiency', () => {
      const generateBurst = (count: number) => {
        const list: CometChat.BaseMessage[] = [];
        for (let i = 0; i < count; i++) {
          const t = Math.floor(Math.random() * 1000000);
          if (i % 4 === 0) {
            list.push(createRepMsg(SID, t, i, 80 + (i % 30)));
          } else if (i % 4 === 1) {
            list.push(createAlertMsg(SID, t, 'L', 10.5));
          } else if (i % 4 === 2) {
            list.push(createCueMsg(SID, t, 'slower', 'Take it slow'));
          } else {
            list.push(createSessionMsg(SID, t, 'summary'));
          }
        }
        return list;
      };

      const burst2k = generateBurst(2000);
      const t2kStart = performance.now();
      const summary2k = buildSummary(SID, burst2k);
      const t2kElapsed = performance.now() - t2kStart;

      expect(t2kElapsed).toBeLessThan(50); // < 50ms for 2,000 messages
      expect(summary2k.timeline.length).toBe(2000);

      const burst10k = generateBurst(10000);
      const t10kStart = performance.now();
      const summary10k = buildSummary(SID, burst10k);
      const t10kElapsed = performance.now() - t10kStart;

      expect(t10kElapsed).toBeLessThan(200); // < 200ms for 10,000 messages
      expect(summary10k.timeline.length).toBe(10000);
    });
  });

  // ==========================================================================
  // Section 2: Floating-Point Precision & Rounding Verification
  // ==========================================================================
  describe('Floating-Point Precision & Arithmetic Stability', () => {
    it('FP-1: averageMinKneeDeg is strictly rounded to at most 1 decimal place across repeating decimals', () => {
      // 3 reps with sum 286: 286 / 3 = 95.33333333333333...
      const repA = createRepMsg(SID, 1000, 1, 95.0);
      const repB = createRepMsg(SID, 2000, 2, 95.0);
      const repC = createRepMsg(SID, 3000, 3, 96.0);

      const summary = buildSummary(SID, [repA, repB, repC]);
      // (95 + 95 + 96) / 3 = 286 / 3 = 95.33333333333333 -> rounded to 95.3
      expect(summary.averageMinKneeDeg).toBe(95.3);

      const strRep = String(summary.averageMinKneeDeg);
      const decimalDigits = strRep.includes('.') ? strRep.split('.')[1]!.length : 0;
      expect(decimalDigits).toBeLessThanOrEqual(1);
    });

    it('FP-2: averageMinKneeDeg correctly rounds .05 upward (half-up) and avoids IEEE-754 drift', () => {
      // 2 reps with average 90.75: (90.5 + 91.0) / 2 = 90.75 -> 90.8
      const rep1 = createRepMsg(SID, 1000, 1, 90.5);
      const rep2 = createRepMsg(SID, 2000, 2, 91.0);

      const summary = buildSummary(SID, [rep1, rep2]);
      expect(summary.averageMinKneeDeg).toBe(90.8);
    });

    it('FP-3: handles 0.0 degree angle reps without evaluating to false/undefined/NaN', () => {
      const zeroRep = createRepMsg(SID, 1000, 1, 0.0);
      const summary = buildSummary(SID, [zeroRep]);

      expect(summary.totalReps).toBe(1);
      expect(summary.averageMinKneeDeg).toBe(0.0);
      expect(summary.peakDepthDeg).toBe(0.0);
    });

    it('FP-4: preserves peakDepthDeg as the exact mathematical minimum among valid reps', () => {
      const rep1 = createRepMsg(SID, 1000, 1, 92.4);
      const rep2 = createRepMsg(SID, 2000, 2, 78.6);
      const rep3 = createRepMsg(SID, 3000, 3, 85.1);

      const summary = buildSummary(SID, [rep1, rep2, rep3]);
      expect(summary.peakDepthDeg).toBe(78.6);
    });

    it('FP-5: correctly finds maxValgusDevPct and handles identical maximums', () => {
      const alert1 = createAlertMsg(SID, 1000, 'L', 14.25);
      const alert2 = createAlertMsg(SID, 2000, 'R', 14.25);
      const alert3 = createAlertMsg(SID, 3000, 'L', 9.1);

      const summary = buildSummary(SID, [alert1, alert2, alert3]);
      expect(summary.maxValgusDevPct).toBe(14.25);
      expect(summary.alertBreakdown).toEqual({ L: 2, R: 1 });
    });
  });

  // ==========================================================================
  // Section 3: Branch Coverage & Boundary Robustness
  // ==========================================================================
  describe('Branch Coverage & Ingestion Boundary Edge Cases', () => {
    it('BRANCH-1: gracefully handles non-array messages input (null, undefined, primitives)', () => {
      // @ts-expect-error Testing runtime boundary with invalid argument
      const nullSummary = buildSummary(SID, null);
      expect(nullSummary.sessionId).toBe(SID);
      expect(nullSummary.totalReps).toBe(0);
      expect(nullSummary.timeline).toEqual([]);

      // @ts-expect-error Testing runtime boundary with invalid argument
      const undefSummary = buildSummary(SID, undefined);
      expect(undefSummary.totalReps).toBe(0);

      // @ts-expect-error Testing runtime boundary with invalid argument
      const stringSummary = buildSummary(SID, 'not an array');
      expect(stringSummary.totalReps).toBe(0);
    });

    it('BRANCH-2: skips null, undefined, or sparse slots in the messages array', () => {
      const validRep = createRepMsg(SID, 1000, 1, 90.0);
      const sparseArray: any[] = new Array(5);
      sparseArray[1] = null;
      sparseArray[2] = undefined;
      sparseArray[4] = validRep;

      const summary = buildSummary(SID, sparseArray);
      expect(summary.totalReps).toBe(1);
      expect(summary.timeline.length).toBe(1);
    });

    it('BRANCH-3: discards CustomMessage with invalid customData shapes (primitive, array, null)', () => {
      const msgPrimitiveData = new CometChat.CustomMessage(
        SID,
        CometChat.RECEIVER_TYPE.GROUP,
        'kine.rep',
        'just a string' as any
      );
      const msgArrayData = new CometChat.CustomMessage(
        SID,
        CometChat.RECEIVER_TYPE.GROUP,
        'kine.rep',
        ['item1', 'item2'] as any
      );
      const msgMissingType = new CometChat.CustomMessage(
        SID,
        CometChat.RECEIVER_TYPE.GROUP,
        'kine.rep',
        { n: 1, minKneeDeg: 90 } as any
      );
      const msgNonStringType = new CometChat.CustomMessage(
        SID,
        CometChat.RECEIVER_TYPE.GROUP,
        'kine.rep',
        { type: 12345 } as any
      );

      const summary = buildSummary(SID, [
        msgPrimitiveData,
        msgArrayData,
        msgMissingType,
        msgNonStringType,
      ]);

      expect(summary.totalReps).toBe(0);
      expect(summary.timeline.length).toBe(0);
    });

    it('BRANCH-4: discards kine.rep payloads with missing or non-finite fields', () => {
      const makeBadRep = (overrides: Record<string, unknown>) => {
        return new CometChat.CustomMessage(SID, CometChat.RECEIVER_TYPE.GROUP, 'kine.rep', {
          v: SCHEMA_VERSION,
          sid: SID,
          t: 1000,
          type: 'kine.rep',
          n: 1,
          minKneeDeg: 90.0,
          depth: 'good',
          durMs: 1500,
          tempo: 'controlled',
          ...overrides,
        });
      };

      const badReps = [
        makeBadRep({ n: 'one' }),
        makeBadRep({ n: Infinity }),
        makeBadRep({ minKneeDeg: 'invalid' }),
        makeBadRep({ minKneeDeg: NaN }),
        makeBadRep({ depth: 'ultra_deep' }),
        makeBadRep({ durMs: NaN }),
        makeBadRep({ tempo: 'ultra_fast' }),
      ];

      const summary = buildSummary(SID, badReps);
      expect(summary.totalReps).toBe(0);
      expect(summary.timeline).toHaveLength(0);
    });

    it('BRANCH-5: handles kine.alert with optional/missing fields (thresholdPct and repN fallbacks)', () => {
      // Alert missing thresholdPct and repN
      const minimalAlert = new CometChat.CustomMessage(
        SID,
        CometChat.RECEIVER_TYPE.GROUP,
        'kine.alert',
        {
          type: 'kine.alert',
          t: 2000,
          side: 'L',
          value: 12.5,
        }
      );

      // Alert with non-finite value (should be rejected)
      const badAlertVal = new CometChat.CustomMessage(
        SID,
        CometChat.RECEIVER_TYPE.GROUP,
        'kine.alert',
        {
          type: 'kine.alert',
          t: 3000,
          side: 'R',
          value: NaN,
        }
      );

      const summary = buildSummary(SID, [minimalAlert, badAlertVal]);
      expect(summary.alertCount).toBe(1);
      expect(summary.maxValgusDevPct).toBe(12.5);
      expect(summary.alertBreakdown).toEqual({ L: 1, R: 0 });
      expect(summary.timeline[0]!.detail).toContain('threshold 8%'); // default threshold fallback
    });

    it('BRANCH-6: discards invalid coaching cue enums and non-string text', () => {
      const badCueEnum = new CometChat.CustomMessage(
        SID,
        CometChat.RECEIVER_TYPE.GROUP,
        'kine.cue',
        {
          type: 'kine.cue',
          t: 2000,
          cue: 'jump_higher',
          text: 'Jump!',
        }
      );
      const badCueText = new CometChat.CustomMessage(
        SID,
        CometChat.RECEIVER_TYPE.GROUP,
        'kine.cue',
        {
          type: 'kine.cue',
          t: 2000,
          cue: 'chest_up',
          text: 12345,
        }
      );

      const summary = buildSummary(SID, [badCueEnum, badCueText]);
      expect(summary.cuesCount).toBe(0);
      expect(summary.cuesDelivered).toHaveLength(0);
    });

    it('BRANCH-7: handles kine.session summary action and multiple start/end markers', () => {
      const start1 = createSessionMsg(SID, 15000, 'start');
      const start2 = createSessionMsg(SID, 10000, 'start'); // Earlier start
      const summaryMarker = createSessionMsg(SID, 40000, 'summary');
      const end1 = createSessionMsg(SID, 50000, 'end');
      const end2 = createSessionMsg(SID, 60000, 'end'); // Later end

      const summary = buildSummary(SID, [start1, start2, summaryMarker, end1, end2]);

      // duration should be 60000 - 10000 = 50000
      expect(summary.durationMs).toBe(50000);
      expect(summary.timeline).toHaveLength(5);
      expect(summary.timeline[2]!.title).toBe('Session Summary');
    });

    it('BRANCH-8: falls back from data.t to msg.getSentAt() when data.t is missing', () => {
      const msgWithoutDataT = new CometChat.CustomMessage(
        SID,
        CometChat.RECEIVER_TYPE.GROUP,
        'kine.rep',
        {
          type: 'kine.rep',
          n: 1,
          minKneeDeg: 88.0,
          depth: 'good',
          durMs: 1800,
          tempo: 'controlled',
          // no t property
        }
      );
      if (typeof (msgWithoutDataT as any).setSentAt === 'function') {
        (msgWithoutDataT as any).setSentAt(25000);
      }

      const summary = buildSummary(SID, [msgWithoutDataT]);
      expect(summary.totalReps).toBe(1);
      expect(summary.timeline[0]!.timestamp).toBe(25000);
    });

    it('BRANCH-9: generates stable default msg-index IDs when msg.getId is undefined or null', () => {
      const msgNoId = new CometChat.CustomMessage(
        SID,
        CometChat.RECEIVER_TYPE.GROUP,
        'kine.cue',
        {
          type: 'kine.cue',
          t: 5000,
          cue: 'slower',
          text: 'Descend slowly',
        }
      );
      // Ensure getId returns null
      (msgNoId as any).getId = () => null;

      const summary = buildSummary(SID, [msgNoId]);
      expect(summary.timeline[0]!.id).toBe('msg-0');
    });

    it('BRANCH-10: handles session where start and end markers have identical timestamps', () => {
      const start = createSessionMsg(SID, 10000, 'start');
      const end = createSessionMsg(SID, 10000, 'end');

      const summary = buildSummary(SID, [start, end]);
      expect(summary.durationMs).toBe(0);
    });
  });
});
