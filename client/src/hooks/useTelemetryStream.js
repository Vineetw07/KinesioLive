/**
 * useTelemetryStream.ts (Milestone D4.4)
 * Decoupled React Hook consuming CometChat 10 Hz transient pose telemetry.
 * Conforms to docs/frontend_architecture_spec.md §6 and ORIGINAL_REQUEST.md §R3.
 */
import { useState, useEffect, useRef } from 'react';
import { CometChat } from '@cometchat/chat-sdk-javascript';
export function useTelemetryStream(sessionId) {
    const [currentPose, setCurrentPose] = useState(null);
    const [isConnected, setIsConnected] = useState(false);
    const [error, setError] = useState(null);
    const lastUpdateRef = useRef(0);
    useEffect(() => {
        if (!sessionId || !sessionId.trim()) {
            setIsConnected(false);
            return;
        }
        const sid = sessionId.trim();
        const listenerId = `kine-telemetry-${sid}`;
        lastUpdateRef.current = 0;
        try {
            CometChat.addMessageListener(listenerId, new CometChat.MessageListener({
                onTransientMessageReceived: (message) => {
                    const now = performance.now();
                    // 10 Hz rate limit (100ms throttle bucket)
                    if (now - lastUpdateRef.current < 90) {
                        return;
                    }
                    lastUpdateRef.current = now;
                    try {
                        const raw = message.getData ? message.getData() : message.data;
                        let payload = null;
                        if (typeof raw === 'string') {
                            payload = JSON.parse(raw);
                        }
                        else if (raw && typeof raw === 'object') {
                            if (typeof raw.data === 'string') {
                                try {
                                    payload = JSON.parse(raw.data);
                                }
                                catch {
                                    payload = raw;
                                }
                            }
                            else {
                                payload = (raw.data || raw);
                            }
                        }
                        if (payload && payload.type === 'kine.pose') {
                            setCurrentPose(payload);
                        }
                    }
                    catch {
                        // Ignore malformed packets to preserve render loop stability
                    }
                },
            }));
            setIsConnected(true);
            setError(null);
        }
        catch (err) {
            setError(err instanceof Error ? err : new Error('Failed to attach telemetry listener'));
            setIsConnected(false);
        }
        return () => {
            try {
                CometChat.removeMessageListener(listenerId);
            }
            catch {
                // Defensive cleanup
            }
            setIsConnected(false);
        };
    }, [sessionId]);
    return { currentPose, isConnected, error };
}
