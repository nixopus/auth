// Initialize secrets before importing config
import './init-secrets.js';
import { waitForSecrets } from './init-secrets.js';

await waitForSecrets();

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { eq } from 'drizzle-orm';
import { config } from './config.js';
import { logger } from './logger.js';
import { authHandler } from './auth/handler.js';
import { auth } from './auth/index.js';
import { seedAdminUser } from './auth/seed-admin.js';
import { db } from './db/index.js';
import * as schema from './db/schema.js';
import { billingRoutes, autoTopupRoutes, billingInternalRoutes } from './routes/billing.js';

await seedAdminUser();

const app = new Hono();

app.use('*', cors({
  origin: (origin) => {
    const allowedOrigins = config.corsAllowedOrigins;
    if (origin && allowedOrigins.includes(origin)) {
      return origin;
    }
    return allowedOrigins[0] || '*';
  },
  credentials: true,
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-Session-ID', 'x-session-id', 'X-Organization-Id', 'x-organization-id'],
  exposeHeaders: ['Authorization', 'X-Organization-Id', 'x-organization-id'],
  maxAge: 300,
}));

app.get('/health', (c) => {
  return c.json({ status: 'ok', service: 'auth' });
});

app.route('/api/credits', billingRoutes);
app.route('/api/credits/auto-topup', autoTopupRoutes);
app.route('/api/internal', billingInternalRoutes);

app.all('/api/auth/*', async (c) => {
  const url = new URL(c.req.url);
  const isCheckoutRequest = url.pathname.includes('/dodopayments/checkout');

  if (isCheckoutRequest) {
    try {
      const clonedRequest = c.req.raw.clone();
      const requestBody = await clonedRequest.text().catch(() => null);
      let parsedBody: any = null;
      try {
        parsedBody = requestBody && (requestBody.startsWith('{') || requestBody.startsWith('['))
          ? JSON.parse(requestBody)
          : requestBody;
      } catch {
        // ignore parse errors
      }

      const session = await auth.api.getSession({ headers: c.req.raw.headers });
      const user = session?.user;
      const hasName = user?.name && user.name.trim().length > 0;

      if (user && !hasName) {
        const newName = parsedBody?.customer?.name?.trim() || user.email.split('@')[0];
        if (newName) {
          await db.update(schema.user)
            .set({ name: newName })
            .where(eq(schema.user.id, user.id));
        }
      }
    } catch (error) {
      logger.warn({ err: error }, 'failed to update user name before checkout');
    }
  }

  return authHandler(c.req.raw);
});

export default {
  port: config.port,
  hostname: config.host,
  fetch: app.fetch,
};

logger.info({ host: config.host, port: config.port }, 'auth service started');
logger.info({ endpoint: `http://${config.host}:${config.port}/api/auth` }, 'better auth endpoint ready');
logger.info({
  selfHosted: config.selfHosted,
  emailProvider: config.resendApiKey ? 'resend' : 'console',
  captcha: !!config.turnstileSecretKey,
  payments: !!config.dodoPaymentsApiKey,
  secretManager: process.env.SECRET_MANAGER_ENABLED === 'true',
}, 'feature flags');
