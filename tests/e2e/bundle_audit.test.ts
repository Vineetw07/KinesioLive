import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { scanDirectoryForSecrets, PROJECT_ROOT, CLIENT_DIR } from './helpers/specHarness.js';

const distAssetsPath = path.join(CLIENT_DIR, 'dist', 'assets');
const distExists = existsSync(distAssetsPath);

describe('Bundle Configuration & Build Pipeline Audit', () => {
  it('client/package.json declares build script strictly as "vite build" to prevent tsc -b artifact pollution in client/src', () => {
    const pkgPath = path.join(CLIENT_DIR, 'package.json');
    expect(existsSync(pkgPath)).toBe(true);
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
    expect(pkg.scripts?.build).toBe('vite build');
  });

  it('client/dist/assets exists and contains compiled production JS modules for audit', () => {
    expect(existsSync(distAssetsPath)).toBe(true);
    const jsFiles = readdirSync(distAssetsPath).filter(f => f.endsWith('.js'));
    expect(jsFiles.length).toBeGreaterThan(0);
  });
});

describe.skipIf(!distExists)('Bundle Secret Audit — client/dist/assets/*.js', () => {
  it('bundle contains no literal COMETCHAT_AUTH_KEY variable name', () => {
    // Checks the variable name — always falsifiable regardless of env
    const matches = scanDirectoryForSecrets(distAssetsPath, /COMETCHAT_AUTH_KEY/);
    expect(matches).toHaveLength(0);
  });

  it('bundle contains no literal COMETCHAT_REST_API_KEY variable name', () => {
    const matches = scanDirectoryForSecrets(distAssetsPath, /COMETCHAT_REST_API_KEY/);
    expect(matches).toHaveLength(0);
  });

  it('bundle contains no "apikey:" REST header pattern', () => {
    // The server REST calls use lowercase `apikey: apiKey` as a header — must never appear client-side.
    // Case-sensitive check ensures internal Calls SDK camelCase properties (e.g. `rtcApiKey:`, `apiKey:`) are not false positives.
    const matches = scanDirectoryForSecrets(distAssetsPath, /\bapikey\s*:/);
    expect(matches).toHaveLength(0);
  });

  it('bundle contains no actual COMETCHAT_AUTH_KEY value (when available in env)', () => {
    const keyValue = process.env.COMETCHAT_AUTH_KEY;
    if (!keyValue || keyValue.endsWith('...')) return; // Skip if placeholder or unset
    const pattern = new RegExp(keyValue.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const matches = scanDirectoryForSecrets(distAssetsPath, pattern);
    expect(matches).toHaveLength(0);
  });
});
