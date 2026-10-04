/**
 * tests/summary.test.ts
 *
 * Non-tautological unit test suite for Milestone D5.3 Biomechanical Summary Engine.
 * Verifies buildSummary aggregation, math formulas, out-of-order sorting,
 * boundary discarding, and session duration without network dependencies.
 *
 * Strictly adheres to:
 * - ORIGINAL_REQUEST.md § R3 (lines 410–470) & § Verification (lines 511–526)
 * - Antigravity Master Engineering Protocol § Critic Rubric C1 & C4
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
// Deterministic Fixture Helpers
// ----------------------------------------------------------------------------
function makeRepMessage(sessionId: string, payload: KineRepPayload): CometChat.CustomMessage {
  const msg = new CometChat.CustomMessage(
    sessionId,
    CometChat.RECEIVER_TYPE.GROUP,
    'kine.rep',
    payload as unknown as Record<string, unknown>
  );
  if (typeof (msg as any).setSentAt === 'function') {
    (msg as any).setSentAt(payload.t);
  }
  return msg;
}

function makeAlertMessage(sessionId: string, payload: KineAlertPayload): CometChat.CustomMessage {
  const msg = new CometChat.CustomMessage(
    sessionId,
    CometChat.RECEIVER_TYPE.GROUP,
    'kine.alert',
    payload as unknown as Record<string, unknown>
  );
  if (typeof (msg as any).setSentAt === 'function') {
    (msg as any).setSentAt(payload.t);
  }
  return msg;
}

function makeCueMessage(sessionId: string, payload: KineCuePayload): CometChat.CustomMessage {
  const msg = new CometChat.CustomMessage(
    sessionId,
    CometChat.RECEIVER_TYPE.GROUP,
    'kine.cue',
    payload as unknown as Record<string, unknown>
  );
  if (typeof (msg as any).setSentAt === 'function') {
    (msg as any).setSentAt(payload.t);
  }
  return msg;
}

function makeSessionMessage(
  sessionId: string,
  payload: KineSessionMarkerPayload
): CometChat.CustomMessage {
  const msg = new CometChat.CustomMessage(
    sessionId,
    CometChat.RECEIVER_TYPE.GROUP,
    'kine.session',
    payload as unknown as Record<string, unknown>
  );
  if (typeof (msg as any).setSentAt === 'function') {
    (msg as any).setSentAt(payload.t);
  }
  return msg;
}

describe('Biomechanical Summary Engine (D5.3) - buildSummary()', () => {
  const SID = 'kine-test-room-42';

  // 1. Empty session
  it('handles empty session: 0 messages -> all counts 0, durationMs 0, no division-by-zero thrown', () => {
    const summary = buildSummary(SID, []);

    expect(summary.sessionId).toBe(SID);
    expect(summary.durationMs).toBe(0);
    expect(summary.totalReps).toBe(0);
    expect(summary.validReps).toBe(0);
    expect(summary.depthDistribution).toEqual({ shallow: 0, good: 0, deep: 0 });
    expect(summary.tempoDistribution).toEqual({ fast: 0, controlled: 0, slow: 0 });
    expect(summary.averageMinKneeDeg).toBe(0);
    expect(summary.peakDepthDeg).toBe(0);
    expect(summary.alertCount).toBe(0);
    expect(summary.alertBreakdown).toEqual({ L: 0, R: 0 });
    expect(summary.maxValgusDevPct).toBe(0);
    expect(summary.cuesCount).toBe(0);
    expect(summary.cuesDelivered).toEqual([]);
    expect(summary.timeline).toEqual([]);
  });

  // 2. 3-rep session (shallow + good + deep)
  it('aggregates 3-rep session (shallow + good + deep) with correct distributions and math', () => {
    const rep1: KineRepPayload = {
      v: SCHEMA_VERSION,
      sid: SID,
      t: 10000,
      type: 'kine.rep',
      n: 1,
      minKneeDeg: 110.0,
      depth: 'shallow',
      durMs: 1100,
      tempo: 'fast',
    };
    const rep2: KineRepPayload = {
      v: SCHEMA_VERSION,
      sid: SID,
      t: 20000,
      type: 'kine.rep',
      n: 2,
      minKneeDeg: 95.0,
      depth: 'good',
      durMs: 2200,
      tempo: 'controlled',
    };
    const rep3: KineRepPayload = {
      v: SCHEMA_VERSION,
      sid: SID,
      t: 30000,
      type: 'kine.rep',
      n: 3,
      minKneeDeg: 80.0,
      depth: 'deep',
      durMs: 3600,
      tempo: 'slow',
    };

    const messages = [
      makeRepMessage(SID, rep1),
      makeRepMessage(SID, rep2),
      makeRepMessage(SID, rep3),
    ];

    const summary = buildSummary(SID, messages);

    expect(summary.totalReps).toBe(3);
    expect(summary.validReps).toBe(2); // shallow rep excluded from valid reps
    expect(summary.depthDistribution).toEqual({ shallow: 1, good: 1, deep: 1 });
    expect(summary.tempoDistribution).toEqual({ fast: 1, controlled: 1, slow: 1 });
    expect(summary.averageMinKneeDeg).toBe(95.0); // (110 + 95 + 80) / 3 = 95.0
    expect(summary.peakDepthDeg).toBe(80.0); // deepest angle = Math.min(110, 95, 80)
    expect(summary.timeline.length).toBe(3);
    expect(summary.timeline[0]!.title).toBe('Rep #1 (shallow)');
    expect(summary.timeline[1]!.title).toBe('Rep #2 (good)');
    expect(summary.timeline[2]!.title).toBe('Rep #3 (deep)');
    expect(summary.timeline.every((e) => e.severity === 'normal')).toBe(true);
  });

  // 3. Valgus alert aggregation
  it('aggregates valgus alerts: 2 L-side (9.4, 11.2) and 1 R-side (8.3) -> breakdown {L:2, R:1}, maxValgusDevPct 11.2', () => {
    const alert1: KineAlertPayload = {
      v: SCHEMA_VERSION,
      sid: SID,
      t: 12000,
      type: 'kine.alert',
      kind: 'knee_valgus',
      side: 'L',
      value: 9.4,
      thresholdPct: 8.0,
      repN: 1,
      phase: 'descending',
      note: 'Form alert (biomechanical feedback)',
    };
    const alert2: KineAlertPayload = {
      v: SCHEMA_VERSION,
      sid: SID,
      t: 22000,
      type: 'kine.alert',
      kind: 'knee_valgus',
      side: 'L',
      value: 11.2,
      thresholdPct: 8.0,
      repN: 2,
      phase: 'bottom',
      note: 'Form alert (biomechanical feedback)',
    };
    const alert3: KineAlertPayload = {
      v: SCHEMA_VERSION,
      sid: SID,
      t: 22500,
      type: 'kine.alert',
      kind: 'knee_valgus',
      side: 'R',
      value: 8.3,
      thresholdPct: 8.0,
      repN: 2,
      phase: 'bottom',
      note: 'Form alert (biomechanical feedback)',
    };

    const messages = [
      makeAlertMessage(SID, alert1),
      makeAlertMessage(SID, alert2),
      makeAlertMessage(SID, alert3),
    ];

    const summary = buildSummary(SID, messages);

    expect(summary.alertCount).toBe(3);
    expect(summary.alertBreakdown).toEqual({ L: 2, R: 1 });
    expect(summary.maxValgusDevPct).toBe(11.2);
    expect(summary.timeline.length).toBe(3);
    expect(summary.timeline.every((e) => e.severity === 'critical')).toBe(true);
    expect(summary.timeline[0]!.detail).toContain('Left knee deviation +9.4%');
    expect(summary.timeline[1]!.detail).toContain('Left knee deviation +11.2%');
    expect(summary.timeline[2]!.detail).toContain('Right knee deviation +8.3%');
  });

  // 4. Cue delivery tracking
  it('tracks cue deliveries: 3 cue messages -> cuesCount 3, correct cue enums and text', () => {
    const cue1: KineCuePayload = {
      v: SCHEMA_VERSION,
      sid: SID,
      t: 15000,
      type: 'kine.cue',
      cue: 'knees_out',
      text: 'Drive knees outward over toes',
    };
    const cue2: KineCuePayload = {
      v: SCHEMA_VERSION,
      sid: SID,
      t: 25000,
      type: 'kine.cue',
      cue: 'slower',
      text: 'Slow down descent',
    };
    const cue3: KineCuePayload = {
      v: SCHEMA_VERSION,
      sid: SID,
      t: 35000,
      type: 'kine.cue',
      cue: 'chest_up',
      text: 'Keep chest upright',
    };

    const messages = [
      makeCueMessage(SID, cue1),
      makeCueMessage(SID, cue2),
      makeCueMessage(SID, cue3),
    ];

    const summary = buildSummary(SID, messages);

    expect(summary.cuesCount).toBe(3);
    expect(summary.cuesDelivered).toHaveLength(3);
    expect(summary.cuesDelivered[0]).toEqual({
      cue: 'knees_out',
      text: 'Drive knees outward over toes',
      timestamp: 15000,
    });
    expect(summary.cuesDelivered[1]).toEqual({
      cue: 'slower',
      text: 'Slow down descent',
      timestamp: 25000,
    });
    expect(summary.cuesDelivered[2]).toEqual({
      cue: 'chest_up',
      text: 'Keep chest upright',
      timestamp: 35000,
    });
    expect(summary.timeline).toHaveLength(3);
    expect(summary.timeline[0]!.title).toBe('Coaching Cue: knees out');
  });

  // 5. Out-of-order timestamps
  it('sorts timeline chronologically when messages arrive in reverse order', () => {
    const rep3 = makeRepMessage(SID, {
      v: SCHEMA_VERSION,
      sid: SID,
      t: 50000,
      type: 'kine.rep',
      n: 3,
      minKneeDeg: 85.0,
      depth: 'good',
      durMs: 2000,
      tempo: 'controlled',
    });
    const cue1 = makeCueMessage(SID, {
      v: SCHEMA_VERSION,
      sid: SID,
      t: 30000,
      type: 'kine.cue',
      cue: 'knees_out',
      text: 'Push knees out',
    });
    const sessionStart = makeSessionMessage(SID, {
      v: SCHEMA_VERSION,
      sid: SID,
      t: 10000,
      type: 'kine.session',
      action: 'start',
      clinicianUid: CLINICIAN_UID,
      patientUid: PATIENT_UID,
    });
    const sessionEnd = makeSessionMessage(SID, {
      v: SCHEMA_VERSION,
      sid: SID,
      t: 60000,
      type: 'kine.session',
      action: 'end',
      clinicianUid: CLINICIAN_UID,
      patientUid: PATIENT_UID,
    });

    // Provide in reverse chronological order
    const messages = [sessionEnd, rep3, cue1, sessionStart];

    const summary = buildSummary(SID, messages);

    expect(summary.timeline).toHaveLength(4);
    expect(summary.timeline[0]!.timestamp).toBe(10000);
    expect(summary.timeline[1]!.timestamp).toBe(30000);
    expect(summary.timeline[2]!.timestamp).toBe(50000);
    expect(summary.timeline[3]!.timestamp).toBe(60000);

    for (let i = 1; i < summary.timeline.length; i++) {
      expect(summary.timeline[i]!.timestamp).toBeGreaterThanOrEqual(
        summary.timeline[i - 1]!.timestamp
      );
    }
  });

  // 6. Malformed message discarding
  it('discards malformed messages, non-CustomMessage instances, and corrupted payloads cleanly', () => {
    // A non-CustomMessage base message
    const nonCustomMsg = {
      getId: () => 999,
      getSentAt: () => 1000,
      getType: () => 'text',
    } as unknown as CometChat.BaseMessage;

    // CustomMessage with null customData
    const emptyCustomMsg = new CometChat.CustomMessage(
      SID,
      CometChat.RECEIVER_TYPE.GROUP,
      'kine.empty',
      null as any
    );

    // CustomMessage with unknown type
    const unknownTypeMsg = new CometChat.CustomMessage(
      SID,
      CometChat.RECEIVER_TYPE.GROUP,
      'unknown.type',
      { type: 'kine.unknown', foo: 'bar' }
    );

    // Corrupted rep payload (missing minKneeDeg, invalid tempo)
    const corruptedRepMsg = new CometChat.CustomMessage(
      SID,
      CometChat.RECEIVER_TYPE.GROUP,
      'kine.rep',
      { type: 'kine.rep', n: 1, minKneeDeg: NaN, depth: 'invalid_depth', durMs: -10 }
    );

    // Corrupted alert payload (invalid side)
    const corruptedAlertMsg = new CometChat.CustomMessage(
      SID,
      CometChat.RECEIVER_TYPE.GROUP,
      'kine.alert',
      { type: 'kine.alert', side: 'CENTER', value: 12.0 }
    );

    // Exactly one valid rep
    const validRep = makeRepMessage(SID, {
      v: SCHEMA_VERSION,
      sid: SID,
      t: 15000,
      type: 'kine.rep',
      n: 1,
      minKneeDeg: 90.0,
      depth: 'good',
      durMs: 1800,
      tempo: 'controlled',
    });

    const messages = [
      nonCustomMsg,
      emptyCustomMsg,
      unknownTypeMsg,
      corruptedRepMsg,
      corruptedAlertMsg,
      validRep,
    ];

    expect(() => {
      const summary = buildSummary(SID, messages);
      expect(summary.totalReps).toBe(1);
      expect(summary.validReps).toBe(1);
      expect(summary.alertCount).toBe(0);
      expect(summary.timeline).toHaveLength(1);
    }).not.toThrow();
  });

  // 7. Session duration calculation
  it('computes session duration: start (t=1000) and end (t=61000) -> durationMs 60000; 0 if either missing or inverted', () => {
    const startMsg = makeSessionMessage(SID, {
      v: SCHEMA_VERSION,
      sid: SID,
      t: 1000,
      type: 'kine.session',
      action: 'start',
      clinicianUid: CLINICIAN_UID,
      patientUid: PATIENT_UID,
    });
    const endMsg = makeSessionMessage(SID, {
      v: SCHEMA_VERSION,
      sid: SID,
      t: 61000,
      type: 'kine.session',
      action: 'end',
      clinicianUid: CLINICIAN_UID,
      patientUid: PATIENT_UID,
    });

    // Both markers present
    const summary = buildSummary(SID, [startMsg, endMsg]);
    expect(summary.durationMs).toBe(60000);

    // End marker only -> durationMs 0
    const endOnlySummary = buildSummary(SID, [endMsg]);
    expect(endOnlySummary.durationMs).toBe(0);

    // Start marker only -> durationMs 0
    const startOnlySummary = buildSummary(SID, [startMsg]);
    expect(startOnlySummary.durationMs).toBe(0);

    // Inverted timestamps (end < start) -> durationMs 0
    const invertedEndMsg = makeSessionMessage(SID, {
      v: SCHEMA_VERSION,
      sid: SID,
      t: 500,
      type: 'kine.session',
      action: 'end',
      clinicianUid: CLINICIAN_UID,
      patientUid: PATIENT_UID,
    });
    const invertedSummary = buildSummary(SID, [startMsg, invertedEndMsg]);
    expect(invertedSummary.durationMs).toBe(0);
  });
});
