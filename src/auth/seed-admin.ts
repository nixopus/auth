import { randomUUID } from 'crypto';
import { db } from '../db/index.js';
import { config } from '../config.js';
import * as schema from '../db/schema.js';
import { sql } from 'drizzle-orm';
import { setupNewUser } from './index.js';

export async function seedAdminUser(): Promise<void> {
  if (!config.adminEmail) return;

  const [row] = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.user)
    .limit(1);

  if ((row?.count ?? 0) > 0) return;

  const userId = randomUUID();
  const name = config.adminEmail.split('@')[0];

  await db.insert(schema.user).values({
    id: userId,
    name,
    email: config.adminEmail,
    emailVerified: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  await setupNewUser({ id: userId, email: config.adminEmail, name });

  console.log(`[Seed] Admin user created: ${config.adminEmail}`);
}
