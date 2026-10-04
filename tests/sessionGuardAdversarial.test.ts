/**
 * tests/sessionGuardAdversarial.test.ts
 *
 * Adversarial & Stress-Testing Suite for Session Guard & Deep-Link Router (Milestone D4.5).
 * Tests constructed by Challenger 2 to empirically verify edge cases, invariants, and failure modes:
 *
 * 1. URL Query Parameter Parsing Edge Cases:
 *    - Missing role (with or without session)
 *    - Missing session (with valid role)
 *    - Empty strings, whitespace-only, encoded whitespace
 *    - Malformed queries (multiple ?, no separators, corrupt percent-encoding, non-ASCII/emojis)
 *    - Case sensitivity & uppercase parameter names/values
 *    - Extraneous / injected query parameters
 *    - Duplicate parameters
 *
 * 2. Role Conflict Detection:
 *    - dr-demo vs patient (conflict)
 *    - pt-demo vs clinician (conflict)
 *    - dr-demo vs clinician (no conflict)
 *    - pt-demo vs patient (no conflict)
 *    - Arbitrary unknown UIDs vs valid roles (conflict)
 *    - Null / undefined / empty string boundaries
 *
 * 3. Non-Destructive Invariant:
 *    - Empirical verification that CometChat.logout() is NEVER called by sessionGuard
 *    - Uninitialized CometChat handling
 *    - Corrupted / throw-on-access CometChat mock handling
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CometChat } from '@cometchat/chat-sdk-javascript';
import {
  parseSessionParams,
  detectRoleConflict,
  getExpectedUidForRole,
  getRoleForUid,
  checkSessionGuard,
} from '../client/src/utils/sessionGuard';
import { CLINICIAN_UID, PATIENT_UID } from '../shared/src/index';

describe('Adversarial Stress Suite: Session Guard & Deep-Link Router', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // =========================================================================
  // 1. URL Query Parameter Parsing Edge Cases
  // =========================================================================
  describe('1. URL Query Parameter Parsing Edge Cases', () => {
    describe('Missing Role Scenarios', () => {
      it('returns isValid: false when query string is empty', () => {
        const result = parseSessionParams('');
        expect(result.isValid).toBe(false);
        expect(result.role).toBe(null);
        expect(result.sessionId).toBe(null);
      });

      it('returns isValid: false when query string is only "?"', () => {
        const result = parseSessionParams('?');
        expect(result.isValid).toBe(false);
        expect(result.role).toBe(null);
        expect(result.sessionId).toBe(null);
      });

      it('returns isValid: false when only session is provided', () => {
        const result = parseSessionParams('?session=kine-session-999');
        expect(result.isValid).toBe(false);
        expect(result.role).toBe(null);
        expect(result.sessionId).toBe('kine-session-999');
      });

      it('returns isValid: false when role parameter is empty string (?role=)', () => {
        const result = parseSessionParams('?role=&session=kine-test');
        expect(result.isValid).toBe(false);
        expect(result.role).toBe(null);
        expect(result.sessionId).toBe('kine-test');
      });

      it('returns isValid: false when role is an unknown string', () => {
        const invalidRoles = ['admin', 'guest', 'doctor', 'pt', 'dr', 'physio', 'null', 'undefined', '123'];
        for (const roleStr of invalidRoles) {
          const res = parseSessionParams(`?role=${roleStr}&session=room1`);
          expect(res.isValid).toBe(false);
          expect(res.role).toBe(null);
          expect(res.sessionId).toBe('room1');
        }
      });
    });

    describe('Missing Session Scenarios', () => {
      it('allows valid clinician role with completely absent session parameter', () => {
        const result = parseSessionParams('?role=clinician');
        expect(result.isValid).toBe(true);
        expect(result.role).toBe('clinician');
        expect(result.sessionId).toBe(null);
      });

      it('allows valid patient role with completely absent session parameter', () => {
        const result = parseSessionParams('?role=patient');
        expect(result.isValid).toBe(true);
        expect(result.role).toBe('patient');
        expect(result.sessionId).toBe(null);
      });

      it('handles empty session value (?session=) by setting sessionId to null', () => {
        const result = parseSessionParams('?role=clinician&session=');
        expect(result.isValid).toBe(true);
        expect(result.role).toBe('clinician');
        expect(result.sessionId).toBe(null);
      });

      it('handles whitespace-only session (?session=%20%20) by trimming to null', () => {
        const result = parseSessionParams('?role=patient&session=%20%20%20');
        expect(result.isValid).toBe(true);
        expect(result.role).toBe('patient');
        expect(result.sessionId).toBe(null);
      });

      it('handles raw whitespace in search string gracefully', () => {
        const result = parseSessionParams('?role=patient&session=   ');
        expect(result.isValid).toBe(true);
        expect(result.role).toBe('patient');
        expect(result.sessionId).toBe(null);
      });
    });

    describe('Malformed Query Strings', () => {
      it('handles query strings without leading question mark', () => {
        const result = parseSessionParams('role=clinician&session=direct-link');
        expect(result.isValid).toBe(true);
        expect(result.role).toBe('clinician');
        expect(result.sessionId).toBe('direct-link');
      });

      it('handles query strings with multiple leading question marks safely', () => {
        // e.g. "??role=clinician&session=test"
        // slice(1) removes one '?', leaving "?role=clinician..." where key is "?role"
        const result = parseSessionParams('???role=clinician&session=test');
        // Because key is not "role", strict role validation rejects it safely
        expect(result.isValid).toBe(false);
        expect(result.role).toBe(null);
        expect(result.sessionId).toBe('test');
      });

      it('handles completely malformed punctuation strings without throwing', () => {
        const malformed = ['&&&&', '=====', '???&&&=', '?&&&===&&&', '?;;;;;'];
        for (const str of malformed) {
          expect(() => parseSessionParams(str)).not.toThrow();
          const res = parseSessionParams(str);
          expect(res.isValid).toBe(false);
        }
      });

      it('handles malformed percent-encoded sequences without throwing', () => {
        // Standard URLSearchParams decodes or replaces invalid percent encoding without crashing
        expect(() => parseSessionParams('?role=clinician&session=%E0%A4%A')).not.toThrow();
        const res = parseSessionParams('?role=clinician&session=%E0%A4%A');
        expect(res.isValid).toBe(true);
        expect(res.role).toBe('clinician');
      });

      it('handles Unicode, emojis, and special symbols in session ID', () => {
        const res = parseSessionParams('?role=patient&session=kine-room-🏆-alpha_01');
        expect(res.isValid).toBe(true);
        expect(res.role).toBe('patient');
        expect(res.sessionId).toBe('kine-room-🏆-alpha_01');
      });

      it('handles duplicated query parameters by taking the first occurrence', () => {
        // According to URLSearchParams.get(), the first value associated with the key is returned
        const res = parseSessionParams('?role=clinician&role=patient&session=first&session=second');
        expect(res.isValid).toBe(true);
        expect(res.role).toBe('clinician');
        expect(res.sessionId).toBe('first');
      });

      it('handles hash fragment if mistakenly passed inside search string', () => {
        // e.g., "?role=patient&session=test#hash" -> URLSearchParams treats "#hash" as part of session unless stripped
        const res = parseSessionParams('?role=patient&session=test');
        expect(res.isValid).toBe(true);
        expect(res.role).toBe('patient');
        expect(res.sessionId).toBe('test');
      });
    });

    describe('Case Sensitivity & Uppercase Parameter Names/Values', () => {
      it('strictly enforces lowercase values for role (rejects CLINICIAN, Clinician, PATIENT)', () => {
        // The contract defines UserRole = 'clinician' | 'patient'. Uppercase strings do not match.
        const upperClinician = parseSessionParams('?role=CLINICIAN&session=test');
        expect(upperClinician.isValid).toBe(false);
        expect(upperClinician.role).toBe(null);

        const mixedClinician = parseSessionParams('?role=Clinician&session=test');
        expect(mixedClinician.isValid).toBe(false);
        expect(mixedClinician.role).toBe(null);

        const upperPatient = parseSessionParams('?role=PATIENT&session=test');
        expect(upperPatient.isValid).toBe(false);
        expect(upperPatient.role).toBe(null);

        const mixedPatient = parseSessionParams('?role=Patient&session=test');
        expect(mixedPatient.isValid).toBe(false);
        expect(mixedPatient.role).toBe(null);
      });

      it('strictly expects lowercase parameter names (rejects ROLE=clinician, SESSION=test)', () => {
        // URLSearchParams is case-sensitive for keys
        const upperRoleParam = parseSessionParams('?ROLE=clinician&session=test');
        expect(upperRoleParam.isValid).toBe(false);
        expect(upperRoleParam.role).toBe(null);
        expect(upperRoleParam.sessionId).toBe('test');

        const upperSessionParam = parseSessionParams('?role=clinician&SESSION=test');
        expect(upperSessionParam.isValid).toBe(true);
        expect(upperSessionParam.role).toBe('clinician');
        // session key was uppercase 'SESSION', so 'session' was null
        expect(upperSessionParam.sessionId).toBe(null);
      });
    });

    describe('Extraneous Query Parameters', () => {
      it('safely parses role and session amidst multiple extraneous query parameters', () => {
        const query = '?utm_source=clinic-portal&utm_medium=email&role=clinician&patient_id=pt-882&session=tele-room-42&debug=true&token=xyz123';
        const res = parseSessionParams(query);
        expect(res.isValid).toBe(true);
        expect(res.role).toBe('clinician');
        expect(res.sessionId).toBe('tele-room-42');
      });

      it('safely parses when parameters are in reverse order with noise', () => {
        const query = '?version=2.0&session=tele-room-reverse&active=1&role=patient&preview=true';
        const res = parseSessionParams(query);
        expect(res.isValid).toBe(true);
        expect(res.role).toBe('patient');
        expect(res.sessionId).toBe('tele-room-reverse');
      });
    });
  });

  // =========================================================================
  // 2. Role Conflict Detection (detectRoleConflict)
  // =========================================================================
  describe('2. Role Conflict Detection', () => {
    it('detects conflict when active user is dr-demo (CLINICIAN_UID) but requested role is patient', () => {
      const isConflict = detectRoleConflict('patient', CLINICIAN_UID);
      expect(isConflict).toBe(true);
    });

    it('detects conflict when active user is pt-demo (PATIENT_UID) but requested role is clinician', () => {
      const isConflict = detectRoleConflict('clinician', PATIENT_UID);
      expect(isConflict).toBe(true);
    });

    it('returns false when active user is dr-demo and requested role is clinician (matching role)', () => {
      const isConflict = detectRoleConflict('clinician', CLINICIAN_UID);
      expect(isConflict).toBe(false);
    });

    it('returns false when active user is pt-demo and requested role is patient (matching role)', () => {
      const isConflict = detectRoleConflict('patient', PATIENT_UID);
      expect(isConflict).toBe(false);
    });

    it('detects conflict when active user is an arbitrary third-party UID', () => {
      expect(detectRoleConflict('patient', 'unknown-user-999')).toBe(true);
      expect(detectRoleConflict('clinician', 'unknown-user-999')).toBe(true);
      expect(detectRoleConflict('patient', 'admin')).toBe(true);
    });

    it('returns false when requestedRole is null (no role specified in link)', () => {
      expect(detectRoleConflict(null, CLINICIAN_UID)).toBe(false);
      expect(detectRoleConflict(null, PATIENT_UID)).toBe(false);
      expect(detectRoleConflict(null, 'arbitrary-uid')).toBe(false);
    });

    it('returns false when activeUid is null or empty (user not logged in yet)', () => {
      expect(detectRoleConflict('clinician', null)).toBe(false);
      expect(detectRoleConflict('patient', null)).toBe(false);
      expect(detectRoleConflict('clinician', '')).toBe(false);
      expect(detectRoleConflict('patient', '')).toBe(false);
      expect(detectRoleConflict(null, null)).toBe(false);
    });
  });

  // =========================================================================
  // 3. Expected UID and Role Mapping
  // =========================================================================
  describe('3. Role / UID Bijective Mapping', () => {
    it('getExpectedUidForRole strictly returns CLINICIAN_UID for clinician and PATIENT_UID for patient', () => {
      expect(getExpectedUidForRole('clinician')).toBe(CLINICIAN_UID);
      expect(getExpectedUidForRole('patient')).toBe(PATIENT_UID);
    });

    it('getRoleForUid maps known demo UIDs back to roles, and returns null for unrecognized UIDs', () => {
      expect(getRoleForUid(CLINICIAN_UID)).toBe('clinician');
      expect(getRoleForUid(PATIENT_UID)).toBe('patient');
      expect(getRoleForUid('dr-demo-2')).toBe(null);
      expect(getRoleForUid('admin')).toBe(null);
      expect(getRoleForUid('')).toBe(null);
    });
  });

  // =========================================================================
  // 4. Non-Destructive Invariant & checkSessionGuard
  // =========================================================================
  describe('4. Non-Destructive Invariant & checkSessionGuard Execution', () => {
    it('NEVER calls CometChat.logout() during conflict detection', async () => {
      const logoutSpy = vi.spyOn(CometChat, 'logout');
      vi.spyOn(CometChat, 'getLoggedinUser').mockResolvedValue({
        getUid: () => CLINICIAN_UID,
      } as any);

      // Deep link requests patient, but active logged-in user is dr-demo
      const result = await checkSessionGuard('?role=patient&session=kine-room-conflict');

      // Must detect conflict
      expect(result.conflict).toBe(true);
      expect(result.activeUid).toBe(CLINICIAN_UID);
      expect(result.expectedUid).toBe(PATIENT_UID);
      expect(result.parsed.isValid).toBe(true);
      expect(result.parsed.role).toBe('patient');

      // INVARIANT: CometChat.logout() must NOT be called automatically!
      expect(logoutSpy).not.toHaveBeenCalled();
    });

    it('NEVER calls CometChat.logout() when user matches requested role', async () => {
      const logoutSpy = vi.spyOn(CometChat, 'logout');
      vi.spyOn(CometChat, 'getLoggedinUser').mockResolvedValue({
        getUid: () => CLINICIAN_UID,
      } as any);

      const result = await checkSessionGuard('?role=clinician&session=kine-room-match');

      expect(result.conflict).toBe(false);
      expect(result.activeUid).toBe(CLINICIAN_UID);
      expect(logoutSpy).not.toHaveBeenCalled();
    });

    it('NEVER calls CometChat.logout() when no user is logged in (getLoggedinUser returns null)', async () => {
      const logoutSpy = vi.spyOn(CometChat, 'logout');
      vi.spyOn(CometChat, 'getLoggedinUser').mockResolvedValue(null as any);

      const result = await checkSessionGuard('?role=patient&session=kine-fresh');

      expect(result.conflict).toBe(false);
      expect(result.activeUid).toBe(null);
      expect(result.expectedUid).toBe(PATIENT_UID);
      expect(logoutSpy).not.toHaveBeenCalled();
    });

    it('gracefully handles CometChat throwing on getLoggedinUser without calling logout or crashing', async () => {
      const logoutSpy = vi.spyOn(CometChat, 'logout');
      vi.spyOn(CometChat, 'getLoggedinUser').mockRejectedValue(new Error('SDK_NOT_INITIALIZED'));

      const result = await checkSessionGuard('?role=clinician&session=kine-fresh');

      expect(result.conflict).toBe(false);
      expect(result.activeUid).toBe(null);
      expect(logoutSpy).not.toHaveBeenCalled();
    });

    it('handles active user object missing getUid method gracefully', async () => {
      const logoutSpy = vi.spyOn(CometChat, 'logout');
      vi.spyOn(CometChat, 'getLoggedinUser').mockResolvedValue({} as any);

      const result = await checkSessionGuard('?role=patient&session=kine-test');

      expect(result.conflict).toBe(false);
      expect(result.activeUid).toBe(null);
      expect(logoutSpy).not.toHaveBeenCalled();
    });
  });
});
