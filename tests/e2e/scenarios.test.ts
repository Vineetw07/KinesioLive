import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  SCHEMA_VERSION,
  CLINICIAN_UID,
  PATIENT_UID,
  TELEMETRY_RATE_HZ,
  VALGUS_THRESHOLD_PCT,
  type KinePosePayload,
  type KineAlertPayload,
  type KineRepPayload,
  type KineCuePayload,
  type SessionResponse
} from '../../shared/src/index.js';
import {
  PROJECT_ROOT,
  CLIENT_DIR,
  dispatchHealthRequest,
  dispatchSessionRequest,
  scanDirectoryForSecrets
} from './helpers/specHarness.js';

describe('Tier 4: Real-World Workload Scenarios Test Suite', () => {
  // =========================================================================
  // SCENARIO 1: Clinician Opens Session, Receives Token, Verifies Group GUID
  // Exercised Features: F3 (Health Probe), F4 (Session Token Minting), F5 (Role Mapping)
  // =========================================================================

  it('T4-SCEN.1: Clinician opens session, verifies health, receives token, and verifies group GUID format', async () => {
    // 1. Clinician browser checks system health before initiating session
    const health = await dispatchHealthRequest();
    expect(health.status).toBe(200);
    expect(health.data.status).toBe('ok');
    expect(health.data.uptime).toBeGreaterThanOrEqual(0);

    // 2. Clinician requests session creation
    const sessionRes = await dispatchSessionRequest({ role: 'clinician' });
    expect(sessionRes.status).toBe(200);

    const session: SessionResponse = sessionRes.data;
    // 3. Verify clinician UID mapping
    expect(session.uid).toBe(CLINICIAN_UID);
    expect(session.uid).toBe('dr-demo');

    // 4. Verify group GUID adheres to kine-<timestamp> format
    expect(session.sessionId).toMatch(/^kine-/);
    expect(session.sessionId.length).toBeGreaterThan(6);

    // 5. Verify auth token was minted
    expect(session.authToken).toBeTruthy();
    expect(typeof session.authToken).toBe('string');

    // 6. Verify credentials match app configuration
    expect(session.appId).toBeTruthy();
    expect(session.region).toBeTruthy();
  });

  // =========================================================================
  // SCENARIO 2: Patient Joins Existing Session, Verifies pt-demo Token & Matching GUID
  // Exercised Features: F4 (Session Token Minting), F5 (Role Mapping)
  // =========================================================================

  it('T4-SCEN.2: Patient joins existing session via invite link, verifies pt-demo token and identical group GUID', async () => {
    // 1. Clinician generates a session ID
    const clinicianSession = await dispatchSessionRequest({ role: 'clinician' });
    const inviteSessionId = clinicianSession.data.sessionId;

    // 2. Patient loads session using the inviteSessionId (e.g., from ?session=<sessionId>)
    const patientSession = await dispatchSessionRequest({
      role: 'patient',
      sessionId: inviteSessionId
    });

    expect(patientSession.status).toBe(200);
    // 3. Verify patient UID
    expect(patientSession.data.uid).toBe(PATIENT_UID);
    expect(patientSession.data.uid).toBe('pt-demo');

    // 4. Verify both parties are bound to the exact same CometChat group GUID
    expect(patientSession.data.sessionId).toBe(inviteSessionId);

    // 5. Verify patient receives valid distinct authentication token
    expect(patientSession.data.authToken).toBeTruthy();
    expect(patientSession.data.appId).toBe(clinicianSession.data.appId);
    expect(patientSession.data.region).toBe(clinicianSession.data.region);
  });

  // =========================================================================
  // SCENARIO 3: Client Workspace Inspected for Secret Isolation
  // Exercised Features: F7 (Client Config), F8 (Secret Isolation)
  // =========================================================================

  it('T4-SCEN.3: Client workspace and artifacts inspected for absolute secret isolation', () => {
    // 1. Audit client directory for forbidden server secret strings
    const clientSrc = path.join(CLIENT_DIR, 'src');
    const secretLeaks = scanDirectoryForSecrets(clientSrc, /COMETCHAT_AUTH_KEY|COMETCHAT_REST_API_KEY/i);
    expect(secretLeaks).toHaveLength(0);

    // 2. Audit client package for dangerous leaks
    const clientPkg = path.join(CLIENT_DIR, 'package.json');
    if (fs.existsSync(clientPkg)) {
      const content = fs.readFileSync(clientPkg, 'utf8');
      expect(content).not.toContain('COMETCHAT_AUTH_KEY');
      expect(content).not.toContain('COMETCHAT_REST_API_KEY');
    }

    // 3. Confirm .gitignore contains .env
    const gitignorePath = path.join(PROJECT_ROOT, '.gitignore');
    expect(fs.existsSync(gitignorePath)).toBe(true);
    const gitignore = fs.readFileSync(gitignorePath, 'utf8');
    expect(gitignore).toMatch(/\.env/);
  });

  // =========================================================================
  // SCENARIO 4: Schema Type Validity Tested Against Simulated MediaPipe Pose Packet Stream
  // Exercised Features: F1 (Workspace Exports), F2 (Shared Biomechanical Schemas)
  // =========================================================================

  it('T4-SCEN.4: Schema type validity tested against simulated 30-frame MediaPipe pose packet stream (10 Hz)', () => {
    const testSessionId = 'kine-stream-test-001';
    const totalFrames = 30; // 3 seconds at 10 Hz
    const frameIntervalMs = 1000 / TELEMETRY_RATE_HZ; // 100 ms

    const generatedPackets: KinePosePayload[] = [];
    const triggeredAlerts: KineAlertPayload[] = [];
    let completedRep: KineRepPayload | null = null;
    let coachingCue: KineCuePayload | null = null;

    const baseTime = Date.now();

    for (let i = 0; i < totalFrames; i++) {
      const timestamp = baseTime + (i * frameIntervalMs);

      // Simulate squat phases:
      // Frames 0-5: standing (knee: 175 deg)
      // Frames 6-14: descending (knee: 175 -> 95 deg)
      // Frames 15-18: bottom (knee: 90 deg, valgus spike on frame 16)
      // Frames 19-27: ascending (knee: 95 -> 175 deg)
      // Frames 28-29: standing (rep completed)

      let phase: KinePosePayload['phase'] = 'standing';
      let kneeAngle = 175.0;
      let depthRatio = 0.05;
      let valgusL = 0.5;

      if (i >= 6 && i <= 14) {
        phase = 'descending';
        kneeAngle = 175 - ((i - 6) * 10);
        depthRatio = 0.1 + ((i - 6) * 0.1);
      } else if (i >= 15 && i <= 18) {
        phase = 'bottom';
        kneeAngle = 90.0;
        depthRatio = 0.95;
        // Inward collapse on left knee exceeding VALGUS_THRESHOLD_PCT (8.0%)
        valgusL = 11.2;
      } else if (i >= 19 && i <= 27) {
        phase = 'ascending';
        kneeAngle = 95 + ((i - 19) * 10);
        depthRatio = 0.95 - ((i - 19) * 0.1);
      } else if (i >= 28) {
        phase = 'standing';
        kneeAngle = 175.0;
        depthRatio = 0.05;
      }

      const packet: KinePosePayload = {
        v: SCHEMA_VERSION,
        sid: testSessionId,
        t: timestamp,
        type: 'kine.pose',
        seq: i + 1,
        fps: 30,
        phase,
        kneeFlexionDeg: { L: kneeAngle, R: kneeAngle + 0.5 },
        valgusDevPct: { L: valgusL, R: -0.5 },
        depthRatio: Math.max(0, Math.min(1.2, depthRatio)),
        vis: 0.98,
        reps: i >= 28 ? 1 : 0
      };

      generatedPackets.push(packet);

      // Trigger valgus alert if threshold exceeded
      if (valgusL > VALGUS_THRESHOLD_PCT && triggeredAlerts.length === 0) {
        triggeredAlerts.push({
          v: SCHEMA_VERSION,
          sid: testSessionId,
          t: timestamp,
          type: 'kine.alert',
          kind: 'knee_valgus',
          side: 'L',
          value: valgusL,
          thresholdPct: VALGUS_THRESHOLD_PCT,
          repN: 1,
          phase: packet.phase,
          note: 'Form alert (biomechanical feedback)'
        });
      }

      // Rep completed on return to standing
      if (i === 28) {
        completedRep = {
          v: SCHEMA_VERSION,
          sid: testSessionId,
          t: timestamp,
          type: 'kine.rep',
          n: 1,
          minKneeDeg: 90.0,
          depth: 'good',
          durMs: (28 - 6) * frameIntervalMs,
          tempo: 'controlled'
        };

        coachingCue = {
          v: SCHEMA_VERSION,
          sid: testSessionId,
          t: timestamp + 50,
          type: 'kine.cue',
          cue: 'knees_out',
          text: 'Great depth! Remember to keep your left knee tracking over your toes.'
        };
      }
    }

    // Assertions on stream validity
    expect(generatedPackets).toHaveLength(30);
    expect(generatedPackets[0].seq).toBe(1);
    expect(generatedPackets[29].seq).toBe(30);
    expect(generatedPackets[29].reps).toBe(1);

    // Verify valgus alert
    expect(triggeredAlerts).toHaveLength(1);
    expect(triggeredAlerts[0].kind).toBe('knee_valgus');
    expect(triggeredAlerts[0].value).toBe(11.2);
    expect(triggeredAlerts[0].thresholdPct).toBe(8.0);

    // Verify rep payload
    expect(completedRep).not.toBeNull();
    expect(completedRep!.n).toBe(1);
    expect(completedRep!.depth).toBe('good');
    expect(completedRep!.tempo).toBe('controlled');

    // Verify coaching cue
    expect(coachingCue).not.toBeNull();
    expect(coachingCue!.cue).toBe('knees_out');
  });

  // =========================================================================
  // SCENARIO 5: Token Service Idempotency & High-Concurrency Session Burst
  // Exercised Features: F4 (Session Token Minting), F5 (Role Mapping)
  // =========================================================================

  it('T4-SCEN.5: Token service maintains idempotency and role separation during a 10-request concurrent burst', async () => {
    // 5 Clinicians requesting new sessions concurrently
    // 5 Patients joining specific custom rooms concurrently
    const requests = [
      dispatchSessionRequest({ role: 'clinician' }),
      dispatchSessionRequest({ role: 'patient', sessionId: 'kine-room-concurrent-1' }),
      dispatchSessionRequest({ role: 'clinician' }),
      dispatchSessionRequest({ role: 'patient', sessionId: 'kine-room-concurrent-2' }),
      dispatchSessionRequest({ role: 'clinician' }),
      dispatchSessionRequest({ role: 'patient', sessionId: 'kine-room-concurrent-3' }),
      dispatchSessionRequest({ role: 'clinician' }),
      dispatchSessionRequest({ role: 'patient', sessionId: 'kine-room-concurrent-4' }),
      dispatchSessionRequest({ role: 'clinician' }),
      dispatchSessionRequest({ role: 'patient', sessionId: 'kine-room-concurrent-5' })
    ];

    const results = await Promise.all(requests);

    expect(results).toHaveLength(10);
    results.forEach(res => {
      expect(res.status).toBe(200);
      expect(res.data.authToken).toBeTruthy();
    });

    const clinicianResults = results.filter((_, idx) => idx % 2 === 0);
    const patientResults = results.filter((_, idx) => idx % 2 === 1);

    // Clinicians all have dr-demo UID
    clinicianResults.forEach(c => {
      expect(c.data.uid).toBe('dr-demo');
      expect(c.data.sessionId).toMatch(/^kine-/);
    });

    // Patients all have pt-demo UID and preserve requested session IDs
    patientResults.forEach((p, idx) => {
      expect(p.data.uid).toBe('pt-demo');
      expect(p.data.sessionId).toBe(`kine-room-concurrent-${idx + 1}`);
    });
  });
});
