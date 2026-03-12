import { eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { db } from '../db/index.js';
import * as schema from '../db/schema.js';
import { config } from '../config.js';
import { logger } from '../logger.js';

async function createSSHKeyEntry(organizationId: string, userEmail: string): Promise<void> {
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
}

async function loadSSHCredentials(userId: string, organizationId: string, userEmail: string): Promise<void> {
  if (!config.selfHosted) return;

  if (config.sshHost && config.sshPrivateKey) {
    await createSSHKeyEntry(organizationId, userEmail);
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

    await loadSSHCredentials(user.id, orgId, user.email);
  } catch (error) {
    logger.error({ err: error, email: user.email }, 'failed to create default organization');
  }
}
