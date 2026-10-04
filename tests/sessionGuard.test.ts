/**
 * tests/sessionGuard.test.ts (Milestone D4.5)
 * Unit tests for Session Guard and Deep-Link Parser.
 * Validates parameter parsing, conflict detection, and non-destructive behavior.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  parseSessionParams,
  detectRoleConflict,
  getExpectedUidForRole,
  getRoleForUid,
  checkSessionGuard,
} from '../client/src/utils/sessionGuard.js';
import { CLINICIAN_UID, PATIENT_UID } from '../shared/src/index.js';

describe('Session Guard & Deep-Link Router (D4.5)', () => {
  describe('parseSessionParams', () => {
    it('correctly parses clinician role and sessionId from query string', () => {
      const result = parseSessionParams('?role=clinician&session=kine-room-42');
      expect(result.isValid).toBe(true);
      expect(result.role).toBe('clinician');
      expect(result.sessionId).toBe('kine-room-42');
    });

    it('correctly parses patient role and sessionId from query string', () => {
      const result = parseSessionParams('?role=patient&session=kine-pt-alpha');
      expect(result.isValid).toBe(true);
      expect(result.role).toBe('patient');
      expect(result.sessionId).toBe('kine-pt-alpha');
    });

    it('handles query strings without leading question mark', () => {
      const result = parseSessionParams('role=patient&session=kine-direct');
      expect(result.isValid).toBe(true);
      expect(result.role).toBe('patient');
      expect(result.sessionId).toBe('kine-direct');
    });

    it('flags invalid roles as invalid', () => {
      const result = parseSessionParams('?role=admin&session=kine-room-1');
      expect(result.isValid).toBe(false);
      expect(result.role).toBe(null);
      expect(result.sessionId).toBe('kine-room-1');
    });

    it('handles missing role gracefully', () => {
      const result = parseSessionParams('?session=kine-room-only');
      expect(result.isValid).toBe(false);
      expect(result.role).toBe(null);
      expect(result.sessionId).toBe('kine-room-only');
    });

    it('handles empty query string', () => {
      const result = parseSessionParams('');
      expect(result.isValid).toBe(false);
      expect(result.role).toBe(null);
      expect(result.sessionId).toBe(null);
    });

    it('trims whitespace and ignores empty session ids', () => {
      const result = parseSessionParams('?role=clinician&session=%20%20');
      expect(result.isValid).toBe(true);
      expect(result.role).toBe('clinician');
      expect(result.sessionId).toBe(null);
    });
  });

  describe('detectRoleConflict', () => {
    it('detects collision when active user is dr-demo but requested role is patient', () => {
      const conflict = detectRoleConflict('patient', CLINICIAN_UID);
      expect(conflict).toBe(true);
    });

    it('detects collision when active user is pt-demo but requested role is clinician', () => {
      const conflict = detectRoleConflict('clinician', PATIENT_UID);
      expect(conflict).toBe(true);
    });

    it('detects no collision when active user is dr-demo and requested role is clinician', () => {
      const conflict = detectRoleConflict('clinician', CLINICIAN_UID);
      expect(conflict).toBe(false);
    });

    it('detects no collision when active user is pt-demo and requested role is patient', () => {
      const conflict = detectRoleConflict('patient', PATIENT_UID);
      expect(conflict).toBe(false);
    });

    it('returns false when requestedRole is null or activeUid is null', () => {
      expect(detectRoleConflict(null, CLINICIAN_UID)).toBe(false);
      expect(detectRoleConflict('clinician', null)).toBe(false);
      expect(detectRoleConflict(null, null)).toBe(false);
    });
  });

  describe('Role and UID Mapping Helpers', () => {
    it('maps clinician to CLINICIAN_UID and patient to PATIENT_UID', () => {
      expect(getExpectedUidForRole('clinician')).toBe(CLINICIAN_UID);
      expect(getExpectedUidForRole('patient')).toBe(PATIENT_UID);
    });

    it('maps UIDs back to roles', () => {
      expect(getRoleForUid(CLINICIAN_UID)).toBe('clinician');
      expect(getRoleForUid(PATIENT_UID)).toBe('patient');
      expect(getRoleForUid('some-other-user')).toBe(null);
    });
  });

  describe('checkSessionGuard non-destructive behavior', () => {
    it('executes checkSessionGuard without invoking CometChat.logout()', async () => {
      const result = await checkSessionGuard('?role=patient&session=kine-test');
      expect(result.parsed.isValid).toBe(true);
      expect(result.parsed.role).toBe('patient');
      expect(result.parsed.sessionId).toBe('kine-test');
      expect(result.expectedUid).toBe(PATIENT_UID);
    });
  });
});
