import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { emailOTP, organization, role, deviceAuthorization, bearer, captcha, jwt, testUtils } from 'better-auth/plugins';
import { apiKey } from '@better-auth/api-key';
import { passkey } from '@better-auth/passkey';
import { oauthProvider } from '@better-auth/oauth-provider';
import {
  dodopayments,
  checkout,
  portal,
  webhooks,
  usage,
} from '@dodopayments/better-auth';
import { assertRegistrationAllowed } from './self-hosted-guard.js';
import { db } from '../db/index.js';
import { config } from '../config.js';
import { logger } from '../logger.js';
import * as schema from '../db/schema.js';
import { emailService } from '../services/email.js';
import { getUserCount, getInitialOrganization } from './queries.js';
import { setupNewUser } from './user-setup.js';
import { dodoPayments } from './billing.js';
import { handleWebhookPayload } from './webhooks.js';
import { beforeHook, afterHook, sendVerificationOTP } from './hooks.js';

export { dodoPayments } from './billing.js';
export { setupNewUser } from './user-setup.js';
export { resolveOrgId } from './queries.js';

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema,
  }),
  baseURL: config.corsAllowedOrigins[0] || config.betterAuthUrl,
  basePath: '/api/auth',
  secret: config.betterAuthSecret,
  trustedOrigins: config.corsAllowedOrigins,
  disabledPaths: ['/token'],
  emailAndPassword: {
    enabled: true,
    sendResetPassword: async ({ user, url, token }) => {
      await emailService.sendResetPassword({ email: user.email, url, token });
    },
  },
  advanced: {
    database: {
      generateId: 'uuid',
    },
    ...(config.cookieDomain
      ? {
          crossSubDomainCookies: {
            enabled: true,
            domain: config.cookieDomain,
          },
        }
      : {}),
    useSecureCookies: config.secureCookies,
  },
  plugins: [
    ...(config.isTest ? [testUtils()] : []),
    emailOTP({
      sendVerificationOTP,
      otpLength: 6,
      expiresIn: 1300,
      allowedAttempts: 3,
    }),
    ...(config.turnstileSecretKey
      ? [
          captcha({
            provider: 'cloudflare-turnstile',
            secretKey: config.turnstileSecretKey,
            endpoints: [
              '/email-otp/send-verification-otp',
              '/sign-in/email-otp',
              '/sign-in/email',
              '/sign-up/email',
              '/forget-password/email-otp',
            ],
          }),
        ]
      : []),
    organization({
      roles: {
        viewer: role({
          organization: [],
          member: [],
          invitation: [],
          team: [],
          ac: [],
        }),
      },
      async sendInvitationEmail(data) {
        const frontendUrl = config.corsAllowedOrigins[0] || config.betterAuthUrl;
        const invitationUrl = `${frontendUrl}/auth/organization-invite?token=${data.id}`;
        await emailService.sendInvitationEmail({
          email: data.email,
          organizationName: data.organization.name,
          invitationUrl,
        });
      },
    }),
    deviceAuthorization({
      verificationUri: '/device',
      expiresIn: '30m',
      interval: '5s',
      userCodeLength: 8,
      validateClient: async (clientId) => {
        return clientId === 'nixopus-cli' || true;
      },
    }),
    bearer(),
    apiKey({
      enableSessionForAPIKeys: true,
      defaultPrefix: 'nxp_',
      enableMetadata: true,
      rateLimit: {
        enabled: true,
        timeWindow: 1000 * 60 * 60,
        maxRequests: 1000,
      },
    }),
    passkey({
      rpID: config.passkeyRpId,
      rpName: 'Nixopus',
      origin: config.corsAllowedOrigins,
    }),
    jwt({ disableSettingJwtHeader: true }),
    oauthProvider({
      loginPage: '/sign-in',
      consentPage: '/consent',
      m2mAccessTokenExpiresIn: 3600,
      validAudiences: config.m2mAudiences.length > 0 ? config.m2mAudiences : undefined,
      customAccessTokenClaims: ({ referenceId }) => ({
        'https://nixopus.com/org': referenceId,
      }),
    }),
    ...(config.dodoPaymentsApiKey && dodoPayments
      ? [
          dodopayments({
            client: dodoPayments,
            createCustomerOnSignUp: true,
            use: [
              checkout({
                products: config.dodoPaymentsProductId
                  ? [{ productId: config.dodoPaymentsProductId, slug: config.dodoPaymentsProductSlug }]
                  : [],
                successUrl: '/dashboard/success',
                authenticatedUsersOnly: true,
              }),
              portal(),
              webhooks({
                webhookKey: config.dodoPaymentsWebhookSecret,
                onPayload: handleWebhookPayload,
              }),
              usage(),
            ],
          }),
        ]
      : []),
  ],
  databaseHooks: {
    session: {
      create: {
        before: async (session) => {
          const organization = await getInitialOrganization(session.userId);
          logger.debug({ userId: session.userId, activeOrganizationId: organization?.id ?? null }, 'session created');
          return {
            data: {
              ...session,
              activeOrganizationId: organization?.id ?? null,
            },
          };
        },
      },
    },
    user: {
      create: {
        before: async () => {
          await assertRegistrationAllowed(config.selfHosted, getUserCount);
        },
        after: async (user) => {
          await setupNewUser(user);
        },
      },
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
    storeSessionInDatabase: true,
  },
  hooks: {
    before: beforeHook,
    after: afterHook,
  },
});
