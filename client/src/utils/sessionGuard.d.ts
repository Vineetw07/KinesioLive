/**
 * Session Guard & Deep-Link Parser (Milestone D4.5)
 * Non-destructive validation of URL deep-link parameters and CometChat user role conflict detection.
 * Conforms to docs/trd.md §Section-4, docs/audit.md, and ORIGINAL_REQUEST.md §R4.
 */
import { type UserRole } from '@kinesio/shared';
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
export declare function parseSessionParams(search?: string): ParsedSessionParams;
/**
 * Returns the deterministic demo UID expected for a given role.
 */
export declare function getExpectedUidForRole(role: UserRole): string;
/**
 * Returns the UserRole corresponding to a given demo UID, or null if unknown.
 */
export declare function getRoleForUid(uid: string): UserRole | null;
/**
 * Detects whether an active logged-in CometChat user UID conflicts with the requested role.
 * e.g., active user is 'dr-demo' but the URL demands 'patient' (expected 'pt-demo').
 */
export declare function detectRoleConflict(requestedRole: UserRole | null, activeUid: string | null): boolean;
/**
 * Non-destructive session guard check.
 * Strictly NEVER calls CometChat.logout() automatically to prevent terminating
 * active sessions in peer windows/tabs sharing the same browser storage.
 */
export declare function checkSessionGuard(search?: string): Promise<SessionGuardResult>;
//# sourceMappingURL=sessionGuard.d.ts.map