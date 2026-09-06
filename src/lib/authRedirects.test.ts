import { afterEach, describe, expect, it, vi } from 'vitest';
import { getAppOrigin, getPasswordResetRedirectUrl } from './authRedirects';

const originalEnv = process.env;

afterEach(() => {
  vi.unstubAllEnvs();
  process.env = originalEnv;
});

describe('auth redirect URLs', () => {
  it('uses the configured production app URL before the browser origin', () => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://smc-ledger.vercel.app/');

    expect(getPasswordResetRedirectUrl('http://localhost:3000')).toBe(
      'https://smc-ledger.vercel.app/reset-password'
    );
  });

  it('falls back to the browser origin when no canonical app URL is configured', () => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', '');
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', '');

    expect(getPasswordResetRedirectUrl('https://preview.example.com')).toBe(
      'https://preview.example.com/reset-password'
    );
  });

  it('ignores invalid configured URLs', () => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'javascript:alert(1)');
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://smc-ledger.vercel.app');

    expect(getAppOrigin('http://localhost:3000')).toBe('https://smc-ledger.vercel.app');
  });
});
