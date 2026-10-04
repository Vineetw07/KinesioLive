/**
 * Client Token Service Wrapper for POST /api/session
 * Strict Boundary: Zero client Auth Keys or REST Keys
 */
export async function requestSession(role, sessionId) {
    const payload = {
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
        throw new Error(errorBody.error || `Session minting failed with HTTP status ${res.status}`);
    }
    const data = await res.json();
    return data;
}
export async function checkBackendHealth() {
    try {
        const res = await fetch('/api/health');
        return res.ok;
    }
    catch {
        return false;
    }
}
