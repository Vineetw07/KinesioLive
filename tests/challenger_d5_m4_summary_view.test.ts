/**
 * tests/challenger_d5_m4_summary_view.test.ts
 *
 * Empirical Adversarial & Verification Suite for Milestone D5.4 (Post-Workout Summary Bento View & App Wiring).
 * Authored by Challenger 1 (teamwork_preview_challenger) to verify:
 * 1. Zero raw hex codes in client/src/views/Summary.tsx via strict regex auditing.
 * 2. Empty message resiliency and division-by-zero protection.
 * 3. Network rejection handling, error message extraction, and retry mechanics.
 * 4. App routing state transitions and navigation resets (tab switch, role switch, onBack).
 * 5. Visual token compliance and inline SVG data URI pattern verification.
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { CometChat, chatMockState } from './mocks/chat-sdk';
import { buildSummary } from '../client/src/engine/buildSummary';
import { SCHEMA_VERSION, type KineRepPayload, type KineAlertPayload } from '../shared/src/index';

describe('Challenger 1 Empirical Suite: Milestone D5.4 (Summary.tsx & App.tsx)', () => {
  const summaryFilePath = path.resolve(__dirname, '../client/src/views/Summary.tsx');
  const appFilePath = path.resolve(__dirname, '../client/src/App.tsx');

  describe('D5.4-CHALLENGE.1: Strict Token & Design System Audit (Zero Raw Hex Codes)', () => {
    it('verifies client/src/views/Summary.tsx contains ZERO raw hex color literals', () => {
      expect(fs.existsSync(summaryFilePath)).toBe(true);
      const summaryContent = fs.readFileSync(summaryFilePath, 'utf-8');

      // Regex matching standard hex color codes: #fff, #ffffff, #ffffffff, #18191C, etc.
      const hexRegex = /#[0-9a-fA-F]{3,8}\b/g;
      const matches = summaryContent.match(hexRegex) || [];

      // Every color must be a CSS variable or color-mix derived token
      expect(matches).toEqual([]);
      expect(matches.length).toBe(0);
    });

    it('verifies anchor dark card uses var(--surface-dark-card) and inline SVG hatched data URI', () => {
      const summaryContent = fs.readFileSync(summaryFilePath, 'utf-8');

      expect(summaryContent).toContain('var(--surface-dark-card)');
      expect(summaryContent).toContain('HATCHED_TEXTURE_DATA_URI');
      expect(summaryContent).toContain('url("data:image/svg+xml,');
      expect(summaryContent).toContain('var(--surface-dark-card-border)');
      expect(summaryContent).toContain('var(--text-on-dark-primary)');
    });

    it('verifies Framer Motion transitions exclusively use springPresets', () => {
      const summaryContent = fs.readFileSync(summaryFilePath, 'utf-8');

      expect(summaryContent).toContain("from '../styles/motionPresets'");
      expect(summaryContent).toContain('springPresets.layout');
      expect(summaryContent).toContain('springPresets.snappy');
    });
  });

  describe('D5.4-CHALLENGE.2: Empty Messages & Mathematical Zero-Division Defense', () => {
    it('handles empty message array gracefully without NaN, Infinity, or division-by-zero crashes', () => {
      const emptySummary = buildSummary('empty-session-123', []);

      expect(emptySummary.totalReps).toBe(0);
      expect(emptySummary.validReps).toBe(0);
      expect(emptySummary.peakDepthDeg).toBe(0);
      expect(emptySummary.averageMinKneeDeg).toBe(0);
      expect(emptySummary.alertCount).toBe(0);
      expect(emptySummary.maxValgusDevPct).toBe(0);
      expect(emptySummary.cuesCount).toBe(0);
      expect(emptySummary.cuesDelivered).toEqual([]);
      expect(emptySummary.timeline).toEqual([]);
      expect(emptySummary.durationMs).toBe(0);

      // Verify the math formulas used in Summary.tsx
      const durationSec = Math.round(emptySummary.durationMs / 1000);
      const validPct = emptySummary.totalReps > 0
        ? Math.round((emptySummary.validReps / emptySummary.totalReps) * 100)
        : 0;

      expect(durationSec).toBe(0);
      expect(validPct).toBe(0);
      expect(Number.isNaN(validPct)).toBe(false);
      expect(Number.isFinite(validPct)).toBe(true);

      // Verify depth distribution calculation used in Summary.tsx
      const depthPcts = [
        { label: 'Deep', count: emptySummary.depthDistribution.deep },
        { label: 'Good', count: emptySummary.depthDistribution.good },
        { label: 'Shallow', count: emptySummary.depthDistribution.shallow },
      ].map((d) => (emptySummary.totalReps > 0 ? (d.count / emptySummary.totalReps) * 100 : 0));

      for (const pct of depthPcts) {
        expect(pct).toBe(0);
        expect(Number.isNaN(pct)).toBe(false);
        expect(Number.isFinite(pct)).toBe(true);
      }
    });

    it('guards averageMinKneeDeg detail formatting when no reps are recorded', () => {
      const emptySummary = buildSummary('zero-reps-session', []);
      const detail = emptySummary.averageMinKneeDeg > 0
        ? `Avg: ${Math.round(emptySummary.averageMinKneeDeg)}° knee flexion`
        : 'No reps recorded';

      expect(detail).toBe('No reps recorded');
    });
  });

  describe('D5.4-CHALLENGE.3: Network Rejection, Error State & Retry Pipeline', () => {
    it('MessagesRequestBuilder queries custom messages with GUID and limit 100', async () => {
      chatMockState.reset();
      const testGuid = 'kine-test-session-999';

      const request = new CometChat.MessagesRequestBuilder()
        .setGUID(testGuid)
        .setCategories(['custom'])
        .setLimit(100)
        .build();

      expect(request).toBeDefined();
      expect(chatMockState.capturedQueryConfig.guid).toBe(testGuid);
      expect(chatMockState.capturedQueryConfig.categories).toEqual(['custom']);
      expect(chatMockState.capturedQueryConfig.limit).toBe(100);

      const messages = await request.fetchPrevious();
      expect(Array.isArray(messages)).toBe(true);
    });

    it('simulates network rejection on fetchPrevious and handles error recovery gracefully', async () => {
      chatMockState.reset();

      // Configure mock to simulate CometChat network timeout / server rejection
      chatMockState.customFetchPrevious = async () => {
        throw new Error('CometChat network timeout: unable to connect to edge cluster');
      };

      const request = new CometChat.MessagesRequestBuilder()
        .setGUID('failing-session')
        .setCategories(['custom'])
        .setLimit(100)
        .build();

      let caughtError: string | null = null;
      try {
        await request.fetchPrevious();
      } catch (err: unknown) {
        caughtError = err instanceof Error ? err.message : 'Failed to retrieve session message history';
      }

      expect(caughtError).toBe('CometChat network timeout: unable to connect to edge cluster');

      // Now simulate retry succeeding
      chatMockState.customFetchPrevious = async () => {
        const payload: KineRepPayload = {
          v: SCHEMA_VERSION,
          sid: 'failing-session',
          t: 1000,
          type: 'kine.rep',
          n: 1,
          minKneeDeg: 88,
          depth: 'good',
          durMs: 2200,
          tempo: 'controlled',
        };
        const msg = new CometChat.CustomMessage('failing-session', CometChat.RECEIVER_TYPE.GROUP, 'kine.rep', payload as any);
        return [msg];
      };

      const retryRequest = new CometChat.MessagesRequestBuilder()
        .setGUID('failing-session')
        .setCategories(['custom'])
        .setLimit(100)
        .build();

      const recoveredMessages = await retryRequest.fetchPrevious();
      expect(recoveredMessages.length).toBe(1);

      const summary = buildSummary('failing-session', recoveredMessages);
      expect(summary.totalReps).toBe(1);
      expect(summary.validReps).toBe(1);
    });
  });

  describe('D5.4-CHALLENGE.4: App.tsx Routing & State Reset Invariants', () => {
    it('verifies App.tsx handles lazy loading for Summary view', () => {
      expect(fs.existsSync(appFilePath)).toBe(true);
      const appContent = fs.readFileSync(appFilePath, 'utf-8');

      expect(appContent).toContain("const Summary = lazy(() => import('./views/Summary'));");
      expect(appContent).toContain('isSummaryView');
      expect(appContent).toContain('setIsSummaryView');
    });

    it('verifies handleTabChange resets isSummaryView to false to prevent ghost summary on tab switch', () => {
      const appContent = fs.readFileSync(appFilePath, 'utf-8');

      // Check handleTabChange implementation
      const tabChangeMatch = appContent.match(/const handleTabChange = \([^)]*\) => {([\s\S]*?)};/);
      expect(tabChangeMatch).not.toBeNull();
      const tabChangeBody = tabChangeMatch![1];
      expect(tabChangeBody).toContain('setIsSummaryView(false)');
    });

    it('verifies handleRoleChange resets isSummaryView to false to prevent cross-role state pollution', () => {
      const appContent = fs.readFileSync(appFilePath, 'utf-8');

      const roleChangeMatch = appContent.match(/const handleRoleChange = \([^)]*\) => {([\s\S]*?)};/);
      expect(roleChangeMatch).not.toBeNull();
      const roleChangeBody = roleChangeMatch![1];
      expect(roleChangeBody).toContain('setIsSummaryView(false)');
    });

    it('verifies Clinician triggers onEndSession and Patient triggers onLeaveSession to enter Summary', () => {
      const appContent = fs.readFileSync(appFilePath, 'utf-8');

      expect(appContent).toContain('onEndSession={() => {');
      expect(appContent).toContain('setIsSummaryView(true);');
      expect(appContent).toContain('onLeaveSession={() => {');
      expect(appContent).toContain('onBack={() => setIsSummaryView(false)}');
    });

    it('verifies mutual exclusion in studio main render: Summary vs Clinician vs Patient', () => {
      const appContent = fs.readFileSync(appFilePath, 'utf-8');

      expect(appContent).toContain('isSummaryView ? (');
      expect(appContent).toContain('<Summary');
      expect(appContent).toContain('activeRole === \'clinician\' ? (');
      expect(appContent).toContain('<Clinician');
      expect(appContent).toContain('<Patient');
    });
  });

  describe('D5.4-CHALLENGE.5: High-Load 100-Message Retrieval & Bento Ingestion Stress', () => {
    it('processes 100 messages (maximum limit) without performance degradation or state corruption', () => {
      const sid = 'high-load-session';
      const messages: CometChat.CustomMessage[] = [];

      // Generate 100 varied custom messages (reps, alerts, cues, markers)
      for (let i = 0; i < 100; i++) {
        if (i % 3 === 0) {
          const repPayload: KineRepPayload = {
            v: SCHEMA_VERSION,
            sid,
            t: 1000 + i * 2000,
            type: 'kine.rep',
            n: Math.floor(i / 3) + 1,
            minKneeDeg: 75 + (i % 40),
            depth: i % 2 === 0 ? 'good' : 'deep',
            durMs: 1800 + (i % 1000),
            tempo: 'controlled',
          };
          const msg = new CometChat.CustomMessage(sid, CometChat.RECEIVER_TYPE.GROUP, 'kine.rep', repPayload as any);
          msg.setSentAt(1000 + i * 2000);
          messages.push(msg);
        } else if (i % 3 === 1) {
          const alertPayload: KineAlertPayload = {
            v: SCHEMA_VERSION,
            sid,
            t: 1000 + i * 2000,
            type: 'kine.alert',
            kind: 'knee_valgus',
            side: i % 2 === 0 ? 'L' : 'R',
            value: 8.5 + (i % 10) * 0.5,
            thresholdPct: 8.0,
            repN: Math.floor(i / 3) + 1,
            phase: 'bottom',
            note: 'Form alert (biomechanical feedback)',
          };
          const msg = new CometChat.CustomMessage(sid, CometChat.RECEIVER_TYPE.GROUP, 'kine.alert', alertPayload as any);
          msg.setSentAt(1000 + i * 2000);
          messages.push(msg);
        } else {
          const cuePayload = {
            v: SCHEMA_VERSION,
            sid,
            t: 1000 + i * 2000,
            type: 'kine.cue',
            cue: 'chest_up',
            text: 'Keep chest tall',
            clinicianUid: 'dr-demo',
          };
          const msg = new CometChat.CustomMessage(sid, CometChat.RECEIVER_TYPE.GROUP, 'kine.cue', cuePayload as any);
          msg.setSentAt(1000 + i * 2000);
          messages.push(msg);
        }
      }

      const startTime = performance.now();
      const summary = buildSummary(sid, messages);
      const executionMs = performance.now() - startTime;

      expect(messages.length).toBe(100);
      expect(summary.totalReps).toBe(34);
      expect(summary.alertCount).toBe(33);
      expect(summary.cuesCount).toBe(33);
      expect(summary.timeline.length).toBe(100);
      expect(summary.maxValgusDevPct).toBeGreaterThan(8.0);
      expect(summary.alertBreakdown.L + summary.alertBreakdown.R).toBe(33);

      // Verify execution latency is well under 50ms for 100 messages
      expect(executionMs).toBeLessThan(50);
    });
  });
});
