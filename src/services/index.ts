/**
 * Services module exports
 * 
 * This module exports all service classes and instances for easy importing
 */

export { ResendService, resendService, type CreateTemplateParams, type UpdateTemplateParams, type ListTemplatesParams, type SendEmailParams, type TemplateVariable } from './resend.js';
export { EmailService, emailService, type SendOTPEmailParams, type SendInvitationEmailParams } from './email.js';
export { TemplateManager, templateManager, TEMPLATE_IDS } from './templates.js';
