import { createAuthMiddleware } from 'better-auth/api';
import { config } from '../config.js';
import { logger } from '../logger.js';
import { assertRegistrationAllowed, assertInvitationsAllowed, hasExistingUsers } from './self-hosted-guard.js';
import { getUserCount, isNewUserEmail, getUserIdFromEmail } from './queries.js';
import { emailService } from '../services/email.js';

function buildOTPVerificationResponse(context: any): { success: boolean; isNewUser: boolean; user?: any; session?: any } {
  const isNewUser = !!context?.newSession;
  const responseData: any = { success: true, isNewUser };

  if (context?.newSession) {
    responseData.user = context.newSession.user;
    responseData.session = context.newSession.session;
  } else if (context?.session) {
    responseData.user = context.session.user;
    responseData.session = context.session;
  }

  return responseData;
}

export const beforeHook = createAuthMiddleware(async (ctx) => {
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
});

export const afterHook = createAuthMiddleware(async (ctx) => {
  const isEmailOTPSend = ctx.path === '/email-otp/send-verification-otp';
  const isEmailOTPVerify = ctx.path === '/email-otp/check-verification-otp';

  if (!isEmailOTPSend && !isEmailOTPVerify) return;

  const body = ctx.body as { email?: string; type?: string };
  if (body.type !== 'sign-in' || !body.email) return;

  if (isEmailOTPSend) {
    const isNew = await isNewUserEmail(body.email);
    logger.debug({ email: body.email, isNewUser: isNew }, 'OTP send completed');
    return ctx.json({ success: true, isNewUser: isNew });
  }

  if (isEmailOTPVerify) {
    try {
      const responseData = buildOTPVerificationResponse(ctx.context);
      logger.debug({ email: body.email, isNewUser: responseData.isNewUser }, 'OTP verification completed');
      return ctx.json(responseData);
    } catch (error) {
      logger.error({ err: error, email: body.email }, 'failed to check user in OTP verification hook');
      return ctx.json({ success: true, isNewUser: false });
    }
  }
});

export async function sendVerificationOTP({ email, otp, type }: {
  email: string;
  otp: string;
  type: 'sign-in' | 'email-verification' | 'forget-password' | 'change-email';
}): Promise<void> {
  await emailService.sendVerificationOTP({ email, otp, type });
}
