/**
 * Client Token Service Wrapper for POST /api/session
 * Strict Boundary: Zero client Auth Keys or REST Keys
 */
import type { SessionResponse, UserRole } from '@kinesio/shared';
export declare function requestSession(role: UserRole, sessionId?: string): Promise<SessionResponse>;
export declare function checkBackendHealth(): Promise<boolean>;
//# sourceMappingURL=tokenService.d.ts.map