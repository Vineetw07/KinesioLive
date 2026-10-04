/**
 * tests/challenger_d5_m4_stress.test.ts
 *
 * Empirical Challenger 2 Stress & Adversarial Test Suite for Milestone D5.4:
 * Post-Workout Summary Bento View & Session Wiring.
 *
 * Evaluates:
 * 1. Code-splitting & bundle output: validates presence and dynamic loading of Summary chunk.
 * 2. High-volume timeline (50+ events): monotonicity, classification, container constraints.
 * 3. Inline SVG hatched texture: URI structure, valid SVG geometry, zero hex tokens.
 * 4. Session wiring invariants: onEndSession, onLeaveSession, onBack, and tab reset semantics.
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { CometChat } from '@cometchat/chat-sdk-javascript';
import { buildSummary } from '../client/src/engine/buildSummary';
import {
  SCHEMA_VERSION,
  type KineRepPayload,
  type KineAlertPayload,
  type KineCuePayload,
  type KineSessionMarkerPayload,
} from '../shared/src/index';

// Helpers to construct realistic CometChat custom messages
function createMsg(type: string, data: Record<string, unknown>, sentAt: number): CometChat.CustomMessage {
  const msg = new CometChat.CustomMessage(
    'kine-studio-demo',
    CometChat.RECEIVER_TYPE.GROUP,
    type,
    data
  );
  if (typeof (msg as any).setSentAt === 'function') {
    (msg as any).setSentAt(sentAt);
  }
  return msg;
}

describe('Challenger 2 Empirical Evaluation: Milestone D5.4', () => {
  const repoRoot = path.resolve(__dirname, '..');
  const clientDist = path.join(repoRoot, 'client', 'dist');
  const summarySourcePath = path.join(repoRoot, 'client', 'src', 'views', 'Summary.tsx');
  const appSourcePath = path.join(repoRoot, 'client', 'src', 'App.tsx');

  // =========================================================================
  // 1. Production Bundle & Dynamic Code-Splitting Verification
  // =========================================================================
  describe('1. Dynamic Code-Splitting & Production Build Output', () => {
    it('emits a dedicated split chunk for Summary in dist/assets', () => {
      const assetsDir = path.join(clientDist, 'assets');
      expect(fs.existsSync(assetsDir)).toBe(true);

      const files = fs.readdirSync(assetsDir);
      const summaryChunk = files.find((f) => f.startsWith('Summary-') && f.endsWith('.js'));
      expect(summaryChunk, 'Summary chunk must exist in client/dist/assets').toBeDefined();

      const chunkPath = path.join(assetsDir, summaryChunk!);
      const stat = fs.statSync(chunkPath);
      // Validates realistic bundle footprint: > 5KB and < 100KB
      expect(stat.size).toBeGreaterThan(5 * 1024);
      expect(stat.size).toBeLessThan(100 * 1024);
    });

    it('dynamically imports Summary from main index bundle without synchronous bundling', () => {
      const assetsDir = path.join(clientDist, 'assets');
      const files = fs.readdirSync(assetsDir);
      const indexBundle = files.find((f) => f.startsWith('index-') && f.endsWith('.js'));
      const summaryChunk = files.find((f) => f.startsWith('Summary-') && f.endsWith('.js'));

      expect(indexBundle).toBeDefined();
      expect(summaryChunk).toBeDefined();

      const indexContent = fs.readFileSync(path.join(assetsDir, indexBundle!), 'utf8');
      // Verifies dynamic import targeting the split chunk
      const hasDynamicImport = indexContent.includes(summaryChunk!) || indexContent.includes('./Summary-');
      expect(hasDynamicImport).toBe(true);
    });

    it('declares React.lazy import in App.tsx source', () => {
      const appSource = fs.readFileSync(appSourcePath, 'utf8');
      expect(appSource).toMatch(/lazy\s*\(\s*\(\)\s*=>\s*import\(['"]\.\/views\/Summary['"]\)\s*\)/);
    });
  });

  // =========================================================================
  // 2. High-Volume Timeline (50+ Workout Events) & Scroll Container Limits
  // =========================================================================
  describe('2. Timeline Scroll Container & 50+ Workout Events Stress', () => {
    it('processes 70 mixed workout events and produces strictly sorted timeline', () => {
      const messages: CometChat.BaseMessage[] = [];
      const baseTime = 1700000000000;

      // Inject Start Marker
      const startPayload: KineSessionMarkerPayload = {
        v: SCHEMA_VERSION,
        sid: 'stress-session',
        t: baseTime,
        type: 'kine.session',
        action: 'start',
      };
      messages.push(createMsg('kine.session', startPayload as any, baseTime));

      // Inject 30 Reps, 20 Alerts, 18 Cues in randomized / interleaved timestamps
      for (let i = 1; i <= 30; i++) {
        const repPayload: KineRepPayload = {
          v: SCHEMA_VERSION,
          sid: 'stress-session',
          t: baseTime + i * 1500,
          type: 'kine.rep',
          n: i,
          minKneeDeg: 80 + (i % 20),
          depth: (i % 3 === 0 ? 'deep' : i % 2 === 0 ? 'good' : 'shallow'),
          durMs: 1800,
          tempo: 'controlled',
        };
        messages.push(createMsg('kine.rep', repPayload as any, repPayload.t));
      }

      for (let j = 1; j <= 20; j++) {
        const alertPayload = {
          v: SCHEMA_VERSION,
          sid: 'stress-session',
          t: baseTime + j * 2100,
          type: 'kine.alert',
          side: j % 2 === 0 ? 'L' : 'R',
          value: 9.0 + (j % 5),
          thresholdPct: 8.0,
          repN: j,
        };
        messages.push(createMsg('kine.alert', alertPayload as any, alertPayload.t));
      }

      for (let k = 1; k <= 18; k++) {
        const cuePayload: KineCuePayload = {
          v: SCHEMA_VERSION,
          sid: 'stress-session',
          t: baseTime + k * 2300,
          type: 'kine.cue',
          cue: 'knees_out',
          text: `Focus on knee drive #${k}`,
          targetUid: 'patient',
          senderUid: 'clinician',
        };
        messages.push(createMsg('kine.cue', cuePayload as any, cuePayload.t));
      }

      // Inject End Marker
      const endPayload: KineSessionMarkerPayload = {
        v: SCHEMA_VERSION,
        sid: 'stress-session',
        t: baseTime + 70000,
        type: 'kine.session',
        action: 'end',
      };
      messages.push(createMsg('kine.session', endPayload as any, endPayload.t));

      // 1 start + 30 reps + 20 alerts + 18 cues + 1 end = 70 events
      expect(messages.length).toBe(70);

      // Shuffle messages to ensure out-of-order stress
      const shuffled = [...messages].sort(() => Math.random() - 0.5);

      const summary = buildSummary('stress-session', shuffled);

      expect(summary.timeline.length).toBe(70);
      expect(summary.totalReps).toBe(30);
      expect(summary.alertCount).toBe(20);
      expect(summary.cuesCount).toBe(18);

      // Verify Chronological Monotonicity
      for (let idx = 1; idx < summary.timeline.length; idx++) {
        expect(summary.timeline[idx].timestamp).toBeGreaterThanOrEqual(summary.timeline[idx - 1].timestamp);
      }
    });

    it('strictly enforces maxHeight: "480px" and overflowY: "auto" in Summary.tsx', () => {
      const summarySource = fs.readFileSync(summarySourcePath, 'utf8');

      // Check scroll container styling
      expect(summarySource).toContain("maxHeight: '480px'");
      expect(summarySource).toContain("overflowY: 'auto'");

      // Verify empty state is provided
      expect(summarySource).toContain('No workout events were recorded during this session.');
    });

    it('tags timeline event badges with proper semantic design tokens', () => {
      const summarySource = fs.readFileSync(summarySourcePath, 'utf8');

      expect(summarySource).toContain('var(--status-stable)');
      expect(summarySource).toContain('var(--status-critical)');
      expect(summarySource).toContain('var(--accent-cyan)');
      expect(summarySource).toContain('var(--accent-lavender)');
    });
  });

  // =========================================================================
  // 3. Dark Anchor Card Visual Texture & Zero Hex Discipline
  // =========================================================================
  describe('3. Dark Anchor Card & SVG Hatched Texture Discipline', () => {
    it('defines a valid, self-contained SVG hatched texture data URI in Summary.tsx', () => {
      const summarySource = fs.readFileSync(summarySourcePath, 'utf8');

      expect(summarySource).toContain('const HATCHED_TEXTURE_DATA_URI =');
      expect(summarySource).toContain("url(\"data:image/svg+xml,");

      // Verify URI contents
      expect(summarySource).toContain("%3Csvg width=\\'24\\' height=\\'24\\' viewBox=\\'0 0 24 24\\'");
      expect(summarySource).toContain("stroke=\\'rgba(255,255,255,0.045)\\'");
      expect(summarySource).toContain("stroke-width=\\'1.5\\'");
    });

    it('enforces ZERO raw hex codes (#...) in Summary.tsx', () => {
      const summarySource = fs.readFileSync(summarySourcePath, 'utf8');
      // Ignore lines in comments or find all raw hex matches
      const lines = summarySource.split('\n');
      const hexMatches: { line: number; text: string }[] = [];

      lines.forEach((lineText, idx) => {
        const trimmed = lineText.trim();
        if (trimmed.startsWith('*') || trimmed.startsWith('//') || trimmed.startsWith('/*')) return;
        const found = lineText.match(/#[0-9a-fA-F]{3,8}\b/g);
        if (found) {
          hexMatches.push({ line: idx + 1, text: lineText });
        }
      });

      expect(hexMatches, `Raw hex codes found: ${JSON.stringify(hexMatches)}`).toEqual([]);
    });

    it('applies dark surface tokens and luminous bilateral alert pills', () => {
      const summarySource = fs.readFileSync(summarySourcePath, 'utf8');

      expect(summarySource).toContain('var(--surface-dark-card)');
      expect(summarySource).toContain('var(--surface-dark-card-border)');
      expect(summarySource).toContain('var(--text-on-dark-primary)');
      expect(summarySource).toContain("boxShadow: '0 0 12px color-mix(in srgb, var(--status-critical) 40%, transparent)'");
    });
  });

  // =========================================================================
  // 4. Session Navigation Wiring Invariants in App.tsx
  // =========================================================================
  describe('4. Session Wiring & End-Session Invariants in App.tsx', () => {
    it('wires Clinician onEndSession and Patient onLeaveSession to isSummaryView state', () => {
      const appSource = fs.readFileSync(appSourcePath, 'utf8');

      // State declaration
      expect(appSource).toContain('const [isSummaryView, setIsSummaryView] = useState<boolean>(false);');

      // Clinician onEndSession wiring
      expect(appSource).toMatch(/<Clinician[\s\S]*?onEndSession=\{[\s\S]*?setIsSummaryView\(true\)/);

      // Patient onLeaveSession wiring
      expect(appSource).toMatch(/<Patient[\s\S]*?onLeaveSession=\{[\s\S]*?setIsSummaryView\(true\)/);

      // Summary onBack wiring
      expect(appSource).toMatch(/<Summary[\s\S]*?onBack=\{[\s\S]*?setIsSummaryView\(false\)/);
    });

    it('resets isSummaryView to false when changing tabs or switching roles', () => {
      const appSource = fs.readFileSync(appSourcePath, 'utf8');

      // Check handleTabChange resets isSummaryView
      expect(appSource).toMatch(/handleTabChange[\s\S]*?setIsSummaryView\(false\)/);

      // Check handleRoleChange resets isSummaryView
      expect(appSource).toMatch(/handleRoleChange[\s\S]*?setIsSummaryView\(false\)/);
    });
  });
});
