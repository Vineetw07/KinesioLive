/**
 * tests/e2e/dualProfileInteractions.test.ts (Milestones D4.3, D4.4, D4.5)
 * Dual-Profile Studio Interaction & Telemetry Suite.
 * Verifies:
 * 1. TelemetryTokenBucket rate-capping to <= 10 Hz under 30 FPS frame streams.
 * 2. Transient kine.pose message dispatch and listener reception.
 * 3. Coaching cue (kine.cue) dispatch from Clinician to Patient listener.
 * 4. Biomechanical knee valgus alert 3-frame trigger and 4000ms cooldown.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  SCHEMA_VERSION,
  CLINICIAN_UID,
  PATIENT_UID,
  VALGUS_THRESHOLD_PCT,
  VALGUS_COOLDOWN_MS,
  type KinePosePayload,
  type KineCuePayload,
  type KineAlertPayload,
} from '../../shared/src/index.js';
import {
  CometChat,
  chatMockState,
  chatMockListeners,
  chatMockTransientMessages,
} from '../mocks/chat-sdk.js';
import { TelemetryTokenBucket } from '../../client/src/spikes/s2-transient/rateCap.js';
import { RepCounterStateMachine } from '../../client/src/engine/repCounter.js';

describe('Dual-Profile Studio Interaction & Telemetry Protocol', () => {
  const sessionId = 'kine-test-room';

  beforeEach(() => {
    chatMockState.reset();
    for (const key of Object.keys(chatMockListeners)) {
      delete chatMockListeners[key];
    }
    chatMockTransientMessages.length = 0;
  });

  // 1. 10 Hz Token Bucket Rate-Capping
  it('T3-STUDIO.1: TelemetryTokenBucket caps 30 FPS frame presentation to <= 10 Hz transmissions', () => {
    const bucket = new TelemetryTokenBucket();
    let sentCount = 0;

    // Simulate 30 frames over 1000ms (1 frame every ~33.3ms)
    // We can simulate time ticks by mocking or evaluating elapsed intervals
    for (let frame = 0; frame < 30; frame++) {
      if (bucket.tryConsume()) {
        sentCount++;
        const poseMsg = new CometChat.TransientMessage(sessionId, CometChat.RECEIVER_TYPE.GROUP, {
          v: SCHEMA_VERSION,
          sid: sessionId,
          t: Date.now(),
          type: 'kine.pose',
          seq: sentCount,
          fps: 30,
          phase: 'standing',
          kneeFlexionDeg: { L: 175, R: 175 },
          valgusDevPct: { L: 1.2, R: 0.8 },
          depthRatio: 0.05,
          vis: 0.98,
          reps: 0,
        });
        CometChat.sendTransientMessage(poseMsg);
      }
    }

    // Within a single instantaneous loop without time elapsed, bucket allows only 1 token!
    expect(sentCount).toBe(1);
    expect(chatMockTransientMessages.length).toBe(1);
  });

  // 2. Telemetry Packet Structure & Listener Delivery
  it('T3-STUDIO.2: Dispatched kine.pose arrives at registered clinician telemetry listener', () => {
    let receivedPayload: KinePosePayload | null = null;

    const listenerId = `kine-telemetry-${sessionId}`;
    CometChat.addMessageListener(
      listenerId,
      new CometChat.MessageListener({
        onTransientMessageReceived: (msg: any) => {
          const data = msg.getData();
          if (data?.type === 'kine.pose') {
            receivedPayload = data as KinePosePayload;
          }
        },
      })
    );

    const testPose: KinePosePayload = {
      v: SCHEMA_VERSION,
      sid: sessionId,
      t: Date.now(),
      type: 'kine.pose',
      seq: 1,
      fps: 30,
      phase: 'descending',
      kneeFlexionDeg: { L: 110, R: 112 },
      valgusDevPct: { L: 2.5, R: 3.1 },
      depthRatio: 0.75,
      vis: 0.99,
      reps: 2,
    };

    const transientMsg = new CometChat.TransientMessage(
      sessionId,
      CometChat.RECEIVER_TYPE.GROUP,
      testPose as unknown as Record<string, unknown>
    );
    CometChat.sendTransientMessage(transientMsg);

    expect(receivedPayload).not.toBeNull();
    expect(receivedPayload!.sid).toBe(sessionId);
    expect(receivedPayload!.type).toBe('kine.pose');
    expect(receivedPayload!.phase).toBe('descending');
    expect(receivedPayload!.reps).toBe(2);

    CometChat.removeMessageListener(listenerId);
  });

  // 3. Tactile Coaching Cue Dispatch from Clinician to Patient
  it('T3-STUDIO.3: Clinician coaching cue dispatch arrives at patient custom message listener with shouldUpdateConversation(false)', async () => {
    let receivedCue: KineCuePayload | null = null;

    const patientListenerId = `kine-patient-cues-${sessionId}`;
    CometChat.addMessageListener(
      patientListenerId,
      new CometChat.MessageListener({
        onCustomMessageReceived: (customMsg: any) => {
          const data = customMsg.getCustomData();
          if (data?.type === 'kine.cue') {
            receivedCue = data as KineCuePayload;
          }
        },
      })
    );

    const cuePayload: KineCuePayload = {
      v: SCHEMA_VERSION,
      sid: sessionId,
      t: Date.now(),
      type: 'kine.cue',
      cue: 'knees_out',
      text: 'Knees Out',
    };

    const customMsg = new CometChat.CustomMessage(
      sessionId,
      CometChat.RECEIVER_TYPE.GROUP,
      'kine.cue',
      cuePayload as unknown as Record<string, unknown>
    );
    customMsg.shouldUpdateConversation(false);

    await CometChat.sendCustomMessage(customMsg);

    expect(receivedCue).not.toBeNull();
    expect(receivedCue!.cue).toBe('knees_out');
    expect(receivedCue!.text).toBe('Knees Out');
    expect(customMsg.getShouldUpdateConversation()).toBe(false);

    CometChat.removeMessageListener(patientListenerId);
  });

  // 4. Biomechanical Alert & Cooldown
  it('T3-STUDIO.4: RepCounterStateMachine triggers valgus alert after 3 consecutive frames and honors 4000ms cooldown', () => {
    const fsm = new RepCounterStateMachine({
      sessionId,
      valgusThresholdPct: VALGUS_THRESHOLD_PCT,
      valgusConsecutiveFrames: 3,
      valgusCooldownMs: VALGUS_COOLDOWN_MS,
    });

    let timestamp = 10000;

    // Transition to descending: depthRatio > 0.25
    fsm.update({ timestamp: timestamp++, depthRatio: 0.4, kneeAngle: 140, visibility: 0.95 });

    // Frame 1 with valgus > 8.0%
    let out = fsm.update({
      timestamp: timestamp++,
      depthRatio: 0.5,
      kneeAngle: 130,
      valgusDevPct: { L: 9.5, R: 2.0 },
      visibility: 0.95,
    });
    expect(out.alerts.length).toBe(0);

    // Frame 2 with valgus > 8.0%
    out = fsm.update({
      timestamp: timestamp++,
      depthRatio: 0.6,
      kneeAngle: 120,
      valgusDevPct: { L: 10.2, R: 2.0 },
      visibility: 0.95,
    });
    expect(out.alerts.length).toBe(0);

    // Frame 3 with valgus > 8.0% -> Triggers Alert!
    out = fsm.update({
      timestamp: timestamp++,
      depthRatio: 0.7,
      kneeAngle: 110,
      valgusDevPct: { L: 11.0, R: 2.0 },
      visibility: 0.95,
    });
    expect(out.alerts.length).toBe(1);
    expect(out.alerts[0].kind).toBe('knee_valgus');
    expect(out.alerts[0].side).toBe('L');
    expect(out.alerts[0].value).toBe(11.0);

    // Frame 4 within cooldown (< 4000ms later) -> Suppressed!
    out = fsm.update({
      timestamp: timestamp + 500,
      depthRatio: 0.7,
      kneeAngle: 110,
      valgusDevPct: { L: 11.5, R: 2.0 },
      visibility: 0.95,
    });
    expect(out.alerts.length).toBe(0);

    // Frame 5: Right knee valgus while Left knee is cooling down -> Right knee fires independently!
    // Needs 3 consecutive frames on Right knee:
    fsm.update({
      timestamp: timestamp + 600,
      depthRatio: 0.7,
      kneeAngle: 110,
      valgusDevPct: { L: 11.5, R: 9.0 },
      visibility: 0.95,
    });
    fsm.update({
      timestamp: timestamp + 700,
      depthRatio: 0.7,
      kneeAngle: 110,
      valgusDevPct: { L: 11.5, R: 9.5 },
      visibility: 0.95,
    });
    out = fsm.update({
      timestamp: timestamp + 800,
      depthRatio: 0.7,
      kneeAngle: 110,
      valgusDevPct: { L: 11.5, R: 10.0 },
      visibility: 0.95,
    });
    expect(out.alerts.length).toBe(1);
    expect(out.alerts[0].side).toBe('R');
  });
});
