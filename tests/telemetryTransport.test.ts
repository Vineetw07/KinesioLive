/**
 * telemetryTransport.test.ts
 * Rigorous test suite for Dual-Transport Telemetry and CometChat Group Provisioning.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  isDuplicateMessage,
  ensureSessionGroup,
  extractCustomMessageData,
  broadcastTelemetryEvent,
  subscribeToBroadcastEvents,
} from '../client/src/utils/telemetryTransport';
import { CometChat } from '@cometchat/chat-sdk-javascript';
import type { KinePosePayload, KineRepPayload, KineAlertPayload, KineCuePayload } from '@kinesio/shared';

describe('Dual-Transport & Telemetry Sync Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Deduplication Engine', () => {
    it('allows unique message keys and filters duplicate keys', () => {
      const key = `test_key_${Date.now()}_1`;
      expect(isDuplicateMessage(key)).toBe(false);
      // Immediate repeat with exact same key must return true (duplicate)
      expect(isDuplicateMessage(key)).toBe(true);
      expect(isDuplicateMessage(key)).toBe(true);

      const anotherKey = `test_key_${Date.now()}_2`;
      expect(isDuplicateMessage(anotherKey)).toBe(false);
    });
  });

  describe('extractCustomMessageData Parser', () => {
    it('extracts object data from getCustomData()', () => {
      const mockMsg = {
        getCustomData: () => ({ type: 'kine.cue', cue: 'knees_out', text: 'Knees Out' }),
      } as unknown as CometChat.CustomMessage;

      const extracted = extractCustomMessageData<KineCuePayload>(mockMsg);
      expect(extracted).not.toBeNull();
      expect(extracted?.type).toBe('kine.cue');
      expect(extracted?.cue).toBe('knees_out');
    });

    it('parses JSON stringified custom data safely', () => {
      const mockMsg = {
        getCustomData: () => JSON.stringify({ type: 'kine.rep', n: 3, durMs: 2100 }),
      } as unknown as CometChat.CustomMessage;

      const extracted = extractCustomMessageData<KineRepPayload>(mockMsg);
      expect(extracted).not.toBeNull();
      expect(extracted?.type).toBe('kine.rep');
      expect(extracted?.n).toBe(3);
    });

    it('falls back to customData property if getCustomData is missing', () => {
      const mockMsg = {
        customData: { type: 'kine.alert', kind: 'knee_valgus', value: 9.5 },
      } as unknown as CometChat.CustomMessage;

      const extracted = extractCustomMessageData<KineAlertPayload>(mockMsg);
      expect(extracted).not.toBeNull();
      expect(extracted?.type).toBe('kine.alert');
      expect(extracted?.value).toBe(9.5);
    });

    it('returns null on corrupted message', () => {
      const mockMsg = null as unknown as CometChat.CustomMessage;
      expect(extractCustomMessageData(mockMsg)).toBeNull();
    });
  });

  describe('ensureSessionGroup Provisions', () => {
    it('returns true when group join succeeds', async () => {
      (CometChat as any).joinGroup = vi.fn().mockResolvedValueOnce({} as any);
      const res = await ensureSessionGroup('test-session-guid');
      expect(res).toBe(true);
      expect((CometChat as any).joinGroup).toHaveBeenCalledWith('test-session-guid', 'public');
    });

    it('returns true idempotently when user is already a member', async () => {
      (CometChat as any).joinGroup = vi.fn().mockRejectedValueOnce({
        code: 'ERR_ALREADY_JOINED',
        message: 'User already a member of the group',
      });

      const res = await ensureSessionGroup('test-session-guid');
      expect(res).toBe(true);
    });

    it('creates group and returns true when group is missing (ERR_GUID_NOT_FOUND)', async () => {
      (CometChat as any).joinGroup = vi.fn().mockRejectedValueOnce({
        code: 'ERR_GUID_NOT_FOUND',
        message: 'Group does not exist',
      });
      (CometChat as any).createGroup = vi.fn().mockResolvedValueOnce({} as any);

      const res = await ensureSessionGroup('test-session-guid');
      expect(res).toBe(true);
      expect((CometChat as any).createGroup).toHaveBeenCalled();
    });

    it('returns false gracefully when session ID is empty or invalid', async () => {
      const res = await ensureSessionGroup('  ');
      expect(res).toBe(false);
    });
  });

  describe('BroadcastChannel Synchronization Layer', () => {
    it('handles environments where BroadcastChannel is present', () => {
      class MockBroadcastChannel {
        name: string;
        onmessage: ((ev: any) => void) | null = null;
        static instances: MockBroadcastChannel[] = [];
        constructor(name: string) {
          this.name = name;
          MockBroadcastChannel.instances.push(this);
        }
        postMessage(data: any) {
          MockBroadcastChannel.instances
            .filter((ch) => ch.name === this.name && ch !== this)
            .forEach((ch) => ch.onmessage?.({ data }));
        }
        close() {
          const idx = MockBroadcastChannel.instances.indexOf(this);
          if (idx !== -1) MockBroadcastChannel.instances.splice(idx, 1);
        }
      }

      const originalBC = globalThis.BroadcastChannel;
      (globalThis as any).BroadcastChannel = MockBroadcastChannel;

      try {
        let receivedPose: KinePosePayload | null = null;
        let receivedCue: KineCuePayload | null = null;

        const unsubscribe = subscribeToBroadcastEvents('sync-sess-99', {
          onPose: (p) => {
            receivedPose = p;
          },
          onCue: (c) => {
            receivedCue = c;
          },
        });

        // 1. Dispatch Pose
        const testPose: KinePosePayload = {
          v: 1,
          sid: 'sync-sess-99',
          t: Date.now(),
          type: 'kine.pose',
          seq: 1,
          fps: 30,
          phase: 'bottom',
          kneeFlexionDeg: { L: 90, R: 90 },
          valgusDevPct: { L: 3.2, R: 3.5 },
          depthRatio: 0.9,
          vis: 0.99,
          reps: 2,
        };
        broadcastTelemetryEvent('sync-sess-99', testPose);
        expect(receivedPose).toEqual(testPose);

        // 2. Dispatch Cue
        const testCue: KineCuePayload = {
          v: 1,
          sid: 'sync-sess-99',
          t: Date.now(),
          type: 'kine.cue',
          cue: 'knees_out',
          text: 'Knees Out',
        };
        broadcastTelemetryEvent('sync-sess-99', testCue);
        expect(receivedCue).toEqual(testCue);

        unsubscribe();
      } finally {
        (globalThis as any).BroadcastChannel = originalBC;
      }
    });
  });
});
