import { resendService, SendEmailParams } from './resend.js';
import { config } from '../config.js';
import { logger } from '../logger.js';
import { templateManager, TEMPLATE_IDS } from './templates.js';

export interface SendOTPEmailParams {
  email: string;
  otp: string;
  type: 'sign-in' | 'email-verification' | 'forget-password' | 'change-email';
}

export interface SendInvitationEmailParams {
  email: string;
  organizationName: string;
  invitationUrl?: string;
}

export interface SendResetPasswordEmailParams {
  email: string;
  url: string;
  token: string;
}

/**
 * Email service for sending various types of emails using Resend templates
 */
export class EmailService {
  private defaultFrom: string;
  private useTemplates: boolean;

  constructor() {
    // Get from email from config or use default
    this.defaultFrom = config.resendFromEmail || 'Nixopus <updates@updates.nixopus.com>';
    // Use templates if Resend API key is configured
    this.useTemplates = !!config.resendApiKey;
  }

  /**
   * Send OTP verification email using template
   */
  async sendVerificationOTP(params: SendOTPEmailParams): Promise<void> {
    const { email, otp, type } = params;

    if (!config.resendApiKey) {
      logger.info({ email, type }, 'self-hosted OTP generated (no email provider)');
      return;
    }

    const subject = type === 'forget-password' ? 'Reset your password' : 'Your verification code';
    const templateId = templateManager.getTemplateId(
      type === 'forget-password'
        ? TEMPLATE_IDS.OTP_FORGET_PASSWORD
        : type === 'email-verification'
          ? TEMPLATE_IDS.OTP_EMAIL_VERIFICATION
          : TEMPLATE_IDS.OTP_SIGN_IN,
    );

    try {
      if (this.useTemplates && templateId) {
        await resendService.sendEmail({
          from: this.defaultFrom,
          to: email,
          subject,
          template: {
            id: templateId,
            variables: {
              OTP: otp,
            },
          },
        });
      } else {
        const html = this.getOTPHTML(type, otp);
        await resendService.sendEmail({
          from: this.defaultFrom,
          to: email,
          subject,
          html,
        });
      }
      logger.info({ email, type }, 'OTP email sent');
    } catch (error) {
      logger.error({ err: error, email }, 'failed to send OTP email');
      throw error;
    }
  }

  /**
   * Send password reset email
   */
  async sendResetPassword(params: SendResetPasswordEmailParams): Promise<void> {
    const { email, url } = params;

    try {
      // For password reset, we'll use inline HTML since it's URL-based, not OTP-based
      const html = this.getResetPasswordHTML(url);
      await resendService.sendEmail({
        from: this.defaultFrom,
        to: email,
        subject: 'Reset your password',
        html,
      });
      logger.info({ email }, 'password reset email sent');
    } catch (error) {
      logger.error({ err: error, email }, 'failed to send password reset email');
      throw error;
    }
  }

  /**
   * Send organization invitation email using template
   */
  async sendInvitationEmail(params: SendInvitationEmailParams): Promise<void> {
    const { email, organizationName, invitationUrl } = params;

    const templateId = templateManager.getTemplateId(TEMPLATE_IDS.ORGANIZATION_INVITATION);

    try {
      if (this.useTemplates && templateId) {
        // Use template
        await resendService.sendEmail({
          from: this.defaultFrom,
          to: email,
          subject: `Invitation to join ${organizationName}`,
          template: {
            id: templateId,
            variables: {
              ORGANIZATION_NAME: organizationName,
              INVITATION_URL: invitationUrl || '',
            },
          },
        });
      } else {
        // Fallback to inline HTML if templates not available
        const html = this.getInvitationHTML(organizationName, invitationUrl);
        await resendService.sendEmail({
          from: this.defaultFrom,
          to: email,
          subject: `Invitation to join ${organizationName}`,
          html,
        });
      }
      logger.info({ email, organizationName }, 'invitation email sent');
    } catch (error) {
      logger.error({ err: error, email }, 'failed to send invitation email');
      throw error;
    }
  }

  /**
   * Fallback HTML for OTP emails (used when templates are not available)
   */
  private getOTPHTML(type: 'sign-in' | 'email-verification' | 'forget-password' | 'change-email', otp: string): string {
    let heading: string;
    let description: string;
    let footerText: string;

    switch (type) {
      case 'forget-password':
        heading = 'Reset your password';
        description = 'Use this code to reset your password.';
        footerText = 'If you didn\'t request a password reset, ignore this email.';
        break;
      case 'email-verification':
        heading = 'Verify your email';
        description = 'Use this code to verify your email address.';
        footerText = 'If you didn\'t request this verification, ignore this email.';
        break;
      case 'change-email':
        heading = 'Change your email';
        description = 'Use this code to confirm your new email address.';
        footerText = 'If you didn\'t request this change, ignore this email.';
        break;
      default:
        heading = 'Sign in to Nixopus';
        description = 'Use this code to sign in.';
        footerText = 'If you didn\'t request this login, ignore this email.';
        break;
    }

    return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta http-equiv="X-UA-Compatible" content="IE=edge" />
    <title>${heading}</title>
    <style>
      body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
      table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
      img { -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }
      body { margin: 0; padding: 0; width: 100% !important; }
    </style>
  </head>
  <body style="margin: 0; padding: 0; background-color: #ffffff; font-family: -apple-system, 'SF Pro Display', 'Inter', 'Helvetica Neue', Arial, sans-serif;">
    <div style="display: none; max-height: 0; overflow: hidden; mso-hide: all;">Your Login OTP for Nixopus.</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #ffffff;">
      <tr>
        <td align="center" style="padding: 48px 16px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 560px; background-color: #111111; border-radius: 12px; border: 1px solid #1e1e1e; overflow: hidden;">
            <tr>
              <td align="center" style="padding: 44px 40px 28px;">
                <img src="https://kfsemevdxvqqgxphawae.supabase.co/storage/v1/object/public/brand-material/logo/Nixopus%20Logo%20White%20(Black%20Theme).png" alt="Nixopus" width="140" style="display: block;" />
              </td>
            </tr>
            <tr>
              <td align="center" style="padding: 0 40px;">
                <h1 style="margin: 0; font-size: 22px; font-weight: 700; color: #f2f2f2; letter-spacing: -0.4px; line-height: 1.3;">${heading}</h1>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding: 20px 40px 0;">
                <p style="margin: 0; font-size: 15px; line-height: 1.7; color: #858585; text-align: center;">${description}</p>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding: 32px 40px;">
                <table role="presentation" cellpadding="0" cellspacing="0" style="background-color: #0a0a0a; border-radius: 8px; border: 1px solid #1e1e1e;">
                  <tr>
                    <td style="padding: 20px 40px;">
                      <p style="margin: 0; font-size: 32px; font-weight: 700; color: #f2f2f2; letter-spacing: 8px; font-family: 'SF Mono', 'Fira Code', 'Courier New', monospace; text-align: center;">${otp}</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding: 0 40px 32px;">
                <p style="margin: 0; font-size: 13px; line-height: 1.6; color: #525252; text-align: center;">This code expires in 10 minutes.</p>
              </td>
            </tr>
            <tr>
              <td style="padding: 0 40px;">
                <div style="height: 1px; background-color: #1e1e1e;"></div>
              </td>
            </tr>
            <tr>
              <td style="padding: 24px 40px 32px;">
                <p style="margin: 0; font-size: 12px; line-height: 1.6; color: #3d3d3d;">${footerText}</p>
                <p style="margin: 8px 0 0; font-size: 12px; line-height: 1.6; color: #3d3d3d;">Nixopus · Autonomous cloud for modern builders</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
  }

  /**
   * HTML for password reset emails
   */
  private getResetPasswordHTML(url: string): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #333; margin-bottom: 20px;">Reset Your Password</h2>
        <p style="color: #666; font-size: 16px; margin-bottom: 20px;">
          Click the button below to reset your password. This link will expire in 1 hour.
        </p>
        <p style="margin: 30px 0;">
          <a href="${url}" style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
            Reset Password
          </a>
        </p>
        <p style="color: #999; font-size: 12px; margin-top: 20px;">
          If you didn't request a password reset, please ignore this email. Your password will remain unchanged.
        </p>
        <p style="color: #999; font-size: 12px; margin-top: 10px;">
          If the button doesn't work, copy and paste this link into your browser:<br>
          <a href="${url}" style="color: #007bff; word-break: break-all;">${url}</a>
        </p>
      </div>
    `;
  }

  /**
   * Fallback HTML for invitation emails (used when templates are not available)
   */
  private getInvitationHTML(organizationName: string, invitationUrl?: string): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Organization Invitation</h2>
        <p>You have been invited to join <strong>${organizationName}</strong>.</p>
        ${invitationUrl ? `
          <p style="margin: 30px 0;">
            <a href="${invitationUrl}" style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
              Accept Invitation
            </a>
          </p>
        ` : ''}
        <p>If you didn't expect this invitation, you can safely ignore this email.</p>
      </div>
    `;
  }

  /**
   * Send a custom email
   */
  async sendCustomEmail(params: SendEmailParams): Promise<void> {
    try {
      await resendService.sendEmail({
        ...params,
        from: params.from || this.defaultFrom,
      });
      logger.info({ to: params.to }, 'custom email sent');
    } catch (error) {
      logger.error({ err: error }, 'failed to send custom email');
      throw error;
    }
  }
}

// Export a singleton instance
export const emailService = new EmailService();
