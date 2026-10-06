import { describe, it, expect } from 'vitest';
import { validateEnvironment, assertValidEnvironment } from '../server/src/config/envValidator.js';

describe('Environment Validator Suite', () => {
  it('passes on valid credentials', () => {
    const res = validateEnvironment({
      COMETCHAT_APP_ID: 'valid_app_id_123',
      COMETCHAT_REGION: 'in',
      COMETCHAT_AUTH_KEY: '1234567890abcdef1234567890abcdef'
    });

    expect(res.isValid).toBe(true);
    expect(res.errors).toHaveLength(0);
  });

  it('rejects keys with trailing ellipsis', () => {
    const res = validateEnvironment({
      COMETCHAT_APP_ID: 'valid_app_id_123',
      COMETCHAT_REGION: 'in',
      COMETCHAT_AUTH_KEY: '1234567890abcdef...'
    });

    expect(res.isValid).toBe(false);
    expect(res.errors.some(e => e.includes('trailing ellipsis'))).toBe(true);
  });

  it('rejects missing COMETCHAT_APP_ID', () => {
    const res = validateEnvironment({
      COMETCHAT_REGION: 'in',
      COMETCHAT_AUTH_KEY: '1234567890abcdef1234567890abcdef'
    });

    expect(res.isValid).toBe(false);
    expect(res.errors.some(e => e.includes('COMETCHAT_APP_ID'))).toBe(true);
  });

  it('rejects missing COMETCHAT_REGION', () => {
    const res = validateEnvironment({
      COMETCHAT_APP_ID: 'valid_app_id_123',
      COMETCHAT_AUTH_KEY: '1234567890abcdef1234567890abcdef'
    });

    expect(res.isValid).toBe(false);
    expect(res.errors.some(e => e.includes('COMETCHAT_REGION'))).toBe(true);
  });

  it('throws on assertValidEnvironment when invalid', () => {
    expect(() => {
      assertValidEnvironment({
        COMETCHAT_APP_ID: '',
        COMETCHAT_REGION: '',
        COMETCHAT_AUTH_KEY: ''
      });
    }).toThrow(/FATAL CONFIGURATION ERROR/);
  });
});
