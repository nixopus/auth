import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { emailOTP, organization, deviceAuthorization, bearer } from 'better-auth/plugins';
import { createAuthMiddleware } from 'better-auth/api';
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
import { eq, and } from 'drizzle-orm';

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

async function sendVerificationOTP({ email, otp, type }: { email: string; otp: string; type: 'sign-in' | 'email-verification' | 'forget-password' }) {
  let isNewUser = false;
  
  if (type === 'sign-in') {
    isNewUser = await checkIfUserExists(email);
  }
  
  await emailService.sendVerificationOTP({ email, otp, type, isNewUser });
}

export const dodoPayments = new DodoPayments({
  bearerToken: config.dodoPaymentsApiKey,
  environment: config.dodoPaymentsEnvironment,
});
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
    bearer(), // Enable Bearer token authentication for CLI and API access
    // Dodo Payments plugin
    ...(config.dodoPaymentsApiKey
      ? [
          dodopayments({
            client: dodoPayments,
            createCustomerOnSignUp: true,
            use: [
              checkout({
                products: [
                  // TODO: Add products here
                ],
                successUrl: '/dashboard/success',
                authenticatedUsersOnly: true,
              }),
              portal(),
              webhooks({
                webhookKey: config.dodoPaymentsWebhookSecret,
                onPayload: async (payload: any) => {
                  console.log('Received Dodo Payments webhook:', payload.type);
                  // Handle webhook events here
                },
              }),
              usage(),
            ],
          }),
        ]
      : []),
  ],
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
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
        },
      },
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7days
    updateAge: 60 * 60 * 24, // 1 day
  },
  hooks: {
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
