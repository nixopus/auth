export const config = {
  // Environment
  nodeEnv: process.env.NODE_ENV || 'development',
  isProduction: process.env.NODE_ENV === 'production',
  isDevelopment: process.env.NODE_ENV !== 'production',

  // Server configuration
  port: parseInt(process.env.PORT || '9090', 10),
  host: process.env.HOST || '0.0.0.0',

  // Database/Storage configuration
  // PostgreSQL connection string (e.g., postgresql://user:pass@host:5432/dbname)
  // Required for production, should be set via DATABASE_URL environment variable
  databaseUrl: process.env.DATABASE_URL || '',

  // Better Auth configuration
  betterAuthUrl: process.env.BETTER_AUTH_BASE_URL || process.env.BETTER_AUTH_URL || process.env.API_URL || `http://localhost:${parseInt(process.env.PORT || '8080', 10)}`,
  betterAuthSecret: process.env.BETTER_AUTH_SECRET || process.env.AUTH_SECRET || 'better-auth-secret-change-in-production',

  // CORS configuration
  corsAllowedOrigins: process.env.CORS_ALLOWED_ORIGINS
    ? process.env.CORS_ALLOWED_ORIGINS.split(',').map((origin) => origin.trim())
    : ['http://localhost:3000', 'http://localhost:7443'],

  // Cookie configuration
  cookieDomain: process.env.BETTER_AUTH_COOKIE_DOMAIN || undefined,
  secureCookies: process.env.BETTER_AUTH_SECURE_COOKIES === 'true',

  // Resend configuration
  resendApiKey: process.env.RESEND_API_KEY || '',
  resendFromEmail: process.env.RESEND_FROM_EMAIL || 'updates@updates.nixopus.com',

  // Dodo Payments configuration
  dodoPaymentsApiKey: process.env.DODO_PAYMENTS_API_KEY || '',
  dodoPaymentsWebhookSecret: process.env.DODO_PAYMENTS_WEBHOOK_SECRET || '',
  dodoPaymentsEnvironment: (process.env.DODO_PAYMENTS_ENVIRONMENT || 'test_mode') as 'test_mode' | 'live_mode',
  dodoPaymentsProductId: process.env.DODO_PAYMENTS_PRODUCT_ID || '',
  dodoPaymentsProductSlug: process.env.DODO_PAYMENTS_PRODUCT_SLUG || 'pro-plan',
  // SSH configuration (for installer-generated SSH keys)
  sshHost: process.env.SSH_HOST || '',
  sshPort: parseInt(process.env.SSH_PORT || '22', 10),
  sshUser: process.env.SSH_USER || 'root',
  sshPrivateKey: process.env.SSH_PRIVATE_KEY || '',
  sshPassword: process.env.SSH_PASSWORD || '',
} as const;
