import { describe, test, expect, beforeEach } from 'bun:test';
import {
  hasExistingUsers,
  assertRegistrationAllowed,
  assertInvitationsAllowed,
  resetUserExistsCache,
} from '../auth/self-hosted-guard.js';

describe('hasExistingUsers', () => {
  beforeEach(() => {
    resetUserExistsCache();
  });

  test('returns false when no users exist', async () => {
    const getUserCount = async () => 0;
    expect(await hasExistingUsers(getUserCount)).toBe(false);
  });

  test('returns true when users exist', async () => {
    const getUserCount = async () => 1;
    expect(await hasExistingUsers(getUserCount)).toBe(true);
  });

  test('caches positive result and skips subsequent DB calls', async () => {
    let callCount = 0;
    const getUserCount = async () => {
      callCount++;
      return 1;
    };

    await hasExistingUsers(getUserCount);
    await hasExistingUsers(getUserCount);
    await hasExistingUsers(getUserCount);

    expect(callCount).toBe(1);
  });

  test('does not cache negative result', async () => {
    let callCount = 0;
    let count = 0;
    const getUserCount = async () => {
      callCount++;
      return count;
    };

    expect(await hasExistingUsers(getUserCount)).toBe(false);
    expect(callCount).toBe(1);

    count = 1;
    expect(await hasExistingUsers(getUserCount)).toBe(true);
    expect(callCount).toBe(2);
  });
});

describe('assertRegistrationAllowed', () => {
  beforeEach(() => {
    resetUserExistsCache();
  });

  test('does nothing when selfHosted is false', async () => {
    const getUserCount = async () => 5;
    await assertRegistrationAllowed(false, getUserCount);
  });

  test('allows first user registration in self-hosted mode', async () => {
    const getUserCount = async () => 0;
    await assertRegistrationAllowed(true, getUserCount);
  });

  test('blocks registration when user already exists in self-hosted mode', async () => {
    const getUserCount = async () => 1;
    await expect(
      assertRegistrationAllowed(true, getUserCount),
    ).rejects.toThrow('Registration is disabled');
  });
});

describe('assertInvitationsAllowed', () => {
  test('does nothing when selfHosted is false', () => {
    assertInvitationsAllowed(false);
  });

  test('throws when selfHosted is true', () => {
    expect(() => assertInvitationsAllowed(true)).toThrow(
      'Invitations are disabled in self-hosted mode',
    );
  });
});
