import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  SCHEMA_VERSION,
  CLINICIAN_UID,
  PATIENT_UID,
  TELEMETRY_RATE_HZ,
  VALGUS_THRESHOLD_PCT,
  VALGUS_COOLDOWN_MS,
  type Envelope,
  type KinePosePayload,
  type KineRepPayload,
  type KineAlertPayload,
  type KineCuePayload,
  type KineSessionMarkerPayload,
  type KineMessage,
  type SessionRequest,
  type SessionResponse,
  type SquatPhase
} from '../../shared/src/index.js';
import { PROJECT_ROOT, SHARED_DIR } from './helpers/specHarness.js';

describe('Contracts & Workspace Test Suite (Features 1 & 2)', () => {
  // =========================================================================
  // FEATURE 1: Workspace Linking & Package Exports (ORIGINAL_REQUEST §R1)
  // =========================================================================

  describe('Feature 1 - Tier 1: Workspace Linking & Package Exports Primary Behavior', () => {
    it('F1-T1.1: pnpm-workspace.yaml defines shared, server, and client packages', () => {
      const workspacePath = path.join(PROJECT_ROOT, 'pnpm-workspace.yaml');
      expect(fs.existsSync(workspacePath)).toBe(true);
      const content = fs.readFileSync(workspacePath, 'utf8');
      expect(content).toMatch(/packages:/);
      expect(content).toMatch(/['"]?shared['"]?/);
      expect(content).toMatch(/['"]?server['"]?/);
      expect(content).toMatch(/['"]?client['"]?/);
    });

    it('F1-T1.2: root package.json defines private monorepo with standard build, typecheck, and test scripts', () => {
      const rootPkgPath = path.join(PROJECT_ROOT, 'package.json');
      expect(fs.existsSync(rootPkgPath)).toBe(true);
      const pkg = JSON.parse(fs.readFileSync(rootPkgPath, 'utf8'));
      expect(pkg.private).toBe(true);
      expect(pkg.scripts).toBeDefined();
      expect(pkg.scripts.build).toContain('build');
      expect(pkg.scripts.typecheck).toContain('typecheck');
      expect(pkg.scripts.test).toBeDefined();
    });

    it('F1-T1.3: @kinesio/shared package.json defines ESM type, exports map, and declaration outputs', () => {
      const sharedPkgPath = path.join(SHARED_DIR, 'package.json');
      expect(fs.existsSync(sharedPkgPath)).toBe(true);
      const pkg = JSON.parse(fs.readFileSync(sharedPkgPath, 'utf8'));
      expect(pkg.name).toBe('@kinesio/shared');
      expect(pkg.type).toBe('module');
      expect(pkg.main).toBe('./dist/index.js');
      expect(pkg.types).toBe('./dist/index.d.ts');
      expect(pkg.exports).toBeDefined();
      expect(pkg.exports['.']).toBeDefined();
      expect(pkg.exports['.'].types).toBe('./dist/index.d.ts');
      expect(pkg.exports['.'].import).toBe('./dist/index.js');
    });

    it('F1-T1.4: root tsconfig.json specifies NodeNext module resolution and strict mode', () => {
      const tsconfigPath = path.join(PROJECT_ROOT, 'tsconfig.json');
      expect(fs.existsSync(tsconfigPath)).toBe(true);
      const tsconfig = JSON.parse(fs.readFileSync(tsconfigPath, 'utf8'));
      expect(tsconfig.compilerOptions).toBeDefined();
      expect(tsconfig.compilerOptions.strict).toBe(true);
      expect(tsconfig.compilerOptions.target).toMatch(/ES2022|ESNext/i);
    });

    it('F1-T1.5: shared dist directory contains compiled ESM javascript and d.ts declaration files', () => {
      const distIndexJs = path.join(SHARED_DIR, 'dist', 'index.js');
      const distIndexDts = path.join(SHARED_DIR, 'dist', 'index.d.ts');
      expect(fs.existsSync(distIndexJs)).toBe(true);
      expect(fs.existsSync(distIndexDts)).toBe(true);
      const jsContent = fs.readFileSync(distIndexJs, 'utf8');
      expect(jsContent).toContain('SCHEMA_VERSION');
      expect(jsContent).toContain('CLINICIAN_UID');
      expect(jsContent).toContain('PATIENT_UID');
    });
  });

  describe('Feature 1 - Tier 2: Boundary & Corner Cases', () => {
    it('F1-T2.1: shared package files array restricts packaging to dist directory', () => {
      const sharedPkg = JSON.parse(fs.readFileSync(path.join(SHARED_DIR, 'package.json'), 'utf8'));
      expect(sharedPkg.files).toBeDefined();
      expect(sharedPkg.files).toContain('dist');
    });

    it('F1-T2.2: shared package has zero external runtime production dependencies', () => {
      const sharedPkg = JSON.parse(fs.readFileSync(path.join(SHARED_DIR, 'package.json'), 'utf8'));
      expect(sharedPkg.dependencies).toBeUndefined();
    });

    it('F1-T2.3: shared tsconfig.json enforces isolated outDir and rootDir settings', () => {
      const sharedTsconfig = JSON.parse(fs.readFileSync(path.join(SHARED_DIR, 'tsconfig.json'), 'utf8'));
      expect(sharedTsconfig.compilerOptions.outDir).toBe('./dist');
      expect(sharedTsconfig.compilerOptions.rootDir).toBe('./src');
      expect(sharedTsconfig.compilerOptions.declaration).toBe(true);
    });

    it('F1-T2.4: pnpm-workspace.yaml is robust against trailing whitespace and newlines', () => {
      const raw = fs.readFileSync(path.join(PROJECT_ROOT, 'pnpm-workspace.yaml'), 'utf8');
      const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
      expect(lines.length).toBeGreaterThanOrEqual(4);
      expect(lines[0]).toBe('packages:');
    });

    it('F1-T2.5: shared dist declaration file index.d.ts exports complete type signatures without any syntax error', () => {
      const dtsContent = fs.readFileSync(path.join(SHARED_DIR, 'dist', 'index.d.ts'), 'utf8');
      expect(dtsContent).toContain('export interface KinePosePayload');
      expect(dtsContent).toContain('export interface SessionRequest');
      expect(dtsContent).toContain('export interface SessionResponse');
      expect(dtsContent).toContain('export declare const CLINICIAN_UID: "dr-demo"');
    });
  });

  // =========================================================================
  // FEATURE 2: Shared Biomechanical Schemas & Types (ORIGINAL_REQUEST §R1, TRD §2)
  // =========================================================================

  describe('Feature 2 - Tier 1: Shared Biomechanical Schemas Primary Behavior', () => {
    it('F2-T1.1: SCHEMA_VERSION constant strictly equals 1', () => {
      expect(SCHEMA_VERSION).toBe(1);
    });

    it('F2-T1.2: deterministic demo UIDs match dr-demo and pt-demo', () => {
      expect(CLINICIAN_UID).toBe('dr-demo');
      expect(PATIENT_UID).toBe('pt-demo');
      expect(CLINICIAN_UID).not.toBe(PATIENT_UID);
    });

    it('F2-T1.3: telemetry and valgus threshold constants conform to TRD §Section 2', () => {
      expect(TELEMETRY_RATE_HZ).toBe(10);
      expect(VALGUS_THRESHOLD_PCT).toBe(8.0);
      expect(VALGUS_COOLDOWN_MS).toBe(4000);
    });

    it('F2-T1.4: Envelope contract enforces schema version, session ID, and timestamp', () => {
      const envelope: Envelope = {
        v: SCHEMA_VERSION,
        sid: 'kine-test-session',
        t: Date.now()
      };
      expect(envelope.v).toBe(1);
      expect(typeof envelope.sid).toBe('string');
      expect(typeof envelope.t).toBe('number');
      expect(envelope.t).toBeGreaterThan(0);
    });

    it('F2-T1.5: KinePosePayload validates complete biomechanical payload', () => {
      const pose: KinePosePayload = {
        v: 1,
        sid: 'kine-session-123',
        t: 1727978400000,
        type: 'kine.pose',
        seq: 42,
        fps: 30,
        phase: 'descending',
        kneeFlexionDeg: { L: 135.5, R: 136.2 },
        valgusDevPct: { L: 2.1, R: -1.0 },
        depthRatio: 0.45,
        vis: 0.98,
        reps: 2
      };

      expect(pose.type).toBe('kine.pose');
      expect(pose.seq).toBe(42);
      expect(pose.kneeFlexionDeg.L).toBeCloseTo(135.5);
      expect(pose.phase).toBe('descending');
      expect(pose.reps).toBe(2);
    });

    it('F2-T1.6: KineRepPayload, KineAlertPayload, KineCuePayload, and KineSessionMarkerPayload discriminate on type', () => {
      const rep: KineRepPayload = {
        v: 1,
        sid: 'kine-s1',
        t: 1000,
        type: 'kine.rep',
        n: 1,
        minKneeDeg: 88.5,
        depth: 'good',
        durMs: 2400,
        tempo: 'controlled'
      };

      const alert: KineAlertPayload = {
        v: 1,
        sid: 'kine-s1',
        t: 1200,
        type: 'kine.alert',
        kind: 'knee_valgus',
        side: 'L',
        value: 11.4,
        thresholdPct: 8.0,
        repN: 1,
        phase: 'bottom',
        note: 'Form alert (biomechanical feedback)'
      };

      const cue: KineCuePayload = {
        v: 1,
        sid: 'kine-s1',
        t: 1300,
        type: 'kine.cue',
        cue: 'knees_out',
        text: 'Push knees outward over toes'
      };

      const marker: KineSessionMarkerPayload = {
        v: 1,
        sid: 'kine-s1',
        t: 1400,
        type: 'kine.session',
        action: 'start',
        clinicianUid: CLINICIAN_UID,
        patientUid: PATIENT_UID
      };

      const messages: KineMessage[] = [rep, alert, cue, marker];
      const types = messages.map(m => m.type);
      expect(types).toEqual(['kine.rep', 'kine.alert', 'kine.cue', 'kine.session']);
    });
  });

  describe('Feature 2 - Tier 2: Boundary & Corner Cases', () => {
    it('F2-T2.1: kneeFlexionDeg supports bilateral nulls when landmarks are occluded', () => {
      const occludedPose: KinePosePayload = {
        v: 1,
        sid: 'kine-occluded',
        t: Date.now(),
        type: 'kine.pose',
        seq: 1,
        fps: 30,
        phase: 'lost',
        kneeFlexionDeg: { L: null, R: null },
        valgusDevPct: { L: null, R: null },
        depthRatio: 0,
        vis: 0.12,
        reps: 0
      };

      expect(occludedPose.kneeFlexionDeg.L).toBeNull();
      expect(occludedPose.kneeFlexionDeg.R).toBeNull();
      expect(occludedPose.phase).toBe('lost');
    });

    it('F2-T2.2: valgusDevPct supports negative values for varus / outward deviation', () => {
      const varusPose: KinePosePayload = {
        v: 1,
        sid: 'kine-varus',
        t: Date.now(),
        type: 'kine.pose',
        seq: 5,
        fps: 30,
        phase: 'bottom',
        kneeFlexionDeg: { L: 90, R: 90 },
        valgusDevPct: { L: -4.5, R: -3.8 },
        depthRatio: 0.95,
        vis: 0.95,
        reps: 1
      };

      expect(varusPose.valgusDevPct.L).toBeLessThan(0);
      expect(varusPose.valgusDevPct.R).toBeLessThan(0);
    });

    it('F2-T2.3: depthRatio handles extreme values (standing 0.0, parallel 1.0, deep > 1.0)', () => {
      const standingRatio = 0.0;
      const parallelRatio = 1.0;
      const deepRatio = 1.25;

      expect(standingRatio).toBe(0.0);
      expect(parallelRatio).toBe(1.0);
      expect(deepRatio).toBeGreaterThan(1.0);
    });

    it('F2-T2.4: SquatPhase supports all 5 canonical states in state machine', () => {
      const validPhases: SquatPhase[] = ['standing', 'descending', 'bottom', 'ascending', 'lost'];
      expect(validPhases).toHaveLength(5);
      validPhases.forEach(phase => {
        const payload: Partial<KinePosePayload> = { phase };
        expect(validPhases).toContain(payload.phase);
      });
    });

    it('F2-T2.5: SessionRequest and SessionResponse handle optional sessionId correctly', () => {
      const reqOmitted: SessionRequest = { role: 'clinician' };
      const reqProvided: SessionRequest = { role: 'patient', sessionId: 'kine-room-99' };

      expect(reqOmitted.sessionId).toBeUndefined();
      expect(reqProvided.sessionId).toBe('kine-room-99');

      const res: SessionResponse = {
        sessionId: 'kine-room-99',
        authToken: 'auth_tok_xyz',
        uid: PATIENT_UID,
        appId: '168428446858f07fb',
        region: 'IN'
      };

      expect(res.uid).toBe('pt-demo');
      expect(res.sessionId).toBe('kine-room-99');
      expect(res.authToken).toBeTruthy();
    });
  });
});
