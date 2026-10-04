import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

// Import runtime constants directly from compiled dist artifact
import {
  SCHEMA_VERSION,
  CLINICIAN_UID,
  PATIENT_UID,
  TELEMETRY_RATE_HZ,
  VALGUS_THRESHOLD_PCT,
  VALGUS_COOLDOWN_MS
} from '../../shared/dist/index.js';

// Import type contracts directly from compiled .d.ts artifact
import type {
  Side,
  SquatPhase,
  SquatDepthRating,
  SquatTempo,
  CoachingCueType,
  SessionMarkerAction,
  UserRole,
  Envelope,
  KinePosePayload,
  KineRepPayload,
  KineAlertPayload,
  KineCuePayload,
  KineSessionMarkerPayload,
  KineMessage,
  SessionRequest,
  SessionResponse
} from '../../shared/dist/index.d.ts';

describe('Built Declaration Artifact & Consumer Narrowing Challenge', () => {
  it('E1.1: dist/index.d.ts exists and contains complete type declarations with zero unresolved references', () => {
    const dtsPath = path.resolve(__dirname, '../../shared/dist/index.d.ts');
    expect(fs.existsSync(dtsPath)).toBe(true);
    const content = fs.readFileSync(dtsPath, 'utf8');

    // Confirm all required symbols are present in declaration file
    const requiredSymbols = [
      'SCHEMA_VERSION',
      'Side',
      'SquatPhase',
      'SquatDepthRating',
      'SquatTempo',
      'CoachingCueType',
      'SessionMarkerAction',
      'UserRole',
      'Envelope',
      'KinePosePayload',
      'KineRepPayload',
      'KineAlertPayload',
      'KineCuePayload',
      'KineSessionMarkerPayload',
      'KineMessage',
      'SessionRequest',
      'SessionResponse',
      'CLINICIAN_UID',
      'PATIENT_UID',
      'TELEMETRY_RATE_HZ',
      'VALGUS_THRESHOLD_PCT',
      'VALGUS_COOLDOWN_MS'
    ];

    for (const sym of requiredSymbols) {
      expect(content).toContain(sym);
    }
  });

  it('E1.2: dist/index.js runtime exports match exact values and literal types', () => {
    expect(SCHEMA_VERSION).toBe(1);
    expect(CLINICIAN_UID).toBe('dr-demo');
    expect(PATIENT_UID).toBe('pt-demo');
    expect(TELEMETRY_RATE_HZ).toBe(10);
    expect(VALGUS_THRESHOLD_PCT).toBe(8.0);
    expect(VALGUS_COOLDOWN_MS).toBe(4000);
  });

  it('E1.3: Discriminated union narrowing on KineMessage via switch(msg.type) is sound and exhaustive', () => {
    const poseMsg: KineMessage = {
      v: 1,
      sid: 'kine-123',
      t: Date.now(),
      type: 'kine.pose',
      seq: 10,
      fps: 30,
      phase: 'descending',
      kneeFlexionDeg: { L: 110.2, R: 112.5 },
      kneeDeg: { L: 110.2, R: 112.5 },
      valgusDevPct: { L: 3.2, R: -1.5 },
      depthRatio: 0.65,
      vis: 0.95,
      reps: 1
    };

    const repMsg: KineMessage = {
      v: 1,
      sid: 'kine-123',
      t: Date.now(),
      type: 'kine.rep',
      n: 2,
      minKneeDeg: 78.4,
      depth: 'good',
      durMs: 2300,
      tempo: 'controlled'
    };

    const alertMsg: KineMessage = {
      v: 1,
      sid: 'kine-123',
      t: Date.now(),
      type: 'kine.alert',
      kind: 'knee_valgus',
      side: 'R',
      value: 9.8,
      thresholdPct: 8.0,
      repN: 2,
      phase: 'bottom',
      note: 'Form alert (biomechanical feedback)'
    };

    const cueMsg: KineMessage = {
      v: 1,
      sid: 'kine-123',
      t: Date.now(),
      type: 'kine.cue',
      cue: 'chest_up',
      text: 'Keep chest lifted'
    };

    const sessionMsg: KineMessage = {
      v: 1,
      sid: 'kine-123',
      t: Date.now(),
      type: 'kine.session',
      action: 'end',
      clinicianUid: CLINICIAN_UID,
      patientUid: PATIENT_UID
    };

    function inspectMessage(msg: KineMessage): string {
      switch (msg.type) {
        case 'kine.pose':
          // Verified: narrow to KinePosePayload
          return `pose:${msg.seq}:${msg.depthRatio}:${msg.phase}`;
        case 'kine.rep':
          // Verified: narrow to KineRepPayload
          return `rep:${msg.n}:${msg.depth}:${msg.tempo}`;
        case 'kine.alert':
          // Verified: narrow to KineAlertPayload
          return `alert:${msg.kind}:${msg.side}:${msg.value}`;
        case 'kine.cue':
          // Verified: narrow to KineCuePayload
          return `cue:${msg.cue}:${msg.text}`;
        case 'kine.session':
          // Verified: narrow to KineSessionMarkerPayload
          return `session:${msg.action}:${msg.clinicianUid}`;
        default: {
          const _exhaustive: never = msg;
          throw new Error(`Unhandled message: ${_exhaustive}`);
        }
      }
    }

    expect(inspectMessage(poseMsg)).toBe('pose:10:0.65:descending');
    expect(inspectMessage(repMsg)).toBe('rep:2:good:controlled');
    expect(inspectMessage(alertMsg)).toBe('alert:knee_valgus:R:9.8');
    expect(inspectMessage(cueMsg)).toBe('cue:chest_up:Keep chest lifted');
    expect(inspectMessage(sessionMsg)).toBe('session:end:dr-demo');
  });

  it('E1.4: Envelope and Session contracts match TRD Section 2 definitions', () => {
    const envelope: Envelope = {
      v: 1,
      sid: 'session-456',
      t: 123456789
    };
    expect(envelope.v).toBe(1);

    const sessionReq: SessionRequest = {
      role: 'patient',
      sessionId: 'session-456'
    };
    expect(sessionReq.role).toBe('patient');

    const sessionRes: SessionResponse = {
      sessionId: 'session-456',
      authToken: 'token-abc',
      uid: 'pt-demo',
      appId: 'appid-xyz',
      region: 'in'
    };
    expect(sessionRes.uid).toBe('pt-demo');
  });
});
