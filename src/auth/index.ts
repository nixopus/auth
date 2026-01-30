import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { emailOTP, organization } from 'better-auth/plugins';
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

// Email sending function using Resend
async function sendVerificationOTP({ email, otp, type }: { email: string; otp: string; type: 'sign-in' | 'email-verification' | 'forget-password' }) {
  await emailService.sendVerificationOTP({ email, otp, type });
}

// Initialize Dodo Payments client
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

// Load SSH credentials for email/password users after registration
async function loadSSHCredentialsForUser(userId: string, organizationId: string, userEmail: string): Promise<void> {
  try {

    const accounts = await db
      .select()
      .from(schema.account)
      .where(and(
        eq(schema.account.userId, userId),
        eq(schema.account.providerId, 'credential')
      ))
      .limit(1);

    const account = accounts[0];

    if (account && config.sshHost && config.sshPrivateKey) {
      await createSSHKeyEntry(organizationId, userEmail);
    } else if (account) {
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
            domain: config.cookieDomain, // Set from BETTER_AUTH_COOKIE_DOMAIN env var
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
      expiresIn: 1300, // 5 minutes
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
                onPayload: async (payload) => {
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
          // Create a default organization for the new user
          try {
            // Generate a slug from the user's name or email
            const userName = user.name || user.email.split('@')[0];
            const baseSlug = userName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
            // Generate a UUID-based suffix for uniqueness (using last 8 chars of UUID)
            const uuidSuffix = randomUUID().replace(/-/g, '').substring(0, 8);
            const slug = `${baseSlug}-${uuidSuffix}`;
            
            // Create organization directly in the database using UUID
            const orgId = randomUUID();
            const orgName = `${userName}'s Team`;
            
            await db.insert(schema.organization).values({
              id: orgId,
              name: orgName,
              slug: slug,
              createdAt: new Date(),
              metadata: JSON.stringify({ description: 'Default organization' }),
            });

            // Add user as owner of the organization using UUID
            const memberId = randomUUID();
            await db.insert(schema.member).values({
              id: memberId,
              organizationId: orgId,
              userId: user.id,
              role: 'owner',
              createdAt: new Date(),
            });

            console.log(`Created default organization "${orgName}" (${orgId}) for user ${user.email}`);

            // Check if user registered with email/password and load SSH credentials if available
            await loadSSHCredentialsForUser(user.id, orgId, user.email);
          } catch (error) {
            // Log error but don't fail user creation
            console.error(`Failed to create default organization for user ${user.email}:`, error);
          }
        },
      },
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day
  },
});
