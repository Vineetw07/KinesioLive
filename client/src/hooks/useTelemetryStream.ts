/**
 * useTelemetryStream.ts (Milestone D4.4)
 * Decoupled React Hook consuming CometChat 10 Hz transient pose telemetry.
 * Conforms to docs/frontend_architecture_spec.md §6 and ORIGINAL_REQUEST.md §R3.
 */

import { useState, useEffect, useRef } from 'react';
import { CometChat } from '@cometchat/chat-sdk-javascript';
import type { KinePosePayload } from '@kinesio/shared';

export interface UseTelemetryStreamResult {
  currentPose: KinePosePayload | null;
  isConnected: boolean;
  error: Error | null;
}

export function useTelemetryStream(sessionId: string | null | undefined): UseTelemetryStreamResult {
  const [currentPose, setCurrentPose] = useState<KinePosePayload | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  const lastUpdateRef = useRef<number>(0);

  useEffect(() => {
    if (!sessionId || !sessionId.trim()) {
      setIsConnected(false);
      return;
    }

    const sid = sessionId.trim();
    const listenerId = `kine-telemetry-${sid}`;
    lastUpdateRef.current = 0;

    const handleIncomingPose = (payload: KinePosePayload) => {
      const now = performance.now();
      // 10 Hz rate limit (100ms throttle bucket)
      if (now - lastUpdateRef.current < 90) {
        return;
      }
      lastUpdateRef.current = now;
      setCurrentPose(payload);
    };

    try {
      CometChat.addMessageListener(
        listenerId,
        new CometChat.MessageListener({
          onTransientMessageReceived: (message: CometChat.TransientMessage) => {
            try {
              const raw = message.getData ? message.getData() : (message as any).data;
              let payload: KinePosePayload | null = null;

              if (typeof raw === 'string') {
                try {
                  payload = JSON.parse(raw) as KinePosePayload;
                } catch {
                  // Ignore malformed JSON string
                }
              } else if (raw && typeof raw === 'object') {
                if (raw.type === 'kine.pose') {
                  payload = raw as KinePosePayload;
                } else if (raw.data && typeof raw.data === 'object' && raw.data.type === 'kine.pose') {
                  payload = raw.data as KinePosePayload;
                } else if (typeof raw.data === 'string') {
                  try {
                    const parsed = JSON.parse(raw.data);
                    if (parsed?.type === 'kine.pose') payload = parsed;
                  } catch {
                    payload = raw as unknown as KinePosePayload;
                  }
                } else {
                  payload = (raw.data || raw) as KinePosePayload;
                }
              }

              if (payload && payload.type === 'kine.pose') {
                handleIncomingPose(payload);
              }
            } catch {
              // Ignore malformed packets to preserve render loop stability
            }
          },
        })
      );
      setIsConnected(true);
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err : new Error('Failed to attach telemetry listener'));
      setIsConnected(false);
    }

    // Mirroring local BroadcastChannel transport for zero-latency cross-tab communication
    let bc: BroadcastChannel | null = null;
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        bc = new BroadcastChannel(`kine-telemetry-${sid}`);
        bc.onmessage = (event: MessageEvent) => {
          const raw = event.data;
          if (raw && typeof raw === 'object' && raw.type === 'kine.pose') {
            handleIncomingPose(raw as KinePosePayload);
          }
        };
      } catch {
        // Defensive BroadcastChannel catch
      }
    }

    return () => {
      try {
        CometChat.removeMessageListener(listenerId);
      } catch {
        // Defensive cleanup
      }
      if (bc) {
        try {
          bc.close();
        } catch {
          // Defensive cleanup
        }
      }
      setIsConnected(false);
    };
  }, [sessionId]);

  return { currentPose, isConnected, error };
}
