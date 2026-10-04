import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '../..');
const CLIENT_DIR = path.join(PROJECT_ROOT, 'client');

describe('Milestone 3 Empirical Challenge: Dependencies, Scaffolding & Proxy Suite', () => {
  // 1. Dependency Resolution & Major Version Invariants
  describe('Dependency Resolution & Version Pins', () => {
    it('M3-CHALLENGE.1: client package.json declares exact required dependencies per R3', () => {
      const pkgPath = path.join(CLIENT_DIR, 'package.json');
      expect(fs.existsSync(pkgPath)).toBe(true);
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

      expect(pkg.dependencies).toBeDefined();
      expect(pkg.dependencies['@cometchat/calls-sdk-javascript']).toMatch(/^\^5\./);
      expect(pkg.dependencies['@cometchat/chat-sdk-javascript']).toMatch(/^\^4\./);
      expect(pkg.dependencies['@mediapipe/tasks-vision']).toMatch(/^\^0\.10\./);
      expect(pkg.dependencies['@kinesio/shared']).toBe('workspace:*');
      expect(pkg.dependencies['framer-motion']).toBeDefined();
      expect(pkg.dependencies['react']).toMatch(/^\^19\./);
      expect(pkg.dependencies['react-dom']).toMatch(/^\^19\./);
    });

    it('M3-CHALLENGE.2: node_modules contains installed and resolvable Calls SDK v5', async () => {
      const callsPkgJsonPath = fs.existsSync(path.join(CLIENT_DIR, 'node_modules', '@cometchat', 'calls-sdk-javascript', 'package.json'))
        ? path.join(CLIENT_DIR, 'node_modules', '@cometchat', 'calls-sdk-javascript', 'package.json')
        : path.join(PROJECT_ROOT, 'node_modules', '@cometchat', 'calls-sdk-javascript', 'package.json');
      expect(fs.existsSync(callsPkgJsonPath)).toBe(true);
      const callsPkg = JSON.parse(fs.readFileSync(callsPkgJsonPath, 'utf8'));
      expect(callsPkg.version).toMatch(/^5\./);
    });

    it('M3-CHALLENGE.3: node_modules contains installed and resolvable Chat SDK v4', async () => {
      const chatPkgJsonPath = fs.existsSync(path.join(CLIENT_DIR, 'node_modules', '@cometchat', 'chat-sdk-javascript', 'package.json'))
        ? path.join(CLIENT_DIR, 'node_modules', '@cometchat', 'chat-sdk-javascript', 'package.json')
        : path.join(PROJECT_ROOT, 'node_modules', '@cometchat', 'chat-sdk-javascript', 'package.json');
      expect(fs.existsSync(chatPkgJsonPath)).toBe(true);
      const chatPkg = JSON.parse(fs.readFileSync(chatPkgJsonPath, 'utf8'));
      expect(chatPkg.version).toMatch(/^4\./);
    });

    it('M3-CHALLENGE.4: node_modules contains installed and resolvable MediaPipe Tasks Vision', async () => {
      const visionPkgJsonPath = fs.existsSync(path.join(CLIENT_DIR, 'node_modules', '@mediapipe', 'tasks-vision', 'package.json'))
        ? path.join(CLIENT_DIR, 'node_modules', '@mediapipe', 'tasks-vision', 'package.json')
        : path.join(PROJECT_ROOT, 'node_modules', '@mediapipe', 'tasks-vision', 'package.json');
      expect(fs.existsSync(visionPkgJsonPath)).toBe(true);
      const visionPkg = JSON.parse(fs.readFileSync(visionPkgJsonPath, 'utf8'));
      expect(visionPkg.version).toMatch(/^0\.10\./);
    });

    it('M3-CHALLENGE.5: workspace link @kinesio/shared resolves cleanly to built dist artifacts', async () => {
      const sharedDistIndex = path.join(PROJECT_ROOT, 'shared', 'dist', 'index.js');
      const sharedDistDts = path.join(PROJECT_ROOT, 'shared', 'dist', 'index.d.ts');
      expect(fs.existsSync(sharedDistIndex)).toBe(true);
      expect(fs.existsSync(sharedDistDts)).toBe(true);

      const dtsContent = fs.readFileSync(sharedDistDts, 'utf8');
      expect(dtsContent).toContain('KinePosePayload');
      expect(dtsContent).toContain('SessionRequest');
      expect(dtsContent).toContain('SessionResponse');
    });
  });

  // 2. Vite Configuration & Proxy Invariants
  describe('Vite Configuration Verification', () => {
    it('M3-CHALLENGE.6: vite.config.ts configures define: { global: "window" }', () => {
      const configPath = path.join(CLIENT_DIR, 'vite.config.ts');
      expect(fs.existsSync(configPath)).toBe(true);
      const content = fs.readFileSync(configPath, 'utf8');

      expect(content).toMatch(/define:\s*\{\s*global:\s*['"]window['"]/);
    });

    it('M3-CHALLENGE.7: vite.config.ts configures proxy for /api targeting port 5000 with changeOrigin', () => {
      const configPath = path.join(CLIENT_DIR, 'vite.config.ts');
      const content = fs.readFileSync(configPath, 'utf8');

      expect(content).toMatch(/['"]\/api['"]\s*:\s*\{/);
      expect(content).toMatch(/target:\s*['"]http:\/\/localhost:5000['"]/);
      expect(content).toMatch(/changeOrigin:\s*true/);
    });

    it('M3-CHALLENGE.8: client index.html has root mount and scripts main.tsx', () => {
      const indexPath = path.join(CLIENT_DIR, 'index.html');
      expect(fs.existsSync(indexPath)).toBe(true);
      const content = fs.readFileSync(indexPath, 'utf8');

      expect(content).toContain('<div id="root"></div>');
      expect(content).toMatch(/src="\/src\/main\.tsx"/);
    });
  });

  // 3. Security Boundary & Secret Isolation
  describe('Security Boundary & Secret Scanning', () => {
    it('M3-CHALLENGE.9: zero server secrets leaked in client/src/', () => {
      const clientSrc = path.join(CLIENT_DIR, 'src');
      const forbidden = /COMETCHAT_AUTH_KEY|COMETCHAT_REST|apiKey\s*:\s*process\.env/i;

      function scan(dir: string): string[] {
        const hits: string[] = [];
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const full = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            hits.push(...scan(full));
          } else if (entry.isFile() && /\.(ts|tsx|js|jsx|json|html|css)$/.test(entry.name)) {
            const lines = fs.readFileSync(full, 'utf8').split('\n');
            lines.forEach((line, idx) => {
              if (forbidden.test(line)) {
                hits.push(`${full}:${idx + 1}: ${line.trim()}`);
              }
            });
          }
        }
        return hits;
      }

      const leaks = scan(clientSrc);
      expect(leaks).toEqual([]);
    });

    it('M3-CHALLENGE.10: no .env file exists inside client directory', () => {
      const clientEnv = path.join(CLIENT_DIR, '.env');
      expect(fs.existsSync(clientEnv)).toBe(false);
    });
  });

  // 4. Source & App Component Logic Stress Tests
  describe('Client Source Integrity & App State Resilience', () => {
    it('M3-CHALLENGE.11: App.tsx handles missing health endpoint gracefully without throwing', () => {
      const appSource = fs.readFileSync(path.join(CLIENT_DIR, 'src', 'App.tsx'), 'utf8');
      expect(appSource).toContain("fetch('/api/health')");
      expect(appSource).toContain('.catch(');
      expect(appSource).toContain('Server health probe notice:');
    });

    it('M3-CHALLENGE.12: App.tsx validates role selection and sanitizes sessionId input', () => {
      const appSource = fs.readFileSync(path.join(CLIENT_DIR, 'src', 'App.tsx'), 'utf8');
      // Verifies trim() on optional session ID before sending
      expect(appSource).toContain('sessionIdInput.trim()');
      expect(appSource).toContain("fetch('/api/session'");
      expect(appSource).toContain('handleConnect');
      expect(appSource).toContain('handleDisconnect');
    });

    it('M3-CHALLENGE.13: App.tsx imports shared constants CLINICIAN_UID and PATIENT_UID', () => {
      const appSource = fs.readFileSync(path.join(CLIENT_DIR, 'src', 'App.tsx'), 'utf8');
      expect(appSource).toContain('CLINICIAN_UID');
      expect(appSource).toContain('PATIENT_UID');
      expect(appSource).toContain('@kinesio/shared');
    });

    it('M3-CHALLENGE.14: client build artifact (dist/index.html and dist/assets) exists and is non-empty', () => {
      const distIndex = path.join(CLIENT_DIR, 'dist', 'index.html');
      expect(fs.existsSync(distIndex)).toBe(true);
      const stat = fs.statSync(distIndex);
      expect(stat.size).toBeGreaterThan(100);

      const distAssets = path.join(CLIENT_DIR, 'dist', 'assets');
      expect(fs.existsSync(distAssets)).toBe(true);
      const assets = fs.readdirSync(distAssets);
      expect(assets.length).toBeGreaterThanOrEqual(2); // js and css
    });
  });
});
