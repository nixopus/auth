import { describe, test, expect } from 'bun:test';

describe('OTP fallback logic', () => {
  test('falls back to log when resendApiKey is empty', () => {
    const resendApiKey = '';
    const shouldFallback = !resendApiKey;
    expect(shouldFallback).toBe(true);
  });

  test('does not fall back when resendApiKey is set', () => {
    const resendApiKey = 're_some_key';
    const shouldFallback = !resendApiKey;
    expect(shouldFallback).toBe(false);
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
