/**
 * Environment & Credential Validation Gate for KinesioLive
 * Prevents runtime 401s and silent mock token fallbacks caused by missing or truncated (.env) keys.
 */

import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure .env is loaded if executed directly
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config();

export interface EnvValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export function validateEnvironment(env: Record<string, string | undefined> = process.env): EnvValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const appId = env.COMETCHAT_APP_ID?.trim();
  const region = env.COMETCHAT_REGION?.trim();
  const authKey = env.COMETCHAT_AUTH_KEY?.trim();
  const restApiKey = env.COMETCHAT_REST_API_KEY?.trim();

  // 1. App ID Check
  if (!appId) {
    errors.push('COMETCHAT_APP_ID is missing or empty.');
  } else if (appId.includes('your_') || appId.includes('placeholder')) {
    errors.push(`COMETCHAT_APP_ID contains placeholder value: "${appId}"`);
  }

  // 2. Region Check
  if (!region) {
    errors.push('COMETCHAT_REGION is missing or empty.');
  } else if (region.includes('your_') || region.includes('placeholder')) {
    errors.push(`COMETCHAT_REGION contains placeholder value: "${region}"`);
  }

  // 3. API Key Check (either AUTH_KEY or REST_API_KEY must be valid)
  const activeKey = restApiKey || authKey;
  if (!activeKey) {
    errors.push('Neither COMETCHAT_REST_API_KEY nor COMETCHAT_AUTH_KEY is provided.');
  } else {
    if (activeKey.endsWith('...')) {
      errors.push(
        'CometChat key ends with trailing ellipsis ("..."). The secret was truncated during copy-paste. Please update .env with the full key from your CometChat dashboard.'
      );
    }
    if (activeKey.length < 20) {
      warnings.push(`CometChat key is unusually short (${activeKey.length} chars). Verify key validity.`);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

export function assertValidEnvironment(env: Record<string, string | undefined> = process.env): void {
  const result = validateEnvironment(env);

  if (result.warnings.length > 0) {
    result.warnings.forEach(w => console.warn(`[ENV WARNING] ${w}`));
  }

  if (!result.isValid) {
    const errorMsg = [
      '=================================================================',
      ' ❌ FATAL CONFIGURATION ERROR: INVALID ENVIRONMENT VARIABLES',
      '=================================================================',
      ...result.errors.map(err => ` • ${err}`),
      '================================================================='
    ].join('\n');

    throw new Error(errorMsg);
  }
}

// Allow standalone execution via `node server/src/config/envValidator.ts` or `pnpm check:env`
if (process.argv[1] && process.argv[1].endsWith('envValidator.ts')) {
  const result = validateEnvironment();
  if (result.isValid) {
    console.log('✅ [OK] Environment variables are valid and complete.');
    process.exit(0);
  } else {
    console.error('❌ [ERROR] Environment validation failed:');
    result.errors.forEach(e => console.error(`  - ${e}`));
    process.exit(1);
  }
}
