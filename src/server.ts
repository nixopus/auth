// Initialize secrets before importing config
import './init-secrets.js';
import { waitForSecrets } from './init-secrets.js';

// Wait for secrets to be loaded before proceeding with initialization
await waitForSecrets();

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { config } from './config.js';
import { authHandler } from './auth/handler.js';

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
