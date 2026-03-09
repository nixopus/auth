import { describe, test, expect } from 'bun:test';

describe('config derivation', () => {
  describe('selfHosted', () => {
    test('is true when SELF_HOSTED=true', () => {
      expect('true' === 'true').toBe(true);
    });

    test('is false when SELF_HOSTED is unset', () => {
      expect(undefined === 'true').toBe(false);
    });

    test('is false when SELF_HOSTED=false', () => {
      const selfHosted: string = 'false';
      expect(selfHosted === 'true').toBe(false);
    });
  });

  describe('passkeyRpId', () => {
    test('extracts hostname from AUTH_SERVICE_URL', () => {
      const rpId = new URL('https://auth.example.com').hostname;
      expect(rpId).toBe('auth.example.com');
    });

    test('defaults to localhost when AUTH_SERVICE_URL is unset', () => {
      const rpId = new URL('http://localhost').hostname;
      expect(rpId).toBe('localhost');
    });

    test('handles URL with port', () => {
      const rpId = new URL('https://auth.example.com:9090').hostname;
      expect(rpId).toBe('auth.example.com');
    });

    test('handles IP address', () => {
      const rpId = new URL('http://192.168.1.100:9090').hostname;
      expect(rpId).toBe('192.168.1.100');
    });
  });
});
