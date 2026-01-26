import { Resend } from 'resend';
import { config } from '../config.js';

// Lazy initialization of Resend client
let resendInstance: Resend | null = null;

function getResendClient(): Resend {
  if (!resendInstance) {
    // Read directly from process.env to ensure we get the latest value after secrets are loaded
    const apiKey = process.env.RESEND_API_KEY || config.resendApiKey;
    if (!apiKey) {
      throw new Error('RESEND_API_KEY is not configured. Please set it in your environment variables or secret manager.');
    }
    resendInstance = new Resend(apiKey);
  }
  return resendInstance;
}

export type TemplateVariable =
  | {
      key: string;
      type: 'string';
      fallbackValue?: string | null;
    }
  | {
      key: string;
      type: 'number';
      fallbackValue?: number | null;
    };

export interface CreateTemplateParams {
  name: string;
  html: string;
  variables?: TemplateVariable[];
}

export interface UpdateTemplateParams {
  name?: string;
  html?: string;
}

export interface ListTemplatesParams {
  limit?: number;
  after?: string;
}

export interface SendEmailParams {
  from: string;
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  template?: {
    id: string;
    variables?: Record<string, string | number>;
  };
}

/**
 * Resend service for managing email templates and sending emails
 */
export class ResendService {
  /**
   * Create a new email template
   */
  async createTemplate(params: CreateTemplateParams) {
    return await getResendClient().templates.create({
      name: params.name,
      html: params.html,
      variables: params.variables,
    });
  }

  /**
   * Create and publish a template in one step
   */
  async createAndPublishTemplate(params: CreateTemplateParams) {
    return await getResendClient().templates.create({
      name: params.name,
      html: params.html,
      variables: params.variables,
    }).publish();
  }

  /**
   * Get a template by ID
   */
  async getTemplate(templateId: string) {
    return await getResendClient().templates.get(templateId);
  }

  /**
   * Update a template
   */
  async updateTemplate(templateId: string, params: UpdateTemplateParams) {
    return await getResendClient().templates.update(templateId, {
      name: params.name,
      html: params.html,
    });
  }

  /**
   * Publish a template
   */
  async publishTemplate(templateId: string) {
    return await getResendClient().templates.publish(templateId);
  }

  /**
   * Duplicate a template
   */
  async duplicateTemplate(templateId: string) {
    return await getResendClient().templates.duplicate(templateId);
  }

  /**
   * Delete a template
   */
  async deleteTemplate(templateId: string) {
    return await getResendClient().templates.remove(templateId);
  }

  /**
   * List all templates
   */
  async listTemplates(params?: ListTemplatesParams) {
    return await getResendClient().templates.list({
      limit: params?.limit,
      after: params?.after,
    });
  }

  /**
   * Send an email
   */
  async sendEmail(params: SendEmailParams) {
    const resend = getResendClient();
    if (params.template) {
      // Send email using a template
      return await resend.emails.send({
        from: params.from,
        to: params.to,
        subject: params.subject,
        template: {
          id: params.template.id,
          variables: params.template.variables,
        },
      });
    } else {
      // Send email with direct HTML/text content
      // At least one of html or text must be provided
      if (!params.html && !params.text) {
        throw new Error('Either html or text must be provided when not using a template');
      }
      
      // Build payload ensuring at least one of html or text is defined
      if (params.html && params.text) {
        return await resend.emails.send({
          from: params.from,
          to: params.to,
          subject: params.subject,
          html: params.html,
          text: params.text,
        });
      } else if (params.html) {
        return await resend.emails.send({
          from: params.from,
          to: params.to,
          subject: params.subject,
          html: params.html,
        });
      } else {
        // params.text is guaranteed to exist here due to the check above
        const textValue = params.text!;
        return await resend.emails.send({
          from: params.from,
          to: params.to,
          subject: params.subject,
          text: textValue,
        });
      }
    }
  }
}

// Export a singleton instance
export const resendService = new ResendService();
