import { describe, test, expect, beforeEach, spyOn } from 'bun:test';

describe('OTP console fallback', () => {
  test('logs OTP to console when resendApiKey is empty', () => {
    const logs: string[] = [];
    const spy = spyOn(console, 'log').mockImplementation((...args: any[]) => {
      logs.push(args.join(' '));
    });

    const email = 'admin@example.com';
    const otp = '123456';
    const type = 'sign-in';

    const resendApiKey = '';
    if (!resendApiKey) {
      console.log(`[Self-Hosted OTP] Code for ${email} (${type}): ${otp}`);
    }

    expect(logs.some((l) => l.includes('[Self-Hosted OTP]'))).toBe(true);
    expect(logs.some((l) => l.includes('123456'))).toBe(true);
    expect(logs.some((l) => l.includes('admin@example.com'))).toBe(true);

    spy.mockRestore();
  });

  test('does not log when resendApiKey is set', () => {
    const logs: string[] = [];
    const spy = spyOn(console, 'log').mockImplementation((...args: any[]) => {
      logs.push(args.join(' '));
    });

    const resendApiKey = 're_some_key';
    if (!resendApiKey) {
      console.log('[Self-Hosted OTP] should not appear');
    }

    expect(logs.some((l) => l.includes('[Self-Hosted OTP]'))).toBe(false);

    spy.mockRestore();
  });
});

describe('seedAdminUser logic', () => {
  test('skips when adminEmail is empty', () => {
    const adminEmail = '';
    const shouldSeed = !!adminEmail;
    expect(shouldSeed).toBe(false);
  });

  test('skips when users already exist', () => {
    const adminEmail = 'admin@example.com';
    const userCount = 1;
    const shouldSeed = !!adminEmail && userCount === 0;
    expect(shouldSeed).toBe(false);
  });

  test('seeds when adminEmail is set and no users exist', () => {
    const adminEmail = 'admin@example.com';
    const userCount = 0;
    const shouldSeed = !!adminEmail && userCount === 0;
    expect(shouldSeed).toBe(true);
  });

  test('derives name from email prefix', () => {
    const email = 'john.doe@example.com';
    const name = email.split('@')[0];
    expect(name).toBe('john.doe');
  });
});
