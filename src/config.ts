import { existsSync, readFileSync } from 'fs';

function resolveSSHPrivateKey(value: string): string {
  if (!value || value.startsWith('-----BEGIN')) return value;
  try {
    if (existsSync(value)) {
      return readFileSync(value, 'utf8').trim();
    }
  } catch {
    // ignore
  }
  return value;
}

export const config = {
  // Environment
  nodeEnv: process.env.NODE_ENV || 'development',
  isProduction: process.env.NODE_ENV === 'production',
  isDevelopment: process.env.NODE_ENV !== 'production',
  selfHosted: process.env.SELF_HOSTED === 'true',
  adminEmail: process.env.ADMIN_EMAIL || '',

  // Server configuration
  port: parseInt(process.env.PORT || '9090', 10),
  host: process.env.HOST || '0.0.0.0',

  // Database/Storage configuration
  // PostgreSQL connection string (e.g., postgresql://user:pass@host:5432/dbname)
  // Required for production, should be set via DATABASE_URL environment variable
  databaseUrl: process.env.DATABASE_URL || '',

  // Auth service configuration
  betterAuthUrl: process.env.AUTH_SERVICE_URL || `http://localhost:${parseInt(process.env.PORT || '8080', 10)}`,
  betterAuthSecret: process.env.AUTH_SERVICE_SECRET || 'better-auth-secret-change-in-production',

  // CORS configuration
  corsAllowedOrigins: process.env.ALLOWED_ORIGIN
    ? process.env.ALLOWED_ORIGIN.split(',').map((origin) => origin.trim())
    : ['http://localhost:3000', 'http://localhost:7443'],

  // Cookie configuration
  cookieDomain: process.env.AUTH_COOKIE_DOMAIN || undefined,
  secureCookies: process.env.AUTH_SECURE_COOKIES === 'true',

  // Resend configuration
  resendApiKey: process.env.RESEND_API_KEY || '',
  resendFromEmail: process.env.RESEND_FROM_EMAIL || 'Nixopus <updates@updates.nixopus.com>',

  // Dodo Payments configuration
  dodoPaymentsApiKey: process.env.DODO_PAYMENTS_API_KEY || '',
  dodoPaymentsWebhookSecret: process.env.DODO_PAYMENTS_WEBHOOK_SECRET || '',
  dodoPaymentsEnvironment: (process.env.DODO_PAYMENTS_ENVIRONMENT || 'test_mode') as 'test_mode' | 'live_mode',
  dodoPaymentsProductId: process.env.DODO_PAYMENTS_PRODUCT_ID || '',
  dodoPaymentsProductSlug: process.env.DODO_PAYMENTS_PRODUCT_SLUG || 'pro-plan',
  dodoCreditProductId: process.env.DODO_CREDITS_PRODUCT_ID || '',
  dodoCreditMinDollars: parseInt(process.env.DODO_CREDITS_MIN_DOLLARS || '1', 10),
  dodoCreditMaxDollars: parseInt(process.env.DODO_CREDITS_MAX_DOLLARS || '1000', 10),
  dodoAutoTopupProductId: process.env.DODO_AUTO_TOPUP_PRODUCT_ID || '',
  internalCronSecret: process.env.INTERNAL_CRON_SECRET || '',
  nixopusApiUrl: process.env.API_URL || 'http://localhost:8080',

  // Cloudflare Turnstile (captcha)
  turnstileSecretKey: process.env.TURNSTILE_SECRET_KEY || '',

  // Passkey (WebAuthn) configuration
  passkeyRpId: process.env.PASSKEY_RP_ID || new URL(process.env.AUTH_SERVICE_URL || 'http://localhost').hostname,

  m2mAudiences: process.env.M2M_AUDIENCES
    ? process.env.M2M_AUDIENCES.split(',').map((a) => a.trim())
    : [],

  // SSH configuration (for installer-generated SSH keys)
  sshHost: process.env.SSH_HOST || '',
  sshPort: parseInt(process.env.SSH_PORT || '22', 10),
  sshUser: process.env.SSH_USER || 'root',
  sshPrivateKey: resolveSSHPrivateKey(process.env.SSH_PRIVATE_KEY || ''),
  sshPassword: process.env.SSH_PASSWORD || '',
} as const;
