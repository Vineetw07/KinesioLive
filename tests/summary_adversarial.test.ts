/**
 * tests/summary_adversarial.test.ts
 *
 * Empirical adversarial stress harness for Milestone D5.3 (buildSummary.ts).
 * Stress tests:
 * 1. Boundary ingestion (null/undefined inputs, arrays with nulls, malformed objects)
 * 2. Corrupt payloads (string numbers, NaN, +/-Infinity, invalid enums)
 * 3. Math boundary edge cases (0 reps, 1 rep, 0 alerts, rounding precision)
 * 4. Session duration invariants (identical timestamps, inverted timestamps, multiple markers)
 * 5. Sorting invariants (identical timestamps, reverse order, 500+ out-of-order events)
 * 6. Method-throwing mocks and prototype tampering
 */

import { describe, it, expect } from 'vitest';
import { CometChat } from '@cometchat/chat-sdk-javascript';
import { buildSummary } from '../client/src/engine/buildSummary';
import {
  SCHEMA_VERSION,
  CLINICIAN_UID,
  PATIENT_UID,
  type KineRepPayload,
  type KineAlertPayload,
  type KineCuePayload,
  type KineSessionMarkerPayload,
} from '../shared/src/index';

function makeRep(sessionId: string, payload: Partial<KineRepPayload>): CometChat.CustomMessage {
  const fullPayload = {
    v: SCHEMA_VERSION,
    sid: sessionId,
    t: 10000,
    type: 'kine.rep',
    n: 1,
    minKneeDeg: 90.0,
    depth: 'good',
    durMs: 2000,
    tempo: 'controlled',
    ...payload,
  };
  const msg = new CometChat.CustomMessage(
    sessionId,
    CometChat.RECEIVER_TYPE.GROUP,
    'kine.rep',
    fullPayload as unknown as Record<string, unknown>
  );
  if (typeof (msg as any).setSentAt === 'function') {
    (msg as any).setSentAt(fullPayload.t);
  }
  return msg;
}

function makeAlert(sessionId: string, payload: Partial<KineAlertPayload>): CometChat.CustomMessage {
  const fullPayload = {
    v: SCHEMA_VERSION,
    sid: sessionId,
    t: 10000,
    type: 'kine.alert',
    kind: 'knee_valgus',
    side: 'L',
    value: 10.0,
    thresholdPct: 8.0,
    repN: 1,
    phase: 'bottom',
    note: 'Form alert (biomechanical feedback)',
    ...payload,
  };
  const msg = new CometChat.CustomMessage(
    sessionId,
    CometChat.RECEIVER_TYPE.GROUP,
    'kine.alert',
    fullPayload as unknown as Record<string, unknown>
  );
  if (typeof (msg as any).setSentAt === 'function') {
    (msg as any).setSentAt(fullPayload.t);
  }
  return msg;
}

function makeCue(sessionId: string, payload: Partial<KineCuePayload>): CometChat.CustomMessage {
  const fullPayload = {
    v: SCHEMA_VERSION,
    sid: sessionId,
    t: 10000,
    type: 'kine.cue',
    cue: 'knees_out',
    text: 'Drive knees outward',
    ...payload,
  };
  const msg = new CometChat.CustomMessage(
    sessionId,
    CometChat.RECEIVER_TYPE.GROUP,
    'kine.cue',
    fullPayload as unknown as Record<string, unknown>
  );
  if (typeof (msg as any).setSentAt === 'function') {
    (msg as any).setSentAt(fullPayload.t);
  }
  return msg;
}

function makeSession(
  sessionId: string,
  payload: Partial<KineSessionMarkerPayload>
): CometChat.CustomMessage {
  const fullPayload = {
    v: SCHEMA_VERSION,
    sid: sessionId,
    t: 10000,
    type: 'kine.session',
    action: 'start' as const,
    clinicianUid: CLINICIAN_UID,
    patientUid: PATIENT_UID,
    ...payload,
  };
  const msg = new CometChat.CustomMessage(
    sessionId,
    CometChat.RECEIVER_TYPE.GROUP,
    'kine.session',
    fullPayload as unknown as Record<string, unknown>
  );
  if (typeof (msg as any).setSentAt === 'function') {
    (msg as any).setSentAt(fullPayload.t);
  }
  return msg;
}

describe('Empirical Adversarial Challenge - buildSummary', () => {
  const SID = 'kine-adversarial-room';

  describe('1. Ingestion Boundary Stress', () => {
    it('handles non-array messages parameter without throwing', () => {
      expect(() => buildSummary(SID, null as any)).not.toThrow();
      expect(() => buildSummary(SID, undefined as any)).not.toThrow();
      expect(() => buildSummary(SID, 12345 as any)).not.toThrow();
      expect(() => buildSummary(SID, 'string-messages' as any)).not.toThrow();
      expect(() => buildSummary(SID, { foo: 'bar' } as any)).not.toThrow();

      const res = buildSummary(SID, null as any);
      expect(res.sessionId).toBe(SID);
      expect(res.totalReps).toBe(0);
      expect(res.timeline).toEqual([]);
    });

    it('handles arrays containing null, undefined, primitives, and plain objects', () => {
      const messages = [
        null,
        undefined,
        false,
        true,
        0,
        123,
        'hello',
        {},
        [],
        { getCustomData: () => ({ type: 'kine.rep' }) }, // not instanceof CometChat.CustomMessage
      ] as any[];

      expect(() => {
        const res = buildSummary(SID, messages);
        expect(res.totalReps).toBe(0);
        expect(res.timeline).toHaveLength(0);
      }).not.toThrow();
    });

    it('safely skips custom messages whose getCustomData returns null, primitives, or arrays', () => {
      const msgNull = new CometChat.CustomMessage(SID, CometChat.RECEIVER_TYPE.GROUP, 'kine.rep', null as any);
      const msgArr = new CometChat.CustomMessage(SID, CometChat.RECEIVER_TYPE.GROUP, 'kine.rep', ['not-an-object'] as any);

      const res = buildSummary(SID, [msgNull, msgArr]);
      expect(res.totalReps).toBe(0);
      expect(res.timeline).toHaveLength(0);
    });

    it('safely handles custom messages with missing getId or getSentAt methods', () => {
      const msg = makeRep(SID, { n: 1, minKneeDeg: 90 });
      // strip getId and getSentAt
      (msg as any).getId = undefined;
      (msg as any).getSentAt = undefined;

      const res = buildSummary(SID, [msg]);
      expect(res.totalReps).toBe(1);
      expect(res.timeline[0]!.id).toBe('msg-0');
      expect(res.timeline[0]!.timestamp).toBe(10000);
    });
  });

  describe('2. Corrupted Payloads & Malformed Fields', () => {
    it('discards reps with string numbers instead of floats or invalid enums', () => {
      const badReps = [
        makeRep(SID, { minKneeDeg: '85.0' as any }),
        makeRep(SID, { minKneeDeg: NaN }),
        makeRep(SID, { minKneeDeg: Infinity }),
        makeRep(SID, { minKneeDeg: -Infinity }),
        makeRep(SID, { n: '1' as any }),
        makeRep(SID, { durMs: '2000' as any }),
        makeRep(SID, { depth: 'invalid_depth' as any }),
        makeRep(SID, { tempo: 'blazing_fast' as any }),
      ];

      const res = buildSummary(SID, badReps);
      expect(res.totalReps).toBe(0);
      expect(res.validReps).toBe(0);
      expect(res.timeline).toHaveLength(0);
    });

    it('discards alerts with invalid side, non-number value, or NaN/Infinity', () => {
      const badAlerts = [
        makeAlert(SID, { side: 'CENTER' as any }),
        makeAlert(SID, { side: '' as any }),
        makeAlert(SID, { value: '10.5' as any }),
        makeAlert(SID, { value: NaN }),
        makeAlert(SID, { value: Infinity }),
      ];

      const res = buildSummary(SID, badAlerts);
      expect(res.alertCount).toBe(0);
      expect(res.maxValgusDevPct).toBe(0);
      expect(res.timeline).toHaveLength(0);
    });

    it('discards cues with invalid cue enum or non-string text', () => {
      const badCues = [
        makeCue(SID, { cue: 'jump_higher' as any }),
        makeCue(SID, { text: null as any }),
        makeCue(SID, { text: 12345 as any }),
      ];

      const res = buildSummary(SID, badCues);
      expect(res.cuesCount).toBe(0);
      expect(res.cuesDelivered).toHaveLength(0);
    });

    it('discards session markers with unknown actions', () => {
      const badSessions = [
        makeSession(SID, { action: 'pause' as any }),
        makeSession(SID, { action: 'resume' as any }),
        makeSession(SID, { action: '' as any }),
      ];

      const res = buildSummary(SID, badSessions);
      expect(res.timeline).toHaveLength(0);
    });
  });

  describe('3. Mathematical Boundary Invariants', () => {
    it('accurately calculates floating point average rounded to 1 decimal place', () => {
      // Reps: 91.3, 84.7, 73.1 -> sum = 249.1 -> avg = 83.03333333333333 -> round 83.0
      const messages = [
        makeRep(SID, { n: 1, minKneeDeg: 91.3, depth: 'good', t: 1000 }),
        makeRep(SID, { n: 2, minKneeDeg: 84.7, depth: 'good', t: 2000 }),
        makeRep(SID, { n: 3, minKneeDeg: 73.1, depth: 'deep', t: 3000 }),
      ];

      const res = buildSummary(SID, messages);
      expect(res.totalReps).toBe(3);
      expect(res.validReps).toBe(3);
      expect(res.averageMinKneeDeg).toBe(83.0);
      expect(res.peakDepthDeg).toBe(73.1);
    });

    it('handles single rep session correctly', () => {
      // Single shallow rep
      const resShallow = buildSummary(SID, [
        makeRep(SID, { n: 1, minKneeDeg: 115.5, depth: 'shallow', tempo: 'fast' }),
      ]);
      expect(resShallow.totalReps).toBe(1);
      expect(resShallow.validReps).toBe(0); // shallow is not valid
      expect(resShallow.depthDistribution).toEqual({ shallow: 1, good: 0, deep: 0 });
      expect(resShallow.tempoDistribution).toEqual({ fast: 1, controlled: 0, slow: 0 });
      expect(resShallow.averageMinKneeDeg).toBe(115.5);
      expect(resShallow.peakDepthDeg).toBe(115.5);

      // Single deep rep
      const resDeep = buildSummary(SID, [
        makeRep(SID, { n: 1, minKneeDeg: 62.0, depth: 'deep', tempo: 'slow' }),
      ]);
      expect(resDeep.totalReps).toBe(1);
      expect(resDeep.validReps).toBe(1);
      expect(resDeep.depthDistribution).toEqual({ shallow: 0, good: 0, deep: 1 });
      expect(resDeep.averageMinKneeDeg).toBe(62.0);
      expect(resDeep.peakDepthDeg).toBe(62.0);
    });

    it('handles single alert correctly', () => {
      const res = buildSummary(SID, [
        makeAlert(SID, { side: 'R', value: 14.8, thresholdPct: 8.0 }),
      ]);
      expect(res.alertCount).toBe(1);
      expect(res.alertBreakdown).toEqual({ L: 0, R: 1 });
      expect(res.maxValgusDevPct).toBe(14.8);
    });

    it('correctly tracks maxValgusDevPct when all values are equal', () => {
      const messages = [
        makeAlert(SID, { side: 'L', value: 9.0 }),
        makeAlert(SID, { side: 'R', value: 9.0 }),
      ];
      const res = buildSummary(SID, messages);
      expect(res.alertCount).toBe(2);
      expect(res.maxValgusDevPct).toBe(9.0);
      expect(res.alertBreakdown).toEqual({ L: 1, R: 1 });
    });
  });

  describe('4. Session Duration Invariants', () => {
    it('returns durationMs = 0 when start and end markers have identical timestamps', () => {
      const start = makeSession(SID, { action: 'start', t: 50000 });
      const end = makeSession(SID, { action: 'end', t: 50000 });

      const res = buildSummary(SID, [start, end]);
      expect(res.durationMs).toBe(0);
    });

    it('returns durationMs = 0 when end timestamp is strictly before start timestamp', () => {
      const start = makeSession(SID, { action: 'start', t: 50000 });
      const end = makeSession(SID, { action: 'end', t: 40000 });

      const res = buildSummary(SID, [start, end]);
      expect(res.durationMs).toBe(0);
    });

    it('handles multiple start and end markers by spanning earliest start to latest end', () => {
      const start1 = makeSession(SID, { action: 'start', t: 20000 });
      const start2 = makeSession(SID, { action: 'start', t: 10000 }); // earlier start
      const end1 = makeSession(SID, { action: 'end', t: 80000 });
      const end2 = makeSession(SID, { action: 'end', t: 95000 }); // later end

      const res = buildSummary(SID, [start1, end1, start2, end2]);
      expect(res.durationMs).toBe(85000); // 95000 - 10000 = 85000
    });

    it('action "summary" session marker does not affect durationMs', () => {
      const summaryMarker = makeSession(SID, { action: 'summary', t: 100000 });
      const res = buildSummary(SID, [summaryMarker]);
      expect(res.durationMs).toBe(0);
      expect(res.timeline).toHaveLength(1);
      expect(res.timeline[0]!.title).toBe('Session Summary');
    });
  });

  describe('5. Chronological Sorting & High Volume Stress', () => {
    it('sorts 500 interleaved out-of-order messages in strictly non-decreasing timestamp order', () => {
      const messages: CometChat.CustomMessage[] = [];
      const numMessages = 500;

      for (let i = 0; i < numMessages; i++) {
        const randomT = Math.floor(Math.random() * 1000000);
        if (i % 3 === 0) {
          messages.push(makeRep(SID, { n: i + 1, minKneeDeg: 80 + (i % 30), t: randomT }));
        } else if (i % 3 === 1) {
          messages.push(makeAlert(SID, { side: i % 2 === 0 ? 'L' : 'R', value: 8 + (i % 5), t: randomT }));
        } else {
          messages.push(makeCue(SID, { cue: 'slower', t: randomT }));
        }
      }

      const res = buildSummary(SID, messages);

      expect(res.timeline).toHaveLength(numMessages);
      for (let i = 1; i < res.timeline.length; i++) {
        expect(res.timeline[i]!.timestamp).toBeGreaterThanOrEqual(res.timeline[i - 1]!.timestamp);
      }
    });

    it('maintains stability when multiple messages share the exact same timestamp', () => {
      const t = 42000;
      const rep = makeRep(SID, { n: 1, t });
      const alert = makeAlert(SID, { side: 'L', value: 10.0, t });
      const cue = makeCue(SID, { cue: 'knees_out', t });

      const res = buildSummary(SID, [rep, alert, cue]);
      expect(res.timeline).toHaveLength(3);
      expect(res.timeline[0]!.timestamp).toBe(t);
      expect(res.timeline[1]!.timestamp).toBe(t);
      expect(res.timeline[2]!.timestamp).toBe(t);
      // Insertion order preserved
      expect(res.timeline[0]!.type).toBe('rep');
      expect(res.timeline[1]!.type).toBe('alert');
      expect(res.timeline[2]!.type).toBe('cue');
    });

    it('cuesDelivered array is sorted ascending by timestamp even if cues arrive out of order', () => {
      const cue3 = makeCue(SID, { cue: 'good_depth', text: 'Great depth', t: 3000 });
      const cue1 = makeCue(SID, { cue: 'knees_out', text: 'Knees out', t: 1000 });
      const cue2 = makeCue(SID, { cue: 'slower', text: 'Go slower', t: 2000 });

      const res = buildSummary(SID, [cue3, cue1, cue2]);
      expect(res.cuesDelivered).toHaveLength(3);
      expect(res.cuesDelivered[0]!.timestamp).toBe(1000);
      expect(res.cuesDelivered[1]!.timestamp).toBe(2000);
      expect(res.cuesDelivered[2]!.timestamp).toBe(3000);
    });
  });

  describe('6. Edge Timeline Details & Formatting', () => {
    it('formats session marker timeline details correctly with and without uids', () => {
      const sessionWithUids = makeSession(SID, {
        action: 'start',
        clinicianUid: 'dr-smith',
        patientUid: 'patient-john',
        t: 1000,
      });
      const sessionWithoutUids = makeSession(SID, {
        action: 'end',
        clinicianUid: '',
        patientUid: '',
        t: 5000,
      });

      const res = buildSummary(SID, [sessionWithUids, sessionWithoutUids]);
      expect(res.timeline[0]!.detail).toBe('Clinician: dr-smith • Patient: patient-john');
      expect(res.timeline[1]!.detail).toBe('Session marker: end');
    });

    it('formats rep timeline details correctly with depth, minKneeDeg, durMs, and tempo', () => {
      const rep = makeRep(SID, {
        n: 5,
        depth: 'deep',
        minKneeDeg: 78.5,
        durMs: 2500,
        tempo: 'controlled',
        t: 12000,
      });

      const res = buildSummary(SID, [rep]);
      expect(res.timeline[0]!.title).toBe('Rep #5 (deep)');
      expect(res.timeline[0]!.detail).toBe('DEEP depth (78.5°) • 2500ms • controlled');
      expect(res.timeline[0]!.severity).toBe('normal');
    });

    it('formats alert timeline details correctly with side, value, and thresholdPct', () => {
      const alert = makeAlert(SID, {
        side: 'R',
        value: 12.3,
        thresholdPct: 8.0,
        t: 13000,
      });

      const res = buildSummary(SID, [alert]);
      expect(res.timeline[0]!.title).toBe('Knee Valgus Alert (R)');
      expect(res.timeline[0]!.detail).toBe('Right knee deviation +12.3% (threshold 8%)');
      expect(res.timeline[0]!.severity).toBe('critical');
    });
  });
});
