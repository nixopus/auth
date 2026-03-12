import { eq, and, asc, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import * as schema from '../db/schema.js';
import { logger } from '../logger.js';
import type { GetUserCountFn } from './self-hosted-guard.js';

export const getUserCount: GetUserCountFn = async () => {
  const [row] = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.user)
    .limit(1);
  return row?.count ?? 0;
};

export async function isNewUserEmail(email: string): Promise<boolean> {
  const rows = await db
    .select({ id: schema.user.id })
    .from(schema.user)
    .where(eq(schema.user.email, email))
    .limit(1);
  return rows.length === 0;
}

export async function getUserIdFromEmail(email: string): Promise<string | null> {
  const rows = await db
    .select({ id: schema.user.id })
    .from(schema.user)
    .where(eq(schema.user.email, email))
    .limit(1);
  return rows[0]?.id ?? null;
}

export async function resolveOrgId(email: string): Promise<string | null> {
  const rows = await db
    .select({ id: schema.organization.id })
    .from(schema.organization)
    .innerJoin(schema.member, eq(schema.member.organizationId, schema.organization.id))
    .innerJoin(schema.user, eq(schema.user.id, schema.member.userId))
    .where(and(eq(schema.user.email, email), eq(schema.member.role, 'owner')))
    .limit(1);
  return rows[0]?.id ?? null;
}

export async function getOwnerOrgIdByUserId(userId: string): Promise<string | null> {
  const rows = await db
    .select({ organizationId: schema.member.organizationId })
    .from(schema.member)
    .where(and(eq(schema.member.userId, userId), eq(schema.member.role, 'owner')))
    .orderBy(asc(schema.member.createdAt))
    .limit(1);
  return rows[0]?.organizationId ?? null;
}

export async function getInitialOrganization(userId: string): Promise<{ id: string } | null> {
  const rows = await db
    .select({ id: schema.organization.id })
    .from(schema.member)
    .innerJoin(schema.organization, eq(schema.member.organizationId, schema.organization.id))
    .where(eq(schema.member.userId, userId))
    .orderBy(asc(schema.member.createdAt))
    .limit(1);
  const org = rows[0] ?? null;
  logger.debug({ userId, organizationId: org?.id ?? null }, 'resolved initial organization');
  return org;
}
