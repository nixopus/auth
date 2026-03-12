import { eq, and } from 'drizzle-orm';
import { db } from '../db/index.js';
import * as schema from '../db/schema.js';
import { logger } from '../logger.js';
import { resolveOrgId } from './queries.js';
import {
  getPlanTier,
  PLAN_CREDIT_ALLOCATIONS_CENTS,
  grantPlanCredits,
  addPurchasedCredits,
  creditInternalWallet,
  triggerResourceUpgrade,
} from './billing.js';

async function handleSubscriptionCredits(payload: any): Promise<void> {
  const email = payload.data.customer.email;
  const tier = getPlanTier(payload.data.product_id, payload.data.metadata);
  const amountCents = PLAN_CREDIT_ALLOCATIONS_CENTS[tier] ?? PLAN_CREDIT_ALLOCATIONS_CENTS.free;
  await grantPlanCredits(email, amountCents, payload.data.subscription_id);
  logger.info({ email, amountCents, tier }, 'granted plan credits to wallet');

  if (payload.type === 'subscription.active' || payload.type === 'subscription.plan_changed') {
    await triggerResourceUpgrade(email, tier);
  }
}

async function handlePaymentSucceeded(payload: any): Promise<void> {
  const subId = payload.data.subscription_id;
  if (subId) {
    const autoTopup = await db
      .select({ organizationId: schema.autoTopupSettings.organizationId })
      .from(schema.autoTopupSettings)
      .where(and(
        eq(schema.autoTopupSettings.subscriptionId, subId),
        eq(schema.autoTopupSettings.enabled, true),
      ))
      .limit(1);

    if (autoTopup.length > 0) {
      const orgId = autoTopup[0].organizationId;
      const amountCents = payload.data.total_amount;
      const refId = `auto_topup_${payload.data.payment_id}`;
      await creditInternalWallet(orgId, amountCents, 'Auto top-up', refId);
      logger.info({ orgId, amountCents, paymentId: payload.data.payment_id }, 'credited auto top-up via webhook');
      return;
    }
  }

  const email = payload.data.customer.email;
  const amountCents = payload.data.metadata?.amount_cents
    ? Number(payload.data.metadata.amount_cents)
    : payload.data.total_amount;
  await addPurchasedCredits(email, amountCents, payload.data.payment_id);
  logger.info({ email, amountCents }, 'added purchased credits to wallet');
}

async function handleAutoTopupActivation(payload: any): Promise<void> {
  const subData = payload.data;
  if (subData.metadata?.auto_topup !== 'true') return;

  const email = subData.customer.email;
  const orgId = await resolveOrgId(email);
  if (!orgId) return;

  const thresholdCents = Number(subData.metadata.threshold_cents || 200);
  const topupAmountCents = Number(subData.metadata.amount_cents || 1000);

  await db
    .insert(schema.autoTopupSettings)
    .values({
      organizationId: orgId,
      enabled: true,
      thresholdCents,
      amountCents: topupAmountCents,
      subscriptionId: subData.subscription_id,
    })
    .onConflictDoUpdate({
      target: schema.autoTopupSettings.organizationId,
      set: {
        enabled: true,
        thresholdCents,
        amountCents: topupAmountCents,
        subscriptionId: subData.subscription_id,
        updatedAt: new Date(),
      },
    });

  logger.info({ email, subscriptionId: subData.subscription_id }, 'auto top-up mandate activated');
}

export async function handleWebhookPayload(payload: any): Promise<void> {
  logger.info({ webhookType: payload.type }, 'received dodo payments webhook');

  const isSubscriptionCredit =
    payload.type === 'subscription.active' ||
    payload.type === 'subscription.renewed' ||
    payload.type === 'subscription.plan_changed';

  if (isSubscriptionCredit) {
    try {
      await handleSubscriptionCredits(payload);
    } catch (error) {
      logger.error({ err: error }, 'failed to grant plan credits');
    }
  }

  if (payload.type === 'payment.succeeded') {
    try {
      await handlePaymentSucceeded(payload);
    } catch (error) {
      logger.error({ err: error }, 'failed to add purchased credits');
    }
  }

  if (payload.type === 'subscription.cancelled') {
    logger.info({ email: payload.data.customer.email }, 'subscription cancelled');
  }

  if (payload.type === 'subscription.active') {
    try {
      await handleAutoTopupActivation(payload);
    } catch (error) {
      logger.error({ err: error }, 'failed to activate auto top-up');
    }
  }
}
