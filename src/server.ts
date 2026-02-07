// Initialize secrets before importing config
import './init-secrets.js';
import { waitForSecrets } from './init-secrets.js';

// Wait for secrets to be loaded before proceeding with initialization
await waitForSecrets();

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { config } from './config.js';
import { authHandler } from './auth/handler.js';
import { auth } from './auth/index.js';
import { db } from './db/index.js';
import * as schema from './db/schema.js';
import { eq } from 'drizzle-orm';

const app = new Hono();

// CORS middleware
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

// Health check endpoint
app.get('/health', (c) => {
  return c.json({ status: 'ok', service: 'auth' });
});

// Better Auth routes
app.all('/api/auth/*', async (c) => {
  const url = new URL(c.req.url);
  const isCheckoutRequest = url.pathname.includes('/dodopayments/checkout');
  
  if (isCheckoutRequest) {
    // Ensure authenticated user has a name before checkout
    // This fixes the issue where Better Auth plugin uses user's name from DB
    try {
      const clonedRequest = c.req.raw.clone();
      const requestBody = await clonedRequest.text().catch(() => null);
      let parsedBody: any = null;
      try {
        parsedBody = requestBody ? (requestBody.startsWith('{') || requestBody.startsWith('[') ? JSON.parse(requestBody) : requestBody) : null;
      } catch (e) {
        // Ignore parse errors
      }
      
      const customerInfo = parsedBody?.customer;
      const session = await auth.api.getSession({ headers: c.req.raw.headers });
      if (session?.user) {
        const user = session.user;
        // Check if user's name is empty or missing
        if (!user.name || user.name.trim().length === 0) {
          // Use provided customer name or fallback to email prefix
          const newName = customerInfo?.name?.trim() || user.email.split('@')[0];
          if (newName) {
            await db.update(schema.user)
              .set({ name: newName })
              .where(eq(schema.user.id, user.id));
          }
        }
      }
    } catch (error) {
      // Silently fail - don't block checkout if we can't update user name
    }
  }
  
  return authHandler(c.req.raw);
});

// Start server using Bun's native server
export default {
  port: config.port,
  hostname: config.host,
  fetch: app.fetch,
};

console.log(`🚀 Auth service running on http://${config.host}:${config.port}`);
console.log(`📝 Better Auth endpoint: http://${config.host}:${config.port}/api/auth`);
