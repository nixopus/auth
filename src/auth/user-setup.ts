import { eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { db } from '../db/index.js';
import * as schema from '../db/schema.js';
import { config } from '../config.js';
import { logger } from '../logger.js';
import { creditInternalWallet, creditDodoWelcomeBonus } from './billing.js';

const WELCOME_BONUS_CENTS = 500;
const DODO_CREDIT_DELAY_MS = 3000;
const DEFAULT_MACHINE_TIER = 'machine_1';

async function createSSHKeyEntry(organizationId: string, userEmail: string): Promise<string> {
  const authMethod = config.sshPassword ? 'password' : 'key';
  const sshKeyId = randomUUID();

  await db.insert(schema.sshKeys).values({
    id: sshKeyId,
    organizationId,
    name: 'Default SSH Key',
    description: 'SSH key generated during installer',
    host: config.sshHost,
    user: config.sshUser,
    port: config.sshPort,
    privateKeyEncrypted: config.sshPrivateKey,
    passwordEncrypted: config.sshPassword || null,
    authMethod,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  logger.info({ sshKeyId, organizationId, userEmail, authMethod }, 'created SSH key entry');
  return sshKeyId;
}

async function createMachineBillingEntry(organizationId: string, sshKeyId: string | null): Promise<void> {
  try {
    const plans = await db
      .select({ id: schema.machinePlans.id })
      .from(schema.machinePlans)
      .where(eq(schema.machinePlans.tier, DEFAULT_MACHINE_TIER))
      .limit(1);

    if (plans.length === 0) {
      logger.warn({ organizationId }, 'no default machine plan found, skipping billing entry');
      return;
    }

    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setMonth(periodEnd.getMonth() + 1);

    await db.insert(schema.orgMachineBilling).values({
      organizationId,
      sshKeyId,
      machinePlanId: plans[0].id,
      status: 'active',
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
      lastChargedAt: now,
      createdAt: now,
      updatedAt: now,
    });

    logger.info({ organizationId, sshKeyId, tier: DEFAULT_MACHINE_TIER }, 'created machine billing entry');
  } catch (err) {
    logger.error({ err, organizationId, sshKeyId }, 'failed to create machine billing entry');
  }
}

async function loadSSHCredentials(userId: string, organizationId: string, userEmail: string): Promise<void> {
  if (!config.selfHosted) return;

  if (config.sshHost && config.sshPrivateKey) {
    const sshKeyId = await createSSHKeyEntry(organizationId, userEmail);
    await createMachineBillingEntry(organizationId, sshKeyId);
  } else {
    logger.warn({ userEmail }, 'SSH credentials not available in environment');
  }
}

export async function setupNewUser(user: { id: string; email: string; name: string | null }): Promise<void> {
  logger.debug({ userId: user.id, email: user.email, name: user.name }, 'setting up new user');

  if (!user.name || user.name.trim().length === 0) {
    const fallbackName = user.email.split('@')[0];
    await db.update(schema.user)
      .set({ name: fallbackName })
      .where(eq(schema.user.id, user.id));
    user.name = fallbackName;
    logger.debug({ userId: user.id, fallbackName }, 'user name was empty, set fallback');
  }

  try {
    const userName = user.name || user.email.split('@')[0];
    const baseSlug = userName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const uuidSuffix = randomUUID().replace(/-/g, '').substring(0, 8);
    const slug = `${baseSlug}-${uuidSuffix}`;

    const orgId = randomUUID();
    const orgName = `${userName}'s Team`;

    await db.transaction(async (tx) => {
      await tx.insert(schema.organization).values({
        id: orgId,
        name: orgName,
        slug,
        createdAt: new Date(),
        metadata: JSON.stringify({ description: 'Default organization' }),
      });

      const memberId = randomUUID();
      await tx.insert(schema.member).values({
        id: memberId,
        organizationId: orgId,
        userId: user.id,
        role: 'owner',
        createdAt: new Date(),
      });
    });

    logger.info({ orgId, orgName, email: user.email }, 'created default organization');

    try {
      const credited = await creditInternalWallet(
        orgId,
        WELCOME_BONUS_CENTS,
        'Welcome bonus - $5 promotional balance',
        `welcome_bonus_${user.id}`,
      );
      if (credited) {
        logger.info({ orgId, userId: user.id, amountCents: WELCOME_BONUS_CENTS }, 'welcome bonus credited');
      } else {
        logger.warn({ orgId, userId: user.id }, 'welcome bonus skipped (duplicate or failed)');
      }
    } catch (creditErr) {
      logger.error({ err: creditErr, orgId, userId: user.id }, 'welcome bonus credit failed');
    }

    setTimeout(() => {
      creditDodoWelcomeBonus(
        user.email,
        WELCOME_BONUS_CENTS,
        `welcome_bonus_${user.id}`,
      ).catch((err) => {
        logger.warn({ err, email: user.email }, 'Dodo welcome bonus failed');
      });
    }, DODO_CREDIT_DELAY_MS);

    await loadSSHCredentials(user.id, orgId, user.email);
  } catch (error) {
    logger.error({ err: error, email: user.email }, 'failed to create default organization');
  }
}
