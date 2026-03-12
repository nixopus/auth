import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import * as schema from '../db/schema.js';
import { config } from '../config.js';
import { logger } from '../logger.js';
import { auth } from '../auth/index.js';
import { resolveOrgId } from '../auth/queries.js';
import {
  dodoPayments,
  getDodoCustomerId,
  verifyAndCreditPendingPayments,
  runAutoTopupSweep,
} from '../auth/billing.js';

export const billingRoutes = new Hono();

billingRoutes.post('/checkout', async (c) => {
  try {
    if (!dodoPayments) {
      return c.json({ error: 'Payments not configured' }, 503);
    }

    const session = await auth.api.getSession({ headers: c.req.raw.headers });
    if (!session?.user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const body = await c.req.json();
    const amountDollars = Number(body.amount_dollars);

    if (!Number.isInteger(amountDollars) || amountDollars < config.dodoCreditMinDollars || amountDollars > config.dodoCreditMaxDollars) {
      return c.json({ error: `Amount must be between $${config.dodoCreditMinDollars} and $${config.dodoCreditMaxDollars}` }, 400);
    }

    if (!config.dodoCreditProductId) {
      return c.json({ error: 'Credit product not configured' }, 503);
    }

    const amountCents = amountDollars * 100;

    const checkoutSession = await dodoPayments.checkoutSessions.create({
      product_cart: [{ product_id: config.dodoCreditProductId, quantity: amountDollars }],
      customer: {
        email: session.user.email,
        name: session.user.name || session.user.email.split('@')[0],
      },
      metadata: { amount_cents: String(amountCents) },
      return_url: `${config.corsAllowedOrigins[0]}/billing?checkout=success`,
    });

    return c.json({ checkout_url: checkoutSession.checkout_url });
  } catch (error: any) {
    logger.error({ err: error }, 'credit checkout error');
    return c.json({ error: error.message || 'Failed to create checkout' }, 500);
  }
});

billingRoutes.post('/verify-checkout', async (c) => {
  try {
    if (!dodoPayments) {
      return c.json({ error: 'Payments not configured' }, 503);
    }

    const session = await auth.api.getSession({ headers: c.req.raw.headers });
    if (!session?.user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const email = session.user.email;
    const orgId = await resolveOrgId(email);
    if (!orgId) {
      return c.json({ error: 'No organization found' }, 404);
    }

    const credited = await verifyAndCreditPendingPayments(email, orgId);
    return c.json({ credited });
  } catch (error: any) {
    logger.error({ err: error }, 'verify-checkout error');
    return c.json({ error: error.message || 'Verification failed' }, 500);
  }
});

export const autoTopupRoutes = new Hono();

autoTopupRoutes.get('/', async (c) => {
  try {
    const session = await auth.api.getSession({ headers: c.req.raw.headers });
    if (!session?.user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const orgId = await resolveOrgId(session.user.email);
    if (!orgId) {
      return c.json({ enabled: false, threshold_cents: 200, amount_cents: 1000, has_mandate: false });
    }

    const rows = await db
      .select({
        enabled: schema.autoTopupSettings.enabled,
        thresholdCents: schema.autoTopupSettings.thresholdCents,
        amountCents: schema.autoTopupSettings.amountCents,
        subscriptionId: schema.autoTopupSettings.subscriptionId,
      })
      .from(schema.autoTopupSettings)
      .where(eq(schema.autoTopupSettings.organizationId, orgId))
      .limit(1);

    const row = rows[0];
    if (!row) {
      return c.json({ enabled: false, threshold_cents: 200, amount_cents: 1000, has_mandate: false });
    }

    return c.json({
      enabled: row.enabled,
      threshold_cents: row.thresholdCents,
      amount_cents: row.amountCents,
      has_mandate: !!row.subscriptionId,
    });
  } catch (error: any) {
    logger.error({ err: error }, 'get auto-topup settings error');
    return c.json({ error: error.message || 'Failed to get settings' }, 500);
  }
});

autoTopupRoutes.post('/setup', async (c) => {
  try {
    if (!dodoPayments) {
      return c.json({ error: 'Payments not configured' }, 503);
    }
    if (!config.dodoAutoTopupProductId) {
      return c.json({ error: 'Auto top-up not configured' }, 503);
    }

    const session = await auth.api.getSession({ headers: c.req.raw.headers });
    if (!session?.user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const body = await c.req.json();
    const thresholdCents = Number(body.threshold_cents);
    const amountCents = Number(body.amount_cents);

    if (!Number.isInteger(thresholdCents) || thresholdCents < 100 || thresholdCents > 100000) {
      return c.json({ error: 'Threshold must be between $1 and $1000' }, 400);
    }
    if (!Number.isInteger(amountCents) || amountCents < 100 || amountCents > 100000) {
      return c.json({ error: 'Amount must be between $1 and $1000' }, 400);
    }

    const email = session.user.email;
    const orgId = await resolveOrgId(email);
    if (!orgId) {
      return c.json({ error: 'No organization found' }, 404);
    }

    const existing = await db
      .select({ subscriptionId: schema.autoTopupSettings.subscriptionId })
      .from(schema.autoTopupSettings)
      .where(eq(schema.autoTopupSettings.organizationId, orgId))
      .limit(1);

    if (existing[0]?.subscriptionId) {
      await db
        .update(schema.autoTopupSettings)
        .set({ enabled: true, thresholdCents, amountCents, updatedAt: new Date() })
        .where(eq(schema.autoTopupSettings.organizationId, orgId));
      return c.json({ updated: true });
    }

    await db
      .insert(schema.autoTopupSettings)
      .values({ organizationId: orgId, enabled: false, thresholdCents, amountCents })
      .onConflictDoUpdate({
        target: schema.autoTopupSettings.organizationId,
        set: { thresholdCents, amountCents, updatedAt: new Date() },
      });

    const customerId = await getDodoCustomerId(email);
    const customerRef = customerId
      ? { customer_id: customerId }
      : { email, name: session.user.name || email.split('@')[0] };

    const checkoutSession = await dodoPayments.checkoutSessions.create({
      product_cart: [{ product_id: config.dodoAutoTopupProductId, quantity: 1 }],
      customer: customerRef as any,
      return_url: `${config.corsAllowedOrigins[0]}/billing?auto_topup=success`,
      subscription_data: {
        on_demand: {
          mandate_only: true,
        },
      },
      metadata: {
        auto_topup: 'true',
        threshold_cents: String(thresholdCents),
        amount_cents: String(amountCents),
        organization_id: orgId,
      },
    });

    return c.json({ checkout_url: (checkoutSession as any).checkout_url });
  } catch (error: any) {
    logger.error({ err: error }, 'auto-topup setup error');
    return c.json({ error: error.message || 'Failed to setup auto top-up' }, 500);
  }
});

autoTopupRoutes.post('/disable', async (c) => {
  try {
    const session = await auth.api.getSession({ headers: c.req.raw.headers });
    if (!session?.user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const orgId = await resolveOrgId(session.user.email);
    if (!orgId) {
      return c.json({ error: 'No organization found' }, 404);
    }

    await db
      .update(schema.autoTopupSettings)
      .set({ enabled: false, updatedAt: new Date() })
      .where(eq(schema.autoTopupSettings.organizationId, orgId));

    return c.json({ disabled: true });
  } catch (error: any) {
    logger.error({ err: error }, 'auto-topup disable error');
    return c.json({ error: error.message || 'Failed to disable auto top-up' }, 500);
  }
});

autoTopupRoutes.post('/verify', async (c) => {
  try {
    if (!dodoPayments) {
      return c.json({ error: 'Payments not configured' }, 503);
    }

    const session = await auth.api.getSession({ headers: c.req.raw.headers });
    if (!session?.user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const email = session.user.email;
    const orgId = await resolveOrgId(email);
    if (!orgId) {
      return c.json({ error: 'No organization found' }, 404);
    }

    const existing = await db
      .select({ subscriptionId: schema.autoTopupSettings.subscriptionId })
      .from(schema.autoTopupSettings)
      .where(eq(schema.autoTopupSettings.organizationId, orgId))
      .limit(1);

    if (existing[0]?.subscriptionId) {
      return c.json({ verified: true, already_active: true });
    }

    const customers = await dodoPayments.customers.list({ email });
    const customerItems = (customers as any)?.items ?? customers;
    const customer = Array.isArray(customerItems) ? customerItems[0] : null;

    if (!customer?.customer_id) {
      return c.json({ verified: false, reason: 'no_customer' });
    }

    const subscriptions = await dodoPayments.subscriptions.list({ customer_id: customer.customer_id });
    const subItems = (subscriptions as any)?.items ?? subscriptions;

    if (!Array.isArray(subItems)) {
      return c.json({ verified: false, reason: 'no_subscriptions' });
    }

    const activeSub = subItems.find((s: any) =>
      s.status === 'active' && s.metadata?.auto_topup === 'true'
    );

    if (!activeSub) {
      return c.json({ verified: false, reason: 'no_active_mandate' });
    }

    const settingsRow = await db
      .select({
        thresholdCents: schema.autoTopupSettings.thresholdCents,
        amountCents: schema.autoTopupSettings.amountCents,
      })
      .from(schema.autoTopupSettings)
      .where(eq(schema.autoTopupSettings.organizationId, orgId))
      .limit(1);

    const thresholdCents = Number(activeSub.metadata?.threshold_cents || settingsRow[0]?.thresholdCents || 200);
    const amountCents = Number(activeSub.metadata?.amount_cents || settingsRow[0]?.amountCents || 1000);

    await db
      .insert(schema.autoTopupSettings)
      .values({
        organizationId: orgId,
        enabled: true,
        thresholdCents,
        amountCents,
        subscriptionId: activeSub.subscription_id,
      })
      .onConflictDoUpdate({
        target: schema.autoTopupSettings.organizationId,
        set: {
          enabled: true,
          thresholdCents,
          amountCents,
          subscriptionId: activeSub.subscription_id,
          updatedAt: new Date(),
        },
      });

    logger.info({ email, subscriptionId: activeSub.subscription_id }, 'auto top-up verified and activated');
    return c.json({ verified: true });
  } catch (error: any) {
    logger.error({ err: error }, 'auto-topup verify error');
    return c.json({ error: error.message || 'Verification failed' }, 500);
  }
});

export const billingInternalRoutes = new Hono();

billingInternalRoutes.post('/auto-topup-sweep', async (c) => {
  try {
    const secret = config.internalCronSecret;
    if (!secret) {
      return c.json({ error: 'Cron secret not configured' }, 503);
    }

    const authHeader = c.req.header('Authorization');
    if (authHeader !== `Bearer ${secret}`) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    if (!dodoPayments) {
      return c.json({ error: 'Payments not configured' }, 503);
    }

    const orgIdFilter = new URL(c.req.url).searchParams.get('org_id') ?? undefined;
    const result = await runAutoTopupSweep(orgIdFilter);
    return c.json(result);
  } catch (error: any) {
    logger.error({ err: error }, 'auto-topup sweep error');
    return c.json({ error: error.message || 'Sweep failed' }, 500);
  }
});
