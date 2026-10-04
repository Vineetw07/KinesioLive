import { describe, it, expect } from 'vitest';
import {
  CLINICIAN_UID,
  PATIENT_UID,
  type SessionRequest,
  type SessionResponse
} from '../../shared/src/index.js';
import { dispatchSessionRequest, SpecReferenceServer } from './helpers/specHarness.js';

describe('Session API & User Mapping Test Suite (Features 4 & 5)', () => {
  // =========================================================================
  // FEATURE 4: Session Token Minting (/api/session) (ORIGINAL_REQUEST §R2)
  // =========================================================================

  describe('Feature 4 - Tier 1: Session Token Minting Primary Behavior', () => {
    it('F4-T1.1: POST /api/session returns HTTP 200 for valid session request', async () => {
      const payload: SessionRequest = { role: 'clinician' };
      const res = await dispatchSessionRequest(payload);
      expect(res.status).toBe(200);
      expect(res.data).toBeDefined();
    });

    it('F4-T1.2: POST /api/session response structure conforms to SessionResponse contract', async () => {
      const payload: SessionRequest = { role: 'clinician' };
      const res = await dispatchSessionRequest(payload);
      const data: SessionResponse = res.data;

      expect(typeof data.sessionId).toBe('string');
      expect(typeof data.authToken).toBe('string');
      expect(typeof data.uid).toBe('string');
      expect(typeof data.appId).toBe('string');
      expect(typeof data.region).toBe('string');
    });

    it('F4-T1.3: session response provides a non-empty authToken', async () => {
      const res = await dispatchSessionRequest({ role: 'patient' });
      expect(res.data.authToken).toBeTruthy();
      expect(res.data.authToken.length).toBeGreaterThan(5);
    });

    it('F4-T1.4: session response provides valid non-empty appId and region', async () => {
      const res = await dispatchSessionRequest({ role: 'clinician' });
      expect(res.data.appId).toBeTruthy();
      expect(res.data.region).toBeTruthy();
    });

    it('F4-T1.5: session response provides a non-empty sessionId', async () => {
      const res = await dispatchSessionRequest({ role: 'patient' });
      expect(res.data.sessionId).toBeTruthy();
      expect(typeof res.data.sessionId).toBe('string');
    });
  });

  describe('Feature 4 - Tier 2: Boundary & Corner Cases', () => {
    it('F4-T2.1: omitted sessionId generates auto prefix "kine-"', async () => {
      const res = await dispatchSessionRequest({ role: 'clinician' });
      expect(res.data.sessionId).toMatch(/^kine-/);
    });

    it('F4-T2.2: explicit sessionId is preserved verbatim in response', async () => {
      const customId = 'kine-rehab-station-alpha-42';
      const res = await dispatchSessionRequest({ role: 'clinician', sessionId: customId });
      expect(res.data.sessionId).toBe(customId);
    });

    it('F4-T2.3: empty string sessionId triggers auto-generation with "kine-" prefix', async () => {
      const res = await dispatchSessionRequest({ role: 'patient', sessionId: '' });
      expect(res.data.sessionId).toMatch(/^kine-/);
      expect(res.data.sessionId.length).toBeGreaterThan(5);
    });

    it('F4-T2.4: whitespace-only sessionId triggers auto-generation with "kine-" prefix', async () => {
      const res = await dispatchSessionRequest({ role: 'clinician', sessionId: '    ' });
      expect(res.data.sessionId).toMatch(/^kine-/);
    });

    it('F4-T2.5: extraneous unexpected properties in request payload do not corrupt response', async () => {
      const payloadWithExtras = {
        role: 'patient',
        sessionId: 'kine-safe-room',
        unknownField: 999,
        __proto_injection: 'ignored'
      };
      const res = await dispatchSessionRequest(payloadWithExtras);
      expect(res.status).toBe(200);
      expect(res.data.sessionId).toBe('kine-safe-room');
      expect((res.data as any).unknownField).toBeUndefined();
    });
  });

  // =========================================================================
  // FEATURE 5: Deterministic User/Role Mapping (dr-demo, pt-demo) (ORIGINAL_REQUEST §R2)
  // =========================================================================

  describe('Feature 5 - Tier 1: Deterministic User/Role Mapping Primary Behavior', () => {
    it('F5-T1.1: role "clinician" maps deterministically to uid "dr-demo"', async () => {
      const res = await dispatchSessionRequest({ role: 'clinician' });
      expect(res.status).toBe(200);
      expect(res.data.uid).toBe(CLINICIAN_UID);
      expect(res.data.uid).toBe('dr-demo');
    });

    it('F5-T1.2: role "patient" maps deterministically to uid "pt-demo"', async () => {
      const res = await dispatchSessionRequest({ role: 'patient' });
      expect(res.status).toBe(200);
      expect(res.data.uid).toBe(PATIENT_UID);
      expect(res.data.uid).toBe('pt-demo');
    });

    it('F5-T1.3: clinician session response never returns patient UID', async () => {
      const res = await dispatchSessionRequest({ role: 'clinician' });
      expect(res.data.uid).not.toBe('pt-demo');
    });

    it('F5-T1.4: patient session response never returns clinician UID', async () => {
      const res = await dispatchSessionRequest({ role: 'patient' });
      expect(res.data.uid).not.toBe('dr-demo');
    });

    it('F5-T1.5: session response never leaks secret keys (COMETCHAT_REST_API_KEY / COMETCHAT_AUTH_KEY)', async () => {
      const res = await dispatchSessionRequest({ role: 'clinician' });
      const serialized = JSON.stringify(res.data);
      expect(serialized).not.toContain(process.env.COMETCHAT_AUTH_KEY || 'auth_key_forbidden');
      expect(serialized).not.toContain(process.env.COMETCHAT_REST_API_KEY || 'rest_key_forbidden');
      expect(res.data.apiKey).toBeUndefined();
      expect(res.data.restApiKey).toBeUndefined();
    });
  });

  describe('Feature 5 - Tier 2: Boundary & Corner Cases', () => {
    it('F5-T2.1: invalid role "admin" is rejected with HTTP 400', async () => {
      const res = await dispatchSessionRequest({ role: 'admin' });
      expect(res.status).toBe(400);
      expect(res.data.error).toBeDefined();
    });

    it('F5-T2.2: invalid role "doctor" is rejected with HTTP 400', async () => {
      const res = await dispatchSessionRequest({ role: 'doctor' });
      expect(res.status).toBe(400);
      expect(res.data.error).toBeDefined();
    });

    it('F5-T2.3: missing role property is rejected with HTTP 400', async () => {
      const res = await dispatchSessionRequest({});
      expect(res.status).toBe(400);
      expect(res.data.error).toBeDefined();
    });

    it('F5-T2.4: numeric or non-string role is rejected with HTTP 400', async () => {
      const res1 = await dispatchSessionRequest({ role: 12345 });
      const res2 = await dispatchSessionRequest({ role: null });
      const res3 = await dispatchSessionRequest({ role: true });

      expect(res1.status).toBe(400);
      expect(res2.status).toBe(400);
      expect(res3.status).toBe(400);
    });

    it('F5-T2.5: non-object request body is rejected with HTTP 400', async () => {
      const res1 = await dispatchSessionRequest('invalid-string' as any);
      const res2 = await dispatchSessionRequest(null as any);

      expect(res1.status).toBe(400);
      expect(res2.status).toBe(400);
    });
  });
});
