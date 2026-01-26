import { resendService, SendEmailParams } from './resend.js';
import { config } from '../config.js';
import { templateManager, TEMPLATE_IDS } from './templates.js';

export interface SendOTPEmailParams {
  email: string;
  otp: string;
  type: 'sign-in' | 'email-verification' | 'forget-password';
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
    this.defaultFrom = config.resendFromEmail || 'updates@updates.nixopus.com';
    // Use templates if Resend API key is configured
    this.useTemplates = !!config.resendApiKey;
  }

  /**
   * Send OTP verification email using template
   */
  async sendVerificationOTP(params: SendOTPEmailParams): Promise<void> {
    const { email, otp, type } = params;

    let subject: string;
    let templateId: string | undefined;

    switch (type) {
      case 'sign-in':
        subject = 'Your sign-in code';
        templateId = templateManager.getTemplateId(TEMPLATE_IDS.OTP_SIGN_IN);
        break;
      case 'email-verification':
        subject = 'Verify your email';
        templateId = templateManager.getTemplateId(TEMPLATE_IDS.OTP_EMAIL_VERIFICATION);
        break;
      case 'forget-password':
        subject = 'Reset your password';
        templateId = templateManager.getTemplateId(TEMPLATE_IDS.OTP_FORGET_PASSWORD);
        break;
    }

    try {
      if (this.useTemplates && templateId) {
        // Use template
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
        // Fallback to inline HTML if templates not available
        const html = this.getOTPHTML(type, otp);
        await resendService.sendEmail({
          from: this.defaultFrom,
          to: email,
          subject,
          html,
        });
      }
      console.log(`OTP email sent successfully to ${email} (type: ${type})`);
    } catch (error) {
      console.error(`Failed to send OTP email to ${email}:`, error);
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
      console.log(`Password reset email sent successfully to ${email}`);
    } catch (error) {
      console.error(`Failed to send password reset email to ${email}:`, error);
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
      console.log(`Invitation email sent successfully to ${email} for organization ${organizationName}`);
    } catch (error) {
      console.error(`Failed to send invitation email to ${email}:`, error);
      throw error;
    }
  }

  /**
   * Fallback HTML for OTP emails (used when templates are not available)
   */
  private getOTPHTML(type: 'sign-in' | 'email-verification' | 'forget-password', otp: string): string {
    let title: string;
    let description: string;
    let footerText: string;

    switch (type) {
      case 'sign-in':
        title = 'Your Sign-In Code';
        description = 'Your verification code is:';
        footerText = 'If you didn\'t request this code, please ignore this email.';
        break;
      case 'email-verification':
        title = 'Verify Your Email';
        description = 'Your verification code is:';
        footerText = 'If you didn\'t request this code, please ignore this email.';
        break;
      case 'forget-password':
        title = 'Reset Your Password';
        description = 'Your password reset code is:';
        footerText = 'If you didn\'t request a password reset, please ignore this email.';
        break;
    }

    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>${title}</h2>
        <p>${description}</p>
        <div style="background-color: #f4f4f4; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 5px; margin: 20px 0;">
          ${otp}
        </div>
        <p>This code will expire in 5 minutes.</p>
        <p>${footerText}</p>
      </div>
    `;
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
      console.log(`Custom email sent successfully to ${Array.isArray(params.to) ? params.to.join(', ') : params.to}`);
    } catch (error) {
      console.error(`Failed to send custom email:`, error);
      throw error;
    }
  }
}

// Export a singleton instance
export const emailService = new EmailService();
