import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { emailOTP, organization, deviceAuthorization, bearer, apiKey, captcha } from 'better-auth/plugins';
import { passkey } from '@better-auth/passkey';
import { createAuthMiddleware } from 'better-auth/api';
import { hasExistingUsers, assertRegistrationAllowed, assertInvitationsAllowed, type GetUserCountFn } from './self-hosted-guard.js';
import {
  dodopayments,
  checkout,
  portal,
  webhooks,
  usage,
} from '@dodopayments/better-auth';
import DodoPayments from 'dodopayments';
import { db } from '../db/index.js';
import { config } from '../config.js';
import { logger } from '../logger.js';
import * as schema from '../db/schema.js';
import { randomUUID } from 'crypto';
import { emailService } from '../services/email.js';
import { eq, and, asc, sql } from 'drizzle-orm';

async function checkIfUserExists(email: string): Promise<boolean> {
  try {
    const existingUser = await db
      .select()
      .from(schema.user)
      .where(eq(schema.user.email, email))
      .limit(1);
    
    return existingUser.length === 0;
  } catch (error) {
    logger.error({ err: error, email }, 'failed to check if user exists');
    return false;
  }
}

function buildOTPVerificationResponse(context: any): { success: boolean; isNewUser: boolean; user?: any; session?: any } {
  const isNewUser = !!context?.newSession;
  
  const responseData: any = {
    success: true,
    isNewUser,
  };
  
  if (context?.newSession) {
    responseData.user = context.newSession.user;
    responseData.session = context.newSession.session;
  } else if (context?.session) {
    responseData.user = context.session.user;
    responseData.session = context.session;
  }
  
  return responseData;
}

async function sendVerificationOTP({ email, otp, type }: { email: string; otp: string; type: 'sign-in' | 'email-verification' | 'forget-password' | 'change-email' }) {
  await emailService.sendVerificationOTP({ email, otp, type });
}

const getUserCount: GetUserCountFn = async () => {
  const [row] = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.user)
    .limit(1);
  return row?.count ?? 0;
};

export const dodoPayments = config.dodoPaymentsApiKey
  ? new DodoPayments({
      bearerToken: config.dodoPaymentsApiKey,
      environment: config.dodoPaymentsEnvironment,
    })
  : null;

const PLAN_CREDIT_ALLOCATIONS: Record<string, number> = {
  free: 500,
  pro: 10000,
  team: 50000,
};

async function getOrgIdFromCustomerEmail(email: string): Promise<string | null> {
  const rows = await db
    .select({ organizationId: schema.member.organizationId })
    .from(schema.user)
    .innerJoin(schema.member, eq(schema.member.userId, schema.user.id))
    .where(and(eq(schema.user.email, email), eq(schema.member.role, 'owner')))
    .orderBy(asc(schema.member.createdAt))
    .limit(1);
  return rows[0]?.organizationId ?? null;
}

function getPlanTier(productId: string, metadata: Record<string, any> | null): string {
  if (metadata?.plan && typeof metadata.plan === 'string') {
    return metadata.plan;
  }
  if (config.dodoPaymentsProductId && productId === config.dodoPaymentsProductId) {
    return config.dodoPaymentsProductSlug.replace(/-plan$/, '');
  }
  return 'free';
}

const PLAN_RESOURCE_MAP: Record<string, { vcpu: number; memoryMB: number }> = {
  free: { vcpu: 1, memoryMB: 1024 },
  pro: { vcpu: 2, memoryMB: 2048 },
};

async function getUserIdFromEmail(email: string): Promise<string | null> {
  const rows = await db
    .select({ id: schema.user.id })
    .from(schema.user)
    .where(eq(schema.user.email, email))
    .limit(1);
  return rows[0]?.id ?? null;
}

async function triggerResourceUpgrade(email: string, planTier: string): Promise<void> {
  const resources = PLAN_RESOURCE_MAP[planTier] ?? PLAN_RESOURCE_MAP.free;

  const userId = await getUserIdFromEmail(email);
  if (!userId) {
    logger.error({ email }, 'triggerResourceUpgrade: no user found');
    return;
  }

  const orgId = await getOrgIdFromCustomerEmail(email);
  if (!orgId) {
    logger.error({ email }, 'triggerResourceUpgrade: no org found');
    return;
  }

  const url = `${config.nixopusApiUrl}/api/v1/trail/upgrade-resources`;
  const resp = await fetch(url, {
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

async function grantPlanCredits(orgId: string, credits: number, referenceId: string): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.insert(schema.creditAccounts).values({
      organizationId: orgId,
      planCredits: 0,
      purchasedCredits: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).onConflictDoNothing({ target: schema.creditAccounts.organizationId });

    const [updated] = await tx.update(schema.creditAccounts)
      .set({
        planCredits: credits,
        updatedAt: new Date(),
      })
      .where(eq(schema.creditAccounts.organizationId, orgId))
      .returning();

    await tx.insert(schema.creditTransactions).values({
      organizationId: orgId,
      type: 'plan_grant',
      amount: credits,
      balanceAfter: updated.planCredits + updated.purchasedCredits,
      source: 'plan',
      referenceId,
      createdAt: new Date(),
    });
  });
}

async function addPurchasedCredits(orgId: string, credits: number, referenceId: string): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.insert(schema.creditAccounts).values({
      organizationId: orgId,
      planCredits: 0,
      purchasedCredits: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).onConflictDoNothing({ target: schema.creditAccounts.organizationId });

    const [updated] = await tx.update(schema.creditAccounts)
      .set({
        purchasedCredits: sql`${schema.creditAccounts.purchasedCredits} + ${credits}`,
        updatedAt: new Date(),
      })
      .where(eq(schema.creditAccounts.organizationId, orgId))
      .returning();

    await tx.insert(schema.creditTransactions).values({
      organizationId: orgId,
      type: 'top_up',
      amount: credits,
      balanceAfter: updated.planCredits + updated.purchasedCredits,
      source: 'purchased',
      referenceId,
      createdAt: new Date(),
    });
  });
}

async function createSSHKeyEntry(organizationId: string, userEmail: string): Promise<void> {
  const authMethod = config.sshPassword ? 'password' : 'key';
  const sshKeyId = randomUUID();

  logger.debug({
    sshKeyId,
    organizationId,
    host: config.sshHost,
    port: config.sshPort,
    user: config.sshUser,
    authMethod,
  }, 'inserting SSH key entry');

  await db.insert(schema.sshKeys).values({
    id: sshKeyId,
    organizationId: organizationId,
    name: 'Default SSH Key',
    description: 'SSH key generated during installer',
    host: config.sshHost,
    user: config.sshUser,
    port: config.sshPort,
    privateKeyEncrypted: config.sshPrivateKey,
    passwordEncrypted: config.sshPassword || null,
    authMethod: authMethod,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  logger.info({ sshKeyId, organizationId, userEmail, authMethod }, 'created SSH key entry');
}

async function getInitialOrganization(userId: string): Promise<{ id: string } | null> {
  const rows = await db
    .select({ id: schema.organization.id })
    .from(schema.member)
    .innerJoin(
      schema.organization,
      eq(schema.member.organizationId, schema.organization.id),
    )
    .where(eq(schema.member.userId, userId))
    .orderBy(asc(schema.member.createdAt))
    .limit(1);
  const org = rows[0] ?? null;
  logger.debug({ userId, organizationId: org?.id ?? null }, 'resolved initial organization');
  return org;
}

async function checkIfUserHasCredentialAccount(userId: string): Promise<boolean> {
  try {
    const accounts = await db
      .select()
      .from(schema.account)
      .where(and(
        eq(schema.account.userId, userId),
        eq(schema.account.providerId, 'credential')
      ))
      .limit(1);

    const hasCredential = accounts.length > 0;
    logger.debug({ userId, hasCredential }, 'credential account check');
    return hasCredential;
  } catch (error) {
    logger.error({ err: error, userId }, 'failed to check credential account');
    return false;
  }
}

async function loadSSHCredentialsForUser(userId: string, organizationId: string, userEmail: string): Promise<void> {
  try {
    const hasCredentialAccount = await checkIfUserHasCredentialAccount(userId);

    logger.debug({
      userId,
      organizationId,
      hasCredentialAccount,
      sshHostSet: !!config.sshHost,
      sshKeySet: !!config.sshPrivateKey,
    }, 'SSH credential loading decision');

    if (hasCredentialAccount && config.sshHost && config.sshPrivateKey) {
      await createSSHKeyEntry(organizationId, userEmail);
    } else if (hasCredentialAccount) {
      logger.warn({ userEmail }, 'SSH credentials not available in environment');
    }
  } catch (error) {
    logger.error({ err: error, userEmail, organizationId }, 'failed to create SSH key entry');
  }
}

export async function setupNewUser(user: { id: string; email: string; name: string | null }): Promise<void> {
  logger.debug({ userId: user.id, email: user.email, name: user.name }, 'setting up new user');

  if (!user.name || user.name.trim().length === 0) {
    const fallbackName = user.email.split('@')[0];
    await db.update(schema.user)
      .set({ name: fallbackName })
      .where(eq(schema.user.id, user.id));
    user.name = fallbackName;
    logger.debug({ userId: user.id, fallbackName }, 'user name was empty, set fallback');
  }

  try {
    const userName = user.name || user.email.split('@')[0];
    const baseSlug = userName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const uuidSuffix = randomUUID().replace(/-/g, '').substring(0, 8);
    const slug = `${baseSlug}-${uuidSuffix}`;

    const orgId = randomUUID();
    const orgName = `${userName}'s Team`;

    logger.debug({ orgId, orgName, slug, userId: user.id }, 'creating organization');

    await db.insert(schema.organization).values({
      id: orgId,
      name: orgName,
      slug: slug,
      createdAt: new Date(),
      metadata: JSON.stringify({ description: 'Default organization' }),
    });

    const memberId = randomUUID();
    await db.insert(schema.member).values({
      id: memberId,
      organizationId: orgId,
      userId: user.id,
      role: 'owner',
      createdAt: new Date(),
    });

    logger.info({ orgId, orgName, email: user.email }, 'created default organization');

    await loadSSHCredentialsForUser(user.id, orgId, user.email);
  } catch (error) {
    logger.error({ err: error, email: user.email }, 'failed to create default organization');
  }
}

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema,
  }),
  baseURL: config.betterAuthUrl,
  basePath: '/api/auth',
  secret: config.betterAuthSecret,
  trustedOrigins: config.corsAllowedOrigins,
  emailAndPassword: {
    enabled: true,
    sendResetPassword: async ({ user, url, token }, request) => {
      await emailService.sendResetPassword({ email: user.email, url, token });
    },
  },
  advanced: {
    database: {
      generateId: 'uuid', // Use UUIDs instead of nanoid for all IDs
    },
    // Enable cross-subdomain cookies when cookie domain is configured
    // This allows cookies to work across subdomains (e.g., auth.example.com to view.example.com)
    // In development (localhost), cookie domain is not set, so cookies default to current host
    ...(config.cookieDomain
      ? {
          crossSubDomainCookies: {
            enabled: true,
            domain: config.cookieDomain,
          },
        }
      : {
          // In development or when cookie domain is not set, cookies default to current host
        }),
    // Enable secure cookies when configured (required for HTTPS)
    useSecureCookies: config.secureCookies,
  },
  plugins: [
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
      async sendInvitationEmail(data) {
        const invitationUrl = `${config.betterAuthUrl}/auth/organization-invite?token=${data.id}`;
        logger.debug({ email: data.email, organizationName: data.organization.name, invitationId: data.id }, 'sending organization invitation');
        await emailService.sendInvitationEmail({
          email: data.email,
          organizationName: data.organization.name,
          invitationUrl,
        });
      },
    }),
    deviceAuthorization({
      verificationUri: '/device',
      expiresIn: '30m', // Device code expiration (30 minutes)
      interval: '5s', // Polling interval (5 seconds)
      userCodeLength: 8, // User code length (8 characters)
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
    // Dodo Payments plugin
    ...(config.dodoPaymentsApiKey && dodoPayments
      ? [
          dodopayments({
            client: dodoPayments,
            createCustomerOnSignUp: true,
            use: [
              checkout({
                products: config.dodoPaymentsProductId
                  ? [
                      {
                        productId: config.dodoPaymentsProductId,
                        slug: config.dodoPaymentsProductSlug,
                      },
                    ]
                  : [],
                successUrl: '/dashboard/success',
                authenticatedUsersOnly: true,
              }),
              portal(),
              webhooks({
                webhookKey: config.dodoPaymentsWebhookSecret,
                onPayload: async (payload: any) => {
                  logger.info({ webhookType: payload.type }, 'received dodo payments webhook');

                  if (
                    payload.type === 'subscription.active' ||
                    payload.type === 'subscription.renewed' ||
                    payload.type === 'subscription.plan_changed'
                  ) {
                    try {
                      const orgId = await getOrgIdFromCustomerEmail(payload.data.customer.email);
                      if (!orgId) {
                        logger.error({ email: payload.data.customer.email }, 'no organization found for customer');
                        return;
                      }
                      const tier = getPlanTier(payload.data.product_id, payload.data.metadata);
                      const credits = PLAN_CREDIT_ALLOCATIONS[tier] ?? PLAN_CREDIT_ALLOCATIONS.free;
                      await grantPlanCredits(orgId, credits, payload.data.subscription_id);
                      logger.info({ orgId, credits, tier }, 'granted plan credits');

                      if (payload.type === 'subscription.active' || payload.type === 'subscription.plan_changed') {
                        try {
                          await triggerResourceUpgrade(payload.data.customer.email, tier);
                        } catch (upgradeErr) {
                          logger.error({ err: upgradeErr }, 'failed to trigger resource upgrade');
                        }
                      }
                    } catch (error) {
                      logger.error({ err: error }, 'failed to grant plan credits');
                    }
                  }

                  if (payload.type === 'payment.succeeded') {
                    try {
                      if (payload.data.subscription_id) return;
                      const orgId = await getOrgIdFromCustomerEmail(payload.data.customer.email);
                      if (!orgId) {
                        logger.error({ email: payload.data.customer.email }, 'no organization found for customer');
                        return;
                      }
                      const credits = payload.data.metadata?.credits
                        ? Number(payload.data.metadata.credits)
                        : payload.data.total_amount;
                      await addPurchasedCredits(orgId, credits, payload.data.payment_id);
                      logger.info({ orgId, credits }, 'added purchased credits');
                    } catch (error) {
                      logger.error({ err: error }, 'failed to add purchased credits');
                    }
                  }

                  if (payload.type === 'subscription.cancelled') {
                    logger.info({ email: payload.data.customer.email }, 'subscription cancelled');
                  }
                },
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
    expiresIn: 60 * 60 * 24 * 7, // 7days
    updateAge: 60 * 60 * 24, // 1 day
  },
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      if (!config.selfHosted) return;

      logger.debug({ path: ctx.path }, 'self-hosted guard check');

      if (ctx.path === '/organization/invite-member') {
        assertInvitationsAllowed(config.selfHosted);
      }

      if (ctx.path === '/sign-up/email') {
        await assertRegistrationAllowed(config.selfHosted, getUserCount);
      }

      if (ctx.path === '/email-otp/send-verification-otp') {
        const body = ctx.body as { email?: string; type?: string };
        if (body.type === 'sign-in' && body.email) {
          const exists = await hasExistingUsers(getUserCount);
          if (exists) {
            const userId = await getUserIdFromEmail(body.email);
            if (!userId) {
              logger.debug({ email: body.email }, 'OTP sign-in blocked for unknown email');
              await assertRegistrationAllowed(config.selfHosted, getUserCount);
            }
          }
        }
      }
    }),
    after: createAuthMiddleware(async (ctx) => {
      const isEmailOTPSend = ctx.path === '/email-otp/send-verification-otp';
      const isEmailOTPVerify = ctx.path === '/email-otp/check-verification-otp';
      
      if (!isEmailOTPSend && !isEmailOTPVerify) {
        return;
      }
      
      const body = ctx.body as { email?: string; type?: string };
      
      if (body.type !== 'sign-in' || !body.email) {
        return;
      }
      
      if (isEmailOTPSend) {
        const isNewUser = await checkIfUserExists(body.email);
        logger.debug({ email: body.email, isNewUser }, 'OTP send completed');
        return ctx.json({
          success: true,
          isNewUser,
        });
      }
      
      if (isEmailOTPVerify) {
        try {
          const responseData = buildOTPVerificationResponse(ctx.context);
          logger.debug({ email: body.email, isNewUser: responseData.isNewUser }, 'OTP verification completed');
          return ctx.json(responseData);
        } catch (error) {
          logger.error({ err: error, email: body.email }, 'failed to check user in OTP verification hook');
          return ctx.json({
            success: true,
            isNewUser: false,
          });
        }
      }
    }),
  },
});
