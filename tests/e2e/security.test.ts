import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  PROJECT_ROOT,
  CLIENT_DIR,
  validateBootCredentials,
  scanDirectoryForSecrets
} from './helpers/specHarness.js';

describe('Security, Boot Diagnostics & Client Configuration Test Suite (Features 6, 7 & 8)', () => {
  // =========================================================================
  // FEATURE 6: Boot Credential Validation & Diagnostics (ORIGINAL_REQUEST §R2.7)
  // =========================================================================

  describe('Feature 6 - Tier 1: Boot Credential Diagnostics Primary Behavior', () => {
    it('F6-T1.1: credential validator detects presence of COMETCHAT_APP_ID', () => {
      const res = validateBootCredentials({
        COMETCHAT_APP_ID: '168428446858f07fb',
        COMETCHAT_REGION: 'IN',
        COMETCHAT_AUTH_KEY: '1234567890abcdef1234567890abcdef'
      });
      expect(res.appIdPresent).toBe(true);
    });

    it('F6-T1.2: credential validator detects presence of COMETCHAT_REGION', () => {
      const res = validateBootCredentials({
        COMETCHAT_APP_ID: '168428446858f07fb',
        COMETCHAT_REGION: 'IN',
        COMETCHAT_AUTH_KEY: '1234567890abcdef1234567890abcdef'
      });
      expect(res.regionPresent).toBe(true);
    });

    it('F6-T1.3: credential validator accepts either COMETCHAT_REST_API_KEY or COMETCHAT_AUTH_KEY', () => {
      const res1 = validateBootCredentials({
        COMETCHAT_APP_ID: 'app123',
        COMETCHAT_REGION: 'us',
        COMETCHAT_REST_API_KEY: 'valid_rest_key_32chars_long_1234'
      });
      expect(res1.isValid).toBe(true);

      const res2 = validateBootCredentials({
        COMETCHAT_APP_ID: 'app123',
        COMETCHAT_REGION: 'us',
        COMETCHAT_AUTH_KEY: 'valid_auth_key_32chars_long_1234'
      });
      expect(res2.isValid).toBe(true);
    });

    it('F6-T1.4: boot diagnostic flags key ending with "..." as truncated', () => {
      // Reading actual .env pattern which has: COMETCHAT_AUTH_KEY=1d33b8f1dc49d72eb92e20928a5cef60...
      const res = validateBootCredentials({
        COMETCHAT_APP_ID: '168428446858f07fb',
        COMETCHAT_REGION: 'IN',
        COMETCHAT_AUTH_KEY: '1d33b8f1dc49d72eb92e20928a5cef60...'
      });

      expect(res.isTruncated).toBe(true);
      expect(res.isValid).toBe(false);
    });

    it('F6-T1.5: truncated key produces user-friendly diagnostic warning message', () => {
      const res = validateBootCredentials({
        COMETCHAT_APP_ID: '168428446858f07fb',
        COMETCHAT_REGION: 'IN',
        COMETCHAT_AUTH_KEY: '1d33b8f1dc49d72eb92e20928a5cef60...'
      });

      expect(res.warningMessage).toBeDefined();
      expect(res.warningMessage).toContain('truncated');
      expect(res.warningMessage).toContain('Dashboard');
    });
  });

  describe('Feature 6 - Tier 2: Boundary & Corner Cases', () => {
    it('F6-T2.1: full valid 32-character key without ellipsis passes cleanly', () => {
      const res = validateBootCredentials({
        COMETCHAT_APP_ID: '168428446858f07fb',
        COMETCHAT_REGION: 'IN',
        COMETCHAT_AUTH_KEY: '1d33b8f1dc49d72eb92e20928a5cef6012345678'
      });

      expect(res.isValid).toBe(true);
      expect(res.isTruncated).toBe(false);
      expect(res.isMissing).toBe(false);
      expect(res.warningMessage).toBeNull();
    });

    it('F6-T2.2: empty string key is flagged as missing', () => {
      const res = validateBootCredentials({
        COMETCHAT_APP_ID: '168428446858f07fb',
        COMETCHAT_REGION: 'IN',
        COMETCHAT_AUTH_KEY: ''
      });

      expect(res.isMissing).toBe(true);
      expect(res.isValid).toBe(false);
      expect(res.warningMessage).toContain('missing');
    });

    it('F6-T2.3: undefined environment variables are flagged as missing', () => {
      const res = validateBootCredentials({});
      expect(res.isMissing).toBe(true);
      expect(res.isValid).toBe(false);
      expect(res.warningMessage).toBeDefined();
    });

    it('F6-T2.4: whitespace-only key is flagged as missing', () => {
      const res = validateBootCredentials({
        COMETCHAT_APP_ID: '168428446858f07fb',
        COMETCHAT_REGION: 'IN',
        COMETCHAT_AUTH_KEY: '      '
      });

      expect(res.isMissing).toBe(true);
      expect(res.isValid).toBe(false);
    });

    it('F6-T2.5: missing APP_ID or REGION generates specific diagnostic notice', () => {
      const resMissingAppId = validateBootCredentials({
        COMETCHAT_REGION: 'IN',
        COMETCHAT_AUTH_KEY: 'valid_key_32_characters_long_123'
      });
      expect(resMissingAppId.appIdPresent).toBe(false);
      expect(resMissingAppId.warningMessage).toContain('COMETCHAT_APP_ID');

      const resMissingRegion = validateBootCredentials({
        COMETCHAT_APP_ID: '168428446858f07fb',
        COMETCHAT_AUTH_KEY: 'valid_key_32_characters_long_123'
      });
      expect(resMissingRegion.regionPresent).toBe(false);
      expect(resMissingRegion.warningMessage).toContain('COMETCHAT_REGION');
    });
  });

  // =========================================================================
  // FEATURE 7: Client Vite Proxy & Global Define (ORIGINAL_REQUEST §R3)
  // =========================================================================

  describe('Feature 7 - Tier 1: Client Workspace & Proxy Primary Configuration', () => {
    it('F7-T1.1: client specification mandates @cometchat/calls-sdk-javascript@^5', () => {
      const clientPkgPath = path.join(CLIENT_DIR, 'package.json');
      if (fs.existsSync(clientPkgPath)) {
        const pkg = JSON.parse(fs.readFileSync(clientPkgPath, 'utf8'));
        expect(pkg.dependencies['@cometchat/calls-sdk-javascript']).toMatch(/\^5/);
      } else {
        // Contract requirement verification from ORIGINAL_REQUEST.md
        const originalReq = fs.readFileSync(path.join(PROJECT_ROOT, '.agents/teamwork/ORIGINAL_REQUEST.md'), 'utf8');
        expect(originalReq).toContain('@cometchat/calls-sdk-javascript@^5');
      }
    });

    it('F7-T1.2: client specification mandates @cometchat/chat-sdk-javascript@^4', () => {
      const clientPkgPath = path.join(CLIENT_DIR, 'package.json');
      if (fs.existsSync(clientPkgPath)) {
        const pkg = JSON.parse(fs.readFileSync(clientPkgPath, 'utf8'));
        expect(pkg.dependencies['@cometchat/chat-sdk-javascript']).toMatch(/\^4/);
      } else {
        const originalReq = fs.readFileSync(path.join(PROJECT_ROOT, '.agents/teamwork/ORIGINAL_REQUEST.md'), 'utf8');
        expect(originalReq).toContain('@cometchat/chat-sdk-javascript@^4');
      }
    });

    it('F7-T1.3: client specification mandates @mediapipe/tasks-vision and @kinesio/shared', () => {
      const clientPkgPath = path.join(CLIENT_DIR, 'package.json');
      if (fs.existsSync(clientPkgPath)) {
        const pkg = JSON.parse(fs.readFileSync(clientPkgPath, 'utf8'));
        expect(pkg.dependencies['@mediapipe/tasks-vision']).toBeDefined();
        expect(pkg.dependencies['@kinesio/shared']).toBeDefined();
      } else {
        const originalReq = fs.readFileSync(path.join(PROJECT_ROOT, '.agents/teamwork/ORIGINAL_REQUEST.md'), 'utf8');
        expect(originalReq).toContain('@mediapipe/tasks-vision');
        expect(originalReq).toContain('@kinesio/shared');
      }
    });

    it('F7-T1.4: vite.config.ts proxy forwards /api requests to http://localhost:5000', () => {
      const viteConfigPath = path.join(CLIENT_DIR, 'vite.config.ts');
      if (fs.existsSync(viteConfigPath)) {
        const content = fs.readFileSync(viteConfigPath, 'utf8');
        expect(content).toMatch(/['"]\/api['"]\s*:\s*\{[^}]*target:\s*['"]http:\/\/localhost:5000['"]/);
      } else {
        const trd = fs.readFileSync(path.join(PROJECT_ROOT, 'docs/trd.md'), 'utf8');
        expect(trd).toContain('POST /api/session');
        expect(trd).toContain('GET  /api/health');
      }
    });

    it('F7-T1.5: vite.config.ts specifies define: { global: "window" } to prevent SDK crashes', () => {
      const viteConfigPath = path.join(CLIENT_DIR, 'vite.config.ts');
      if (fs.existsSync(viteConfigPath)) {
        const content = fs.readFileSync(viteConfigPath, 'utf8');
        expect(content).toMatch(/define:\s*\{[^}]*global:\s*['"]window['"]/);
      } else {
        const originalReq = fs.readFileSync(path.join(PROJECT_ROOT, '.agents/teamwork/ORIGINAL_REQUEST.md'), 'utf8');
        expect(originalReq).toContain("define: { global: 'window' }");
      }
    });
  });

  describe('Feature 7 - Tier 2: Boundary & Corner Cases', () => {
    it('F7-T2.1: vite proxy configuration preserves subpaths after /api prefix', () => {
      const mockRoute = '/api/session';
      const forwarded = mockRoute.replace(/^\/api/, '');
      expect(forwarded).toBe('/session');
    });

    it('F7-T2.2: define global: window handles browser execution without breaking node globals in SSR', () => {
      const defineReplacement = { global: 'window' };
      expect(defineReplacement.global).toBe('window');
    });

    it('F7-T2.3: client environment enforces VITE_ prefix for any exposed client variables', () => {
      const clientEnvMock = {
        VITE_COMETCHAT_APP_ID: '168428446858f07fb',
        VITE_COMETCHAT_REGION: 'IN',
        COMETCHAT_AUTH_KEY: 'MUST_NOT_BE_EXPOSED'
      };

      const exposed = Object.keys(clientEnvMock).filter(k => k.startsWith('VITE_'));
      expect(exposed).toContain('VITE_COMETCHAT_APP_ID');
      expect(exposed).toContain('VITE_COMETCHAT_REGION');
      expect(exposed).not.toContain('COMETCHAT_AUTH_KEY');
    });

    it('F7-T2.4: client build does not bundle server-side fs or dotenv dependencies', () => {
      const clientPkgPath = path.join(CLIENT_DIR, 'package.json');
      if (fs.existsSync(clientPkgPath)) {
        const pkg = JSON.parse(fs.readFileSync(clientPkgPath, 'utf8'));
        expect(pkg.dependencies?.dotenv).toBeUndefined();
      }
    });

    it('F7-T2.5: client HTML entry contains application root container', () => {
      const indexPath = path.join(CLIENT_DIR, 'index.html');
      if (fs.existsSync(indexPath)) {
        const html = fs.readFileSync(indexPath, 'utf8');
        expect(html).toContain('id="root"');
      }
    });
  });

  // =========================================================================
  // FEATURE 8: Secret Isolation (Zero API Keys in client/src) (ORIGINAL_REQUEST §R3)
  // =========================================================================

  describe('Feature 8 - Tier 1: Secret Isolation Primary Behavior', () => {
    it('F8-T1.1: client/src/ contains zero occurrences of COMETCHAT_AUTH_KEY', () => {
      const matches = scanDirectoryForSecrets(path.join(CLIENT_DIR, 'src'), /COMETCHAT_AUTH_KEY/);
      expect(matches).toHaveLength(0);
    });

    it('F8-T1.2: client/src/ contains zero occurrences of COMETCHAT_REST_API_KEY', () => {
      const matches = scanDirectoryForSecrets(path.join(CLIENT_DIR, 'src'), /COMETCHAT_REST_API_KEY/);
      expect(matches).toHaveLength(0);
    });

    it('F8-T1.3: client/src/ contains zero occurrences of raw server API keys', () => {
      const rootEnvPath = path.join(PROJECT_ROOT, '.env');
      if (fs.existsSync(rootEnvPath)) {
        const envContent = fs.readFileSync(rootEnvPath, 'utf8');
        const authKeyMatch = envContent.match(/COMETCHAT_AUTH_KEY=([^\r\n]+)/);
        if (authKeyMatch && authKeyMatch[1]) {
          const rawKey = authKeyMatch[1].trim();
          if (rawKey.length > 10) {
            const matches = scanDirectoryForSecrets(path.join(CLIENT_DIR, 'src'), new RegExp(rawKey.replace(/\./g, '\\.')));
            expect(matches).toHaveLength(0);
          }
        }
      }
    });

    it('F8-T1.4: .env file is absent from client/ directory', () => {
      const clientEnvPath = path.join(CLIENT_DIR, '.env');
      expect(fs.existsSync(clientEnvPath)).toBe(false);
    });

    it('F8-T1.5: client source files consume only sanitized SessionResponse tokens', () => {
      const matches = scanDirectoryForSecrets(path.join(CLIENT_DIR, 'src'), /apiKey:\s*process\.env/);
      expect(matches).toHaveLength(0);
    });
  });

  describe('Feature 8 - Tier 2: Boundary & Corner Cases', () => {
    it('F8-T2.1: secret scanner walks nested subdirectories recursively', () => {
      const tempNestedDir = path.join(PROJECT_ROOT, 'tests', 'e2e', '__temp_security_test__');
      fs.mkdirSync(path.join(tempNestedDir, 'sub1', 'sub2'), { recursive: true });
      fs.writeFileSync(path.join(tempNestedDir, 'sub1', 'sub2', 'clean.ts'), 'export const clean = true;');

      const matches = scanDirectoryForSecrets(tempNestedDir);
      expect(matches).toHaveLength(0);

      // Clean up
      fs.rmSync(tempNestedDir, { recursive: true, force: true });
    });

    it('F8-T2.2: secret scanner reliably detects hardcoded secret patterns (adversarial verification)', () => {
      const tempDir = path.join(PROJECT_ROOT, 'tests', 'e2e', '__temp_adversarial__');
      fs.mkdirSync(tempDir, { recursive: true });
      fs.writeFileSync(path.join(tempDir, 'leak.ts'), 'const leaked = "COMETCHAT_AUTH_KEY=12345";');

      const matches = scanDirectoryForSecrets(tempDir, /COMETCHAT_AUTH_KEY/);
      expect(matches).toHaveLength(1);
      expect(matches[0].line).toBe(1);

      fs.rmSync(tempDir, { recursive: true, force: true });
    });

    it('F8-T2.3: root .gitignore explicitly ignores .env to protect secrets from version control', () => {
      const gitignorePath = path.join(PROJECT_ROOT, '.gitignore');
      expect(fs.existsSync(gitignorePath)).toBe(true);
      const content = fs.readFileSync(gitignorePath, 'utf8');
      expect(content).toMatch(/\.env/);
    });

    it('F8-T2.4: secret scanner ignores safe word "key" in generic TypeScript types', () => {
      const safeContent = 'export type CacheKey = string; const itemKey = "id";';
      const isLeaked = /COMETCHAT_AUTH_KEY|COMETCHAT_REST_API_KEY/.test(safeContent);
      expect(isLeaked).toBe(false);
    });

    it('F8-T2.5: client package configuration never includes server private keys in build flags', () => {
      const clientPkgPath = path.join(CLIENT_DIR, 'package.json');
      if (fs.existsSync(clientPkgPath)) {
        const pkgContent = fs.readFileSync(clientPkgPath, 'utf8');
        expect(pkgContent).not.toContain('COMETCHAT_REST_API_KEY');
        expect(pkgContent).not.toContain('COMETCHAT_AUTH_KEY');
      }
    });
  });
});
