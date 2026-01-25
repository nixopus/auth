import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { emailOTP, organization } from 'better-auth/plugins';
import { db } from '../db';
import { config } from '../config';
import * as schema from '../db/schema';
import { randomUUID } from 'crypto';
import { emailService } from '../services/email';

// Email sending function using Resend
async function sendVerificationOTP({ email, otp, type }: { email: string; otp: string; type: 'sign-in' | 'email-verification' | 'forget-password' }) {
  await emailService.sendVerificationOTP({ email, otp, type });
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
    // Enable cross-subdomain cookies to allow cookies to work across nixopus.com subdomains
    // This is needed because cookies are set for auth.nixopus.com but requests come from view.nixopus.com
    // In development (localhost), we disable this so cookies work on localhost
    // In production, we enable it with .nixopus.com domain for cross-subdomain support
    ...(config.isProduction
      ? {
          crossSubDomainCookies: {
            enabled: true,
            domain: '.nixopus.com', // Set to root domain to allow all subdomains
          },
        }
      : {
          // In development, don't set crossSubDomainCookies - cookies will default to current host (localhost)
          // This allows cookies to work properly on localhost:3000 and localhost:8080
        }),
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
