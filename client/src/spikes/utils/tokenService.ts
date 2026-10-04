/**
 * Client Token Service Wrapper for POST /api/session
 * Strict Boundary: Zero client Auth Keys or REST Keys
 */

import type { SessionRequest, SessionResponse, UserRole } from '@kinesio/shared';

export async function requestSession(role: UserRole, sessionId?: string): Promise<SessionResponse> {
  const payload: SessionRequest = {
    role,
    sessionId: sessionId?.trim() ? sessionId.trim() : undefined,
  };

  const res = await fetch('/api/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(
      errorBody.error || `Session minting failed with HTTP status ${res.status}`
    );
  }

  const data: SessionResponse = await res.json();
  return data;
}

export async function checkBackendHealth(): Promise<boolean> {
  try {
    const res = await fetch('/api/health');
    return res.ok;
  } catch {
    return false;
  }
}
