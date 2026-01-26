import { resendService } from './resend.js';

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
    console.log('Initializing Resend email templates...');

    // Check if API key is restricted (can only send emails, not manage templates)
    const isRestricted = await this.checkIfApiKeyIsRestricted();
    if (isRestricted) {
      console.log('⚠️  Resend API key is restricted to sending emails only. Templates will not be initialized.');
      console.log('   Emails will use inline HTML instead. To use templates, upgrade to a full-access API key.');
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

      console.log('All email templates initialized successfully');
    } catch (error) {
      console.error('Failed to initialize email templates:', error);
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
          console.warn(`Rate limit hit while listing templates. Retrying after delay...`);
          await this.delay(1000); // Wait 1 second before retrying
          // Retry once
          const retryTemplates = await resendService.listTemplates({ limit: 100 });
          if (retryTemplates.error) {
            console.warn(`Error listing templates after retry: ${retryTemplates.error.message}`);
            // Continue to try creating template anyway
          } else if (retryTemplates.data && !retryTemplates.error) {
            const templateList = retryTemplates.data.data;
            const existingTemplate = templateList.find((t) => t.name === templateName);
            if (existingTemplate) {
              console.log(`Template "${templateName}" already exists (ID: ${existingTemplate.id})`);
              this.templateIdMap.set(templateName, existingTemplate.id);
              return existingTemplate.id;
            }
          }
        } else {
          // For other errors, log and continue
          console.warn(`Error listing templates: ${templates.error.message}`);
        }
      } else if (templates.data && !templates.error) {
        // TypeScript now knows templates.data is ListTemplatesResponseSuccess
        // Look for template with matching name in the data array
        const templateList = templates.data.data;
        const existingTemplate = templateList.find(
          (t) => t.name === templateName
        );

        if (existingTemplate) {
          console.log(`Template "${templateName}" already exists (ID: ${existingTemplate.id})`);
          this.templateIdMap.set(templateName, existingTemplate.id);
          return existingTemplate.id;
        }
      }

      // Create new template
      console.log(`Creating template "${templateName}"...`);
      const result = await resendService.createAndPublishTemplate({
        name: templateName,
        html,
        variables: this.getTemplateVariables(templateName),
      });

      if (result.data?.id) {
        console.log(`Template "${templateName}" created successfully (ID: ${result.data.id})`);
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
        console.warn(`Rate limit hit while ensuring template "${templateName}". Skipping template creation.`);
        return '';
      }
      console.error(`Error ensuring template "${templateName}":`, error);
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
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #333; margin-bottom: 20px;">${title}</h2>
        <p style="color: #666; font-size: 16px; margin-bottom: 20px;">${description}</p>
        <div style="background-color: #f4f4f4; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 5px; margin: 20px 0; border-radius: 8px;">
          {{{OTP}}}
        </div>
        <p style="color: #666; font-size: 14px; margin-bottom: 10px;">This code will expire in 5 minutes.</p>
        <p style="color: #999; font-size: 12px; margin-top: 20px;">${footerText}</p>
      </div>
    `;
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
