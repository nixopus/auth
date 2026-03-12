import { eq, desc, and, sql } from 'drizzle-orm';
import DodoPayments from 'dodopayments';
import { db } from '../db/index.js';
import * as schema from '../db/schema.js';
import { config } from '../config.js';
import { logger } from '../logger.js';
import { resolveOrgId, getUserIdFromEmail } from './queries.js';

export const dodoPayments = config.dodoPaymentsApiKey
  ? new DodoPayments({
      bearerToken: config.dodoPaymentsApiKey,
      environment: config.dodoPaymentsEnvironment,
    })
  : null;

export const PLAN_CREDIT_ALLOCATIONS_CENTS: Record<string, number> = {
  free: 100,
  pro: 1000,
  team: 5000,
};

const PLAN_RESOURCE_MAP: Record<string, { vcpu: number; memoryMB: number }> = {
  free: { vcpu: 1, memoryMB: 1024 },
  pro: { vcpu: 2, memoryMB: 2048 },
};

const AUTO_TOPUP_COOLDOWN_MS = 60_000;

export function getPlanTier(productId: string, metadata: Record<string, any> | null): string {
  if (metadata?.plan && typeof metadata.plan === 'string') {
    return metadata.plan;
  }
  if (config.dodoPaymentsProductId && productId === config.dodoPaymentsProductId) {
    return config.dodoPaymentsProductSlug.replace(/-plan$/, '');
  }
  return 'free';
}

export async function getWalletBalance(orgId: string): Promise<number> {
  const lastTx = await db
    .select({ balanceAfterCents: schema.walletTransactions.balanceAfterCents })
    .from(schema.walletTransactions)
    .where(eq(schema.walletTransactions.organizationId, orgId))
    .orderBy(desc(schema.walletTransactions.createdAt))
    .limit(1);
  return lastTx[0]?.balanceAfterCents ?? 0;
}

export async function creditInternalWallet(
  orgId: string,
  amountCents: number,
  reason: string,
  referenceId: string,
): Promise<boolean> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${orgId}))`);

    const existing = await tx
      .select({ id: schema.walletTransactions.id })
      .from(schema.walletTransactions)
      .where(eq(schema.walletTransactions.referenceId, referenceId))
      .limit(1);
    if (existing.length > 0) return false;

    const lastTx = await tx
      .select({ balanceAfterCents: schema.walletTransactions.balanceAfterCents })
      .from(schema.walletTransactions)
      .where(eq(schema.walletTransactions.organizationId, orgId))
      .orderBy(desc(schema.walletTransactions.createdAt))
      .limit(1);
    const currentBalance = lastTx[0]?.balanceAfterCents ?? 0;

    await tx.insert(schema.walletTransactions).values({
      organizationId: orgId,
      amountCents,
      entryType: 'credit',
      balanceAfterCents: currentBalance + amountCents,
      reason,
      referenceId,
    });
    return true;
  });
}

export async function grantPlanCredits(email: string, amountCents: number, referenceId: string): Promise<void> {
  const orgId = await resolveOrgId(email);
  if (!orgId) {
    logger.error({ email }, 'grantPlanCredits: no organization found');
    return;
  }
  await creditInternalWallet(orgId, amountCents, 'Plan credit allocation', `plan_grant_${referenceId}`);
}

export async function addPurchasedCredits(email: string, amountCents: number, referenceId: string): Promise<void> {
  const orgId = await resolveOrgId(email);
  if (!orgId) {
    logger.error({ email }, 'addPurchasedCredits: no organization found');
    return;
  }
  await creditInternalWallet(orgId, amountCents, 'Credit top-up', `topup_${referenceId}`);
}

export async function triggerResourceUpgrade(email: string, planTier: string): Promise<void> {
  const resources = PLAN_RESOURCE_MAP[planTier] ?? PLAN_RESOURCE_MAP.free;

  const userId = await getUserIdFromEmail(email);
  if (!userId) {
    logger.error({ email }, 'triggerResourceUpgrade: no user found');
    return;
  }

  const orgId = await resolveOrgId(email);
  if (!orgId) {
    logger.error({ email }, 'triggerResourceUpgrade: no org found');
    return;
  }

  const resp = await fetch(`${config.nixopusApiUrl}/api/v1/trail/upgrade-resources`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Internal-Secret': config.betterAuthSecret,
    },
    body: JSON.stringify({
      user_id: userId,
      org_id: orgId,
      vcpu_count: resources.vcpu,
      memory_mb: resources.memoryMB,
    }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    logger.error({ status: resp.status, body: text }, 'triggerResourceUpgrade failed');
    return;
  }

  logger.info({ userId, planTier, vcpu: resources.vcpu, memoryMB: resources.memoryMB }, 'resource upgrade triggered');
}

export async function getDodoCustomerId(email: string): Promise<string | null> {
  if (!dodoPayments) return null;
  try {
    const customers = await dodoPayments.customers.list({ email });
    const items = (customers as any)?.items ?? customers;
    const customer = Array.isArray(items) ? items[0] : null;
    return customer?.customer_id ?? null;
  } catch {
    return null;
  }
}

export async function verifyAndCreditPendingPayments(email: string, orgId: string): Promise<boolean> {
  if (!dodoPayments) return false;

  const customerId = await getDodoCustomerId(email);
  if (!customerId) return false;

  const payments = await dodoPayments.payments.list({ customer_id: customerId });
  const paymentItems = (payments as any)?.items ?? payments;
  if (!Array.isArray(paymentItems)) return false;

  let credited = false;
  for (const payment of paymentItems) {
    if (payment.status !== 'succeeded' || payment.subscription_id) continue;

    const amountCents = payment.metadata?.amount_cents
      ? Number(payment.metadata.amount_cents)
      : payment.total_amount;
    if (!amountCents || amountCents <= 0) continue;

    try {
      const wasCredited = await creditInternalWallet(
        orgId, amountCents, 'Credit top-up', `topup_${payment.payment_id}`,
      );
      if (wasCredited) {
        credited = true;
        logger.info({ email, amountCents, paymentId: payment.payment_id }, 'verified and credited internal wallet');
      }
    } catch (err) {
      logger.error({ err, paymentId: payment.payment_id }, 'failed to credit wallet during verification');
    }
  }

  return credited;
}

async function reconcileSubscriptionPayments(
  orgId: string,
  subscriptionId: string,
  configuredAmountCents: number,
): Promise<number> {
  if (!dodoPayments) return 0;
  let reconciled = 0;
  try {
    const payments = await dodoPayments.payments.list({
      subscription_id: subscriptionId,
      status: 'succeeded',
      page_size: 10,
    });

    for (const payment of payments.items ?? []) {
      const creditAmount = payment.total_amount > 0 ? payment.total_amount : configuredAmountCents;
      const wasCredited = await creditInternalWallet(
        orgId, creditAmount, 'Auto top-up (reconciled)', `auto_topup_${payment.payment_id}`,
      );
      if (wasCredited) {
        reconciled++;
        logger.info({ orgId, paymentId: payment.payment_id, amount: creditAmount }, 'reconciled missed auto top-up payment');
      }
    }
  } catch (err) {
    logger.warn({ err, orgId }, 'auto top-up reconciliation check failed');
  }
  return reconciled;
}

export async function processAutoTopUpForOrg(
  row: typeof schema.autoTopupSettings.$inferSelect,
): Promise<{ status: 'charged' | 'skipped' | 'reconciled'; reconciled: number }> {
  if (!row.subscriptionId || !dodoPayments) return { status: 'skipped', reconciled: 0 };

  const now = Date.now();
  if (row.lastTriggeredAt && now - row.lastTriggeredAt.getTime() < AUTO_TOPUP_COOLDOWN_MS) {
    return { status: 'skipped', reconciled: 0 };
  }

  const balance = await getWalletBalance(row.organizationId);
  if (balance >= row.thresholdCents) return { status: 'skipped', reconciled: 0 };

  try {
    const result = await dodoPayments.subscriptions.charge(row.subscriptionId, {
      product_price: row.amountCents,
    });

    const paymentId = (result as any).payment_id;
    const refId = `auto_topup_${paymentId ?? Date.now()}`;

    await creditInternalWallet(row.organizationId, row.amountCents, 'Auto top-up', refId);

    await db
      .update(schema.autoTopupSettings)
      .set({ lastTriggeredAt: new Date(), updatedAt: new Date() })
      .where(eq(schema.autoTopupSettings.organizationId, row.organizationId));

    logger.info({ orgId: row.organizationId, amountCents: row.amountCents, paymentId }, 'auto top-up charge succeeded');
    return { status: 'charged', reconciled: 0 };
  } catch (err: any) {
    const isPending = err?.status === 409 || err?.error?.code === 'PREVIOUS_PAYMENT_PENDING';
    if (isPending) {
      const reconciledCount = await reconcileSubscriptionPayments(
        row.organizationId, row.subscriptionId, row.amountCents,
      );
      await db
        .update(schema.autoTopupSettings)
        .set({ lastTriggeredAt: new Date(), updatedAt: new Date() })
        .where(eq(schema.autoTopupSettings.organizationId, row.organizationId));
      logger.info({ orgId: row.organizationId, reconciled: reconciledCount }, 'auto top-up: pending payment, reconciled');
      return { status: reconciledCount > 0 ? 'reconciled' : 'skipped', reconciled: reconciledCount };
    }
    logger.error({ err, orgId: row.organizationId }, 'auto top-up charge failed');
    return { status: 'skipped', reconciled: 0 };
  }
}

export async function runAutoTopupSweep(orgIdFilter?: string): Promise<{
  processed: number; charged: number; skipped: number; reconciled: number;
}> {
  const conditions = [eq(schema.autoTopupSettings.enabled, true)];
  if (orgIdFilter) {
    conditions.push(eq(schema.autoTopupSettings.organizationId, orgIdFilter));
  }

  const enabledSettings = await db
    .select()
    .from(schema.autoTopupSettings)
    .where(and(...conditions));

  let processed = 0;
  let charged = 0;
  let skipped = 0;
  let reconciled = 0;

  for (const row of enabledSettings) {
    processed++;
    const result = await processAutoTopUpForOrg(row);
    if (result.status === 'charged') charged++;
    else skipped++;
    reconciled += result.reconciled;
  }

  return { processed, charged, skipped, reconciled };
}
