import { APIError } from 'better-auth/api';
import { logger } from '../logger.js';

export type GetUserCountFn = () => Promise<number>;

let userExistsCache: boolean | null = null;

export function resetUserExistsCache(): void {
  userExistsCache = null;
}

export async function hasExistingUsers(getUserCount: GetUserCountFn): Promise<boolean> {
  if (userExistsCache === true) return true;
  const count = await getUserCount();
  userExistsCache = count > 0;
  return userExistsCache;
}

export async function assertRegistrationAllowed(
  selfHosted: boolean,
  getUserCount: GetUserCountFn,
): Promise<void> {
  if (!selfHosted) return;
  const exists = await hasExistingUsers(getUserCount);
  if (exists) {
    logger.warn('registration blocked: self-hosted instance already has a user');
    throw new APIError('FORBIDDEN', { message: 'Registration is disabled' });
  }
}

export function assertInvitationsAllowed(selfHosted: boolean): void {
  if (!selfHosted) return;
  logger.warn('invitation blocked: disabled in self-hosted mode');
  throw new APIError('FORBIDDEN', { message: 'Invitations are disabled in self-hosted mode' });
}
