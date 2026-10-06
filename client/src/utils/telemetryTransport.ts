/**
 * telemetryTransport.ts
 * Dual-Transport Synchronization Layer for KinesioLive.
 *
 * Architecture:
 * 1. CometChat Chat SDK Group Provisioning: Ensures session groups exist and users are members.
 * 2. Real-Time Dual Transport: Emits over CometChat (Transient/Custom) and BroadcastChannel in parallel.
 * 3. Message Deduplication: Prevents double-counting of reps and redundant alerts across dual transports.
 */

import { CometChat } from '@cometchat/chat-sdk-javascript';
import type {
  KinePosePayload,
  KineRepPayload,
  KineAlertPayload,
  KineCuePayload,
  KineMessage,
} from '@kinesio/shared';

// LRU / Dedup Cache for message keys
const seenMessageKeys = new Set<string>();
const DEDUP_TTL_MS = 6000;

export function isDuplicateMessage(key: string): boolean {
  if (seenMessageKeys.has(key)) return true;
  seenMessageKeys.add(key);
  setTimeout(() => {
    seenMessageKeys.delete(key);
  }, DEDUP_TTL_MS);
  return false;
}

/**
 * Ensures the session group exists and the current user is joined in CometChat Chat SDK.
 * Idempotently joins public groups or creates them if missing.
 */
export async function ensureSessionGroup(sessionId: string): Promise<boolean> {
  if (!sessionId || !sessionId.trim()) return false;
  const guid = sessionId.trim();

  try {
    const publicGroupType = (CometChat.GROUP_TYPE?.PUBLIC || 'public') as unknown as CometChat.GroupType;

    // 1. Attempt to join the group
    try {
      if (typeof CometChat.joinGroup === 'function') {
        await CometChat.joinGroup(guid, publicGroupType);
        console.log(`[CometChat] Successfully joined session group: ${guid}`);
        return true;
      }
    } catch (joinErr: any) {
      const code = joinErr?.code || joinErr?.error?.code || '';
      const msg = (joinErr?.message || joinErr?.error?.message || '').toLowerCase();

      // Already joined is a success
      if (
        code === 'ERR_ALREADY_JOINED' ||
        msg.includes('already a member') ||
        msg.includes('already joined')
      ) {
        return true;
      }

      // Group not found -> Create it as a public group
      if (
        code === 'ERR_GUID_NOT_FOUND' ||
        msg.includes('does not exist') ||
        msg.includes('not found')
      ) {
        try {
          const GroupClass =
            (CometChat as any).Group ||
            class {
              guid: string;
              name: string;
              type: any;
              constructor(g: string, n: string, t: any) {
                this.guid = g;
                this.name = n;
                this.type = t;
              }
            };
          const group = new GroupClass(guid, `Session ${guid}`, publicGroupType);
          if (typeof CometChat.createGroup === 'function') {
            await CometChat.createGroup(group);
            console.log(`[CometChat] Successfully created session group: ${guid}`);
            return true;
          }
        } catch (createErr: any) {
          const createCode = createErr?.code || createErr?.error?.code || '';
          const createMsg = (createErr?.message || createErr?.error?.message || '').toLowerCase();
          if (
            createCode === 'ERR_GUID_ALREADY_EXISTS' ||
            createMsg.includes('already exists')
          ) {
            // Created concurrently by peer; retry join
            try {
              if (typeof CometChat.joinGroup === 'function') {
                await CometChat.joinGroup(guid, publicGroupType);
                return true;
              }
            } catch {
              return true;
            }
          }
          console.warn('[CometChat] createGroup notice:', createErr);
        }
      }
    }
  } catch (err) {
    console.warn('[CometChat] ensureSessionGroup notice:', err);
  }
  return false;
}

/**
 * Broadcasts a telemetry event or custom message to local browser tabs via BroadcastChannel.
 */
export function broadcastTelemetryEvent(sessionId: string, payload: KineMessage): void {
  if (!sessionId || typeof BroadcastChannel === 'undefined') return;
  try {
    const channelName =
      payload.type === 'kine.pose'
        ? `kine-telemetry-${sessionId.trim()}`
        : `kine-events-${sessionId.trim()}`;
    const bc = new BroadcastChannel(channelName);
    bc.postMessage(payload);
    bc.close();
  } catch {
    // Defensive failure suppression
  }
}

/**
 * Listens to BroadcastChannel events for a session, filtering duplicates.
 */
export function subscribeToBroadcastEvents(
  sessionId: string,
  callbacks: {
    onPose?: (pose: KinePosePayload) => void;
    onRep?: (rep: KineRepPayload) => void;
    onAlert?: (alert: KineAlertPayload) => void;
    onCue?: (cue: KineCuePayload) => void;
  }
): () => void {
  if (!sessionId || typeof BroadcastChannel === 'undefined') {
    return () => {};
  }

  const sid = sessionId.trim();
  let telemetryBc: BroadcastChannel | null = null;
  let eventsBc: BroadcastChannel | null = null;

  try {
    if (callbacks.onPose) {
      telemetryBc = new BroadcastChannel(`kine-telemetry-${sid}`);
      telemetryBc.onmessage = (evt: MessageEvent) => {
        const data = evt.data;
        if (data && data.type === 'kine.pose') {
          callbacks.onPose!(data as KinePosePayload);
        }
      };
    }

    if (callbacks.onRep || callbacks.onAlert || callbacks.onCue) {
      eventsBc = new BroadcastChannel(`kine-events-${sid}`);
      eventsBc.onmessage = (evt: MessageEvent) => {
        const data = evt.data;
        if (!data || typeof data !== 'object') return;

        if (data.type === 'kine.rep' && callbacks.onRep) {
          const key = `rep_${data.t}_${data.n}`;
          if (!isDuplicateMessage(key)) {
            callbacks.onRep(data as KineRepPayload);
          }
        } else if (data.type === 'kine.alert' && callbacks.onAlert) {
          const key = `alert_${data.t}_${data.side}_${data.repN}`;
          if (!isDuplicateMessage(key)) {
            callbacks.onAlert(data as KineAlertPayload);
          }
        } else if (data.type === 'kine.cue' && callbacks.onCue) {
          const key = `cue_${data.t}_${data.cue}`;
          if (!isDuplicateMessage(key)) {
            callbacks.onCue(data as KineCuePayload);
          }
        }
      };
    }
  } catch {
    // BroadcastChannel error suppression
  }

  return () => {
    try {
      if (telemetryBc) telemetryBc.close();
      if (eventsBc) eventsBc.close();
    } catch {}
  };
}

/**
 * Extracts and parses custom data from a CometChat CustomMessage safely.
 */
export function extractCustomMessageData<T = any>(customMessage: CometChat.CustomMessage): T | null {
  try {
    let customData =
      customMessage.getCustomData?.() ??
      (customMessage as any).customData ??
      (customMessage as any).data;

    if (typeof customData === 'string') {
      try {
        customData = JSON.parse(customData);
      } catch {
        // Keep as is
      }
    }

    return (customData as T) || null;
  } catch {
    return null;
  }
}
