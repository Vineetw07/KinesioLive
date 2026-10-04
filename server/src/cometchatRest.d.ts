/**
 * CometChat v3 REST Client and Diagnostic Service
 * Conforms to ORIGINAL_REQUEST.md § R2, PROJECT.md § Features 8-12, and docs/trd.md § Section 4
 *
 * OpenAPI Verified via CometChat MCP:
 * - POST /v3/users (upsert user)
 * - POST /v3/groups (upsert group with admin and participant members)
 * - POST /v3/groups/{guid}/members (add members to existing group)
 * - POST /v3/users/{uid}/auth_tokens (mint auth token)
 */
import { type SessionResponse, type UserRole } from '@kinesio/shared';
export interface CredentialDiagnosticResult {
    isValid: boolean;
    isTruncated: boolean;
    isMissing: boolean;
    appIdPresent: boolean;
    regionPresent: boolean;
    warningMessage: string | null;
}
/**
 * Inspects and validates CometChat environment variables.
 * Emits user-friendly diagnostic notices if keys are missing or truncated ('...').
 */
export declare function validateBootCredentials(env: Record<string, string | undefined>): CredentialDiagnosticResult;
/**
 * Runs diagnostics on boot and logs warnings without crashing the server.
 */
export declare function runBootDiagnostics(): CredentialDiagnosticResult;
/**
 * Idempotently upserts a user in CometChat.
 * POST /v3/users
 */
export declare function upsertUser(uid: string, name: string, role?: string): Promise<{
    success: boolean;
    error?: string;
}>;
/**
 * Idempotently upserts a session group in CometChat and ensures members are joined.
 * POST /v3/groups -> POST /v3/groups/{guid}/members
 */
export declare function upsertGroup(guid: string, adminUids: string[], participantUids: string[]): Promise<{
    success: boolean;
    error?: string;
}>;
/**
 * Mints an auth token for a user via CometChat REST API.
 * POST /v3/users/{uid}/auth_tokens
 * Falls back to offline/development token generation if the upstream API is unreachable or returns 401.
 */
export declare function mintAuthToken(uid: string, sessionId: string): Promise<string>;
/**
 * Coordinates session creation, user/group upsert, and token minting.
 * Returns a sanitized SessionResponse with zero secret leakage.
 */
export declare function createOrJoinSession(role: UserRole, inputSessionId?: string): Promise<SessionResponse>;
//# sourceMappingURL=cometchatRest.d.ts.map