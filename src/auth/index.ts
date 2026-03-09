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
    console.error(`Failed to check if user exists for ${email}:`, error);
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
    console.error(`triggerResourceUpgrade: no user found for email ${email}`);
    return;
  }

  const orgId = await getOrgIdFromCustomerEmail(email);
  if (!orgId) {
    console.error(`triggerResourceUpgrade: no org found for email ${email}`);
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
    console.error(`triggerResourceUpgrade failed (${resp.status}): ${text}`);
    return;
  }

  console.log(`Resource upgrade triggered for user ${userId} -> ${planTier} (${resources.vcpu} vCPU, ${resources.memoryMB} MB)`);
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
  
  await db.insert(schema.sshKeys).values({
    id: randomUUID(),
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

  console.log(`Created SSH key entry for organization ${organizationId} (user: ${userEmail})`);
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
  return rows[0] ?? null;
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

    return accounts.length > 0;
  } catch (error) {
    console.error(`Failed to check credential account for user ${userId}:`, error);
    return false;
  }
}

async function loadSSHCredentialsForUser(userId: string, organizationId: string, userEmail: string): Promise<void> {
  try {
    const hasCredentialAccount = await checkIfUserHasCredentialAccount(userId);

    if (hasCredentialAccount && config.sshHost && config.sshPrivateKey) {
      await createSSHKeyEntry(organizationId, userEmail);
    } else if (hasCredentialAccount) {
      console.log(`SSH credentials not available in environment for user ${userEmail}`);
    }
  } catch (error) {
    console.error(`Failed to create SSH key entry for user ${userEmail}:`, error);
  }
}

export async function setupNewUser(user: { id: string; email: string; name: string | null }): Promise<void> {
  if (!user.name || user.name.trim().length === 0) {
    const fallbackName = user.email.split('@')[0];
    await db.update(schema.user)
      .set({ name: fallbackName })
      .where(eq(schema.user.id, user.id));
    user.name = fallbackName;
  }

  try {
    const userName = user.name || user.email.split('@')[0];
    const baseSlug = userName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const uuidSuffix = randomUUID().replace(/-/g, '').substring(0, 8);
    const slug = `${baseSlug}-${uuidSuffix}`;

    const orgId = randomUUID();
    const orgName = `${userName}'s Team`;

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

    console.log(`Created default organization "${orgName}" (${orgId}) for user ${user.email}`);

    await loadSSHCredentialsForUser(user.id, orgId, user.email);
  } catch (error) {
    console.error(`Failed to create default organization for user ${user.email}:`, error);
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
        // Use data.id as the invitation ID (as per Better Auth docs)
        // The invitation ID is used as the token for accepting invitations
        const invitationUrl = `${config.betterAuthUrl}/auth/organization-invite?token=${data.id}`;
        
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
                  console.log('Received Dodo Payments webhook:', payload.type);

                  if (
                    payload.type === 'subscription.active' ||
                    payload.type === 'subscription.renewed' ||
                    payload.type === 'subscription.plan_changed'
                  ) {
                    try {
                      const orgId = await getOrgIdFromCustomerEmail(payload.data.customer.email);
                      if (!orgId) {
                        console.error(`No organization found for customer: ${payload.data.customer.email}`);
                        return;
                      }
                      const tier = getPlanTier(payload.data.product_id, payload.data.metadata);
                      const credits = PLAN_CREDIT_ALLOCATIONS[tier] ?? PLAN_CREDIT_ALLOCATIONS.free;
                      await grantPlanCredits(orgId, credits, payload.data.subscription_id);
                      console.log(`Granted ${credits} plan credits (${tier}) to org ${orgId}`);

                      if (payload.type === 'subscription.active' || payload.type === 'subscription.plan_changed') {
                        try {
                          await triggerResourceUpgrade(payload.data.customer.email, tier);
                        } catch (upgradeErr) {
                          console.error('Failed to trigger resource upgrade:', upgradeErr);
                        }
                      }
                    } catch (error) {
                      console.error('Failed to grant plan credits:', error);
                    }
                  }

                  if (payload.type === 'payment.succeeded') {
                    try {
                      if (payload.data.subscription_id) return;
                      const orgId = await getOrgIdFromCustomerEmail(payload.data.customer.email);
                      if (!orgId) {
                        console.error(`No organization found for customer: ${payload.data.customer.email}`);
                        return;
                      }
                      const credits = payload.data.metadata?.credits
                        ? Number(payload.data.metadata.credits)
                        : payload.data.total_amount;
                      await addPurchasedCredits(orgId, credits, payload.data.payment_id);
                      console.log(`Added ${credits} purchased credits to org ${orgId}`);
                    } catch (error) {
                      console.error('Failed to add purchased credits:', error);
                    }
                  }

                  if (payload.type === 'subscription.cancelled') {
                    console.log(`Subscription cancelled for customer: ${payload.data.customer.email}`);
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
        
        return ctx.json({
          success: true,
          isNewUser,
        });
      }
      
      if (isEmailOTPVerify) {
        try {
          const responseData = buildOTPVerificationResponse(ctx.context);
          return ctx.json(responseData);
        } catch (error) {
          console.error(`Failed to check if user exists in email OTP verification hook for ${body.email}:`, error);
          return ctx.json({
            success: true,
            isNewUser: false,
          });
        }
      }
    }),
  },
});
