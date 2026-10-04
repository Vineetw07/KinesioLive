import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { scanDirectoryForSecrets, PROJECT_ROOT, CLIENT_DIR } from './helpers/specHarness.js';

const distAssetsPath = path.join(CLIENT_DIR, 'dist', 'assets');
const distExists = existsSync(distAssetsPath);

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
