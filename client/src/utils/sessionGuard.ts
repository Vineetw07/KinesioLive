/**
 * Session Guard & Deep-Link Parser (Milestone D4.5)
 * Non-destructive validation of URL deep-link parameters and CometChat user role conflict detection.
 * Conforms to docs/trd.md §Section-4, docs/audit.md, and ORIGINAL_REQUEST.md §R4.
 */

import { CometChat } from '@cometchat/chat-sdk-javascript';
import {
  type UserRole,
  CLINICIAN_UID,
  PATIENT_UID,
} from '@kinesio/shared';

export interface ParsedSessionParams {
  role: UserRole | null;
  sessionId: string | null;
  isValid: boolean;
}

export interface SessionGuardResult {
  parsed: ParsedSessionParams;
  conflict: boolean;
  activeUid: string | null;
  expectedUid: string | null;
}

/**
 * Parses query parameters from window.location.search or an arbitrary query string.
 * Supports: ?role=clinician|patient&session=<sessionId>
 */
export function parseSessionParams(
  search: string = typeof window !== 'undefined' ? window.location.search : ''
): ParsedSessionParams {
  const query = search.startsWith('?') ? search.slice(1) : search;
  const params = new URLSearchParams(query);
  const rawRole = params.get('role');
  const rawSession = params.get('session');

  let role: UserRole | null = null;
  if (rawRole === 'clinician' || rawRole === 'patient') {
    role = rawRole;
  }

  let sessionId: string | null = null;
  if (rawSession && rawSession.trim().length > 0) {
    sessionId = rawSession.trim();
  }

  return {
    role,
    sessionId,
    isValid: role !== null,
  };
}

/**
 * Returns the deterministic demo UID expected for a given role.
 */
export function getExpectedUidForRole(role: UserRole): string {
  return role === 'clinician' ? CLINICIAN_UID : PATIENT_UID;
}

/**
 * Returns the UserRole corresponding to a given demo UID, or null if unknown.
 */
export function getRoleForUid(uid: string): UserRole | null {
  if (uid === CLINICIAN_UID) return 'clinician';
  if (uid === PATIENT_UID) return 'patient';
  return null;
}

/**
 * Detects whether an active logged-in CometChat user UID conflicts with the requested role.
 * e.g., active user is 'dr-demo' but the URL demands 'patient' (expected 'pt-demo').
 */
export function detectRoleConflict(
  requestedRole: UserRole | null,
  activeUid: string | null
): boolean {
  if (!requestedRole || !activeUid) {
    return false;
  }
  const expectedUid = getExpectedUidForRole(requestedRole);
  return activeUid !== expectedUid;
}

/**
 * Non-destructive session guard check.
 * Strictly NEVER calls CometChat.logout() automatically to prevent terminating
 * active sessions in peer windows/tabs sharing the same browser storage.
 */
export async function checkSessionGuard(
  search: string = typeof window !== 'undefined' ? window.location.search : ''
): Promise<SessionGuardResult> {
  const parsed = parseSessionParams(search);
  let activeUid: string | null = null;

  try {
    const activeUser = await CometChat.getLoggedinUser();
    if (activeUser && typeof activeUser.getUid === 'function') {
      activeUid = activeUser.getUid();
    }
  } catch {
    // If CometChat is uninitialized or unauthenticated, no conflict exists yet
    activeUid = null;
  }

  const expectedUid = parsed.role ? getExpectedUidForRole(parsed.role) : null;
  const conflict = detectRoleConflict(parsed.role, activeUid);

  return {
    parsed,
    conflict,
    activeUid,
    expectedUid,
  };
}
