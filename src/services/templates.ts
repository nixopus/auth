import { resendService } from './resend.js';
import { logger } from '../logger.js';

/**
 * Template IDs - these should match the template names in Resend
 * Templates will be created/verified on initialization
 */
export const TEMPLATE_IDS = {
  OTP_SIGN_IN: 'otp-sign-in',
  OTP_EMAIL_VERIFICATION: 'otp-email-verification',
  OTP_FORGET_PASSWORD: 'otp-forget-password',
  ORGANIZATION_INVITATION: 'organization-invitation',
} as const;

/**
 * Template manager for initializing and managing Resend email templates
 */
export class TemplateManager {
  private templateIdMap: Map<string, string> = new Map();

  /**
   * Initialize all email templates
   * This will create templates if they don't exist, or verify they exist
   */
  async initializeTemplates(): Promise<void> {
    logger.info('initializing resend email templates');

    // Check if API key is restricted (can only send emails, not manage templates)
    const isRestricted = await this.checkIfApiKeyIsRestricted();
    if (isRestricted) {
      logger.warn('resend API key is restricted to sending only, templates will not be initialized');
      return;
    }

    try {
      // Create OTP templates with rate limiting (Resend allows 2 requests/second)
      // Add 600ms delay between each template operation to stay under rate limit
      await this.ensureTemplate(
        TEMPLATE_IDS.OTP_SIGN_IN,
        'Sign-In Verification Code',
        this.getOTPTemplate('sign-in')
      );
      await this.delay(600); // Wait 600ms between requests

      await this.ensureTemplate(
        TEMPLATE_IDS.OTP_EMAIL_VERIFICATION,
        'Email Verification Code',
        this.getOTPTemplate('email-verification')
      );
      await this.delay(600);

      await this.ensureTemplate(
        TEMPLATE_IDS.OTP_FORGET_PASSWORD,
        'Password Reset Code',
        this.getOTPTemplate('forget-password')
      );
      await this.delay(600);

      // Create organization invitation template
      await this.ensureTemplate(
        TEMPLATE_IDS.ORGANIZATION_INVITATION,
        'Organization Invitation',
        this.getOrganizationInvitationTemplate()
      );

      logger.info('all email templates initialized');
    } catch (error) {
      logger.error({ err: error }, 'failed to initialize email templates');
      throw error;
    }
  }

  /**
   * Helper to delay execution (for rate limiting)
   */
  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Check if the Resend API key is restricted (send-only)
   */
  private async checkIfApiKeyIsRestricted(): Promise<boolean> {
    try {
      const templates = await resendService.listTemplates({ limit: 1 });
      if (templates.error) {
        const errorMessage = templates.error.message?.toLowerCase() || '';
        // Check if error indicates restricted API key
        if (
          errorMessage.includes('restricted') || 
          errorMessage.includes('only send') ||
          errorMessage.includes('only sending')
        ) {
          return true;
        }
        // If rate limited, assume not restricted and let the rate limiter handle it
        if (errorMessage.includes('too many requests') || errorMessage.includes('rate limit')) {
          return false;
        }
      }
      return false;
    } catch (error: any) {
      const errorMessage = error?.message?.toLowerCase() || '';
      if (
        errorMessage.includes('restricted') || 
        errorMessage.includes('only send') ||
        errorMessage.includes('only sending')
      ) {
        return true;
      }
      // If rate limited, assume not restricted
      if (errorMessage.includes('too many requests') || errorMessage.includes('rate limit')) {
        return false;
      }
      return false;
    }
  }

  /**
   * Ensure a template exists, create it if it doesn't
   */
  private async ensureTemplate(
    templateName: string,
    displayName: string,
    html: string
  ): Promise<string> {
    try {
      // Try to find existing template by listing templates
      const templates = await resendService.listTemplates({ limit: 100 });
      
      // Check for errors first
      if (templates.error) {
        const errorMessage = templates.error.message?.toLowerCase() || '';
        // If restricted, we should have caught this earlier, but handle gracefully
        if (
          errorMessage.includes('restricted') || 
          errorMessage.includes('only send') ||
          errorMessage.includes('only sending')
        ) {
          return '';
        }
        // Handle rate limit errors
        if (errorMessage.includes('too many requests') || errorMessage.includes('rate limit')) {
          logger.warn('rate limit hit while listing templates, retrying');
          await this.delay(1000); // Wait 1 second before retrying
          // Retry once
          const retryTemplates = await resendService.listTemplates({ limit: 100 });
          if (retryTemplates.error) {
            logger.warn({ error: retryTemplates.error.message }, 'error listing templates after retry');
            // Continue to try creating template anyway
          } else if (retryTemplates.data && !retryTemplates.error) {
            const templateList = retryTemplates.data.data;
            const existingTemplate = templateList.find((t) => t.name === templateName);
            if (existingTemplate) {
              logger.debug({ templateName, templateId: existingTemplate.id }, 'template already exists');
              this.templateIdMap.set(templateName, existingTemplate.id);
              return existingTemplate.id;
            }
          }
        } else {
          // For other errors, log and continue
          logger.warn({ error: templates.error.message }, 'error listing templates');
        }
      } else if (templates.data && !templates.error) {
        // TypeScript now knows templates.data is ListTemplatesResponseSuccess
        // Look for template with matching name in the data array
        const templateList = templates.data.data;
        const existingTemplate = templateList.find(
          (t) => t.name === templateName
        );

        if (existingTemplate) {
          logger.debug({ templateName, templateId: existingTemplate.id }, 'template already exists');
          this.templateIdMap.set(templateName, existingTemplate.id);
          return existingTemplate.id;
        }
      }

      // Create new template
      logger.info({ templateName }, 'creating template');
      const result = await resendService.createAndPublishTemplate({
        name: templateName,
        html,
        variables: this.getTemplateVariables(templateName),
      });

      if (result.data?.id) {
        logger.info({ templateName, templateId: result.data.id }, 'template created');
        this.templateIdMap.set(templateName, result.data.id);
        return result.data.id;
      }

      throw new Error(`Failed to create template "${templateName}"`);
    } catch (error: any) {
      const errorMessage = error?.message?.toLowerCase() || '';
      // If restricted, silently return empty (already logged in initializeTemplates)
      if (
        errorMessage.includes('restricted') || 
        errorMessage.includes('only send') ||
        errorMessage.includes('only sending')
      ) {
        return '';
      }
      // Handle rate limit errors
      if (errorMessage.includes('too many requests') || errorMessage.includes('rate limit')) {
        logger.warn({ templateName }, 'rate limit hit, skipping template creation');
        return '';
      }
      logger.error({ err: error, templateName }, 'error ensuring template');
      // Don't throw - allow fallback to inline HTML
      return '';
    }
  }

  /**
   * Get template ID by name
   */
  getTemplateId(templateName: string): string | undefined {
    return this.templateIdMap.get(templateName);
  }

  /**
   * Get OTP email template HTML
   */
  private getOTPTemplate(type: 'sign-in' | 'email-verification' | 'forget-password'): string {
    let heading: string;
    let description: string;
    let footerText: string;

    switch (type) {
      case 'sign-in':
        heading = 'Sign in to Nixopus';
        description = 'Use this code to sign in.';
        footerText = 'If you didn\'t request this login, ignore this email.';
        break;
      case 'email-verification':
        heading = 'Verify your email';
        description = 'Use this code to verify your email address.';
        footerText = 'If you didn\'t request this verification, ignore this email.';
        break;
      case 'forget-password':
        heading = 'Reset your password';
        description = 'Use this code to reset your password.';
        footerText = 'If you didn\'t request a password reset, ignore this email.';
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
                <img src="https://nixopus.com/images/Nixopus_Logo_White_Black_Theme.png" alt="Nixopus" width="140" style="display: block;" />
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
                      <p style="margin: 0; font-size: 32px; font-weight: 700; color: #f2f2f2; letter-spacing: 8px; font-family: 'SF Mono', 'Fira Code', 'Courier New', monospace; text-align: center;">{{{OTP}}}</p>
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
   * Get organization invitation template HTML
   */
  private getOrganizationInvitationTemplate(): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #333; margin-bottom: 20px;">Organization Invitation</h2>
        <p style="color: #666; font-size: 16px; margin-bottom: 20px;">
          You have been invited to join <strong style="color: #333;">{{{ORGANIZATION_NAME}}}</strong>.
        </p>
        <p style="margin: 30px 0;">
          <a href="{{{INVITATION_URL}}}" style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
            Accept Invitation
          </a>
        </p>
        <p style="color: #999; font-size: 12px; margin-top: 20px;">
          If you didn't expect this invitation, you can safely ignore this email.
        </p>
      </div>
    `;
  }

  /**
   * Get template variables for a given template
   */
  private getTemplateVariables(templateName: string) {
    switch (templateName) {
      case TEMPLATE_IDS.OTP_SIGN_IN:
      case TEMPLATE_IDS.OTP_EMAIL_VERIFICATION:
      case TEMPLATE_IDS.OTP_FORGET_PASSWORD:
        return [
          {
            key: 'OTP',
            type: 'string' as const,
            fallbackValue: '000000',
          },
        ];
      case TEMPLATE_IDS.ORGANIZATION_INVITATION:
        return [
          {
            key: 'ORGANIZATION_NAME',
            type: 'string' as const,
            fallbackValue: 'Organization',
          },
          {
            key: 'INVITATION_URL',
            type: 'string' as const,
            fallbackValue: '',
          },
        ];
      default:
        return [];
    }
  }
}

// Export a singleton instance
export const templateManager = new TemplateManager();
