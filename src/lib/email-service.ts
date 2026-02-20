// =====================================================
// Email Service
// Send verification emails using Resend API
// =====================================================

import { Resend } from 'resend';
import {
  generateVerificationEmailHTML,
  generateVerificationEmailText,
  getVerificationEmailSubject,
} from './email-templates';

// Email configuration
interface EmailConfig {
  from: string;
  replyTo?: string;
  appName?: string;
}

// Verification email data
interface VerificationEmailData {
  to: string;
  email: string;
  code: string;
  appName?: string;
}

// Email result
interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

// Initialize Resend client
function getResendClient(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    console.error('RESEND_API_KEY environment variable is not configured');
    return null;
  }

  try {
    return new Resend(apiKey);
  } catch (error) {
    console.error('Failed to initialize Resend client:', error);
    return null;
  }
}

/**
 * Get email configuration
 */
function getEmailConfig(): EmailConfig {
  const from = process.env.EMAIL_FROM || 'Slack Chat App <noreply@your-domain.com>';
  const replyTo = process.env.EMAIL_REPLY_TO;
  const appName = process.env.APP_NAME || 'Slack Chat App';

  return { from, replyTo, appName };
}

/**
 * Send verification email
 */
export async function sendVerificationEmail(data: VerificationEmailData): Promise<EmailResult> {
  const resend = getResendClient();

  if (!resend) {
    return {
      success: false,
      error: 'Email service is not properly configured',
    };
  }

  const { to, email, code } = data;
  const config = getEmailConfig();

  try {
    console.log(`Preparing to send verification email to: ${email}`);

    const htmlContent = generateVerificationEmailHTML({
      email,
      code,
      appName: config.appName,
    });

    const textContent = generateVerificationEmailText({
      email,
      code,
      appName: config.appName,
    });

    const subject = getVerificationEmailSubject(config.appName);

    const emailOptions: any = {
      from: config.from,
      to,
      subject,
      html: htmlContent,
      text: textContent,
    };

    // Add reply address (if available)
    if (config.replyTo) {
      emailOptions.reply_to = config.replyTo;
    }

    const response = await resend.emails.send(emailOptions);

    console.log('Email sent successfully:', response);

    if (response.error) {
      console.error('Resend API returned error:', response.error);
      return {
        success: false,
        error: response.error.message || 'Failed to send email',
      };
    }

    return {
      success: true,
      messageId: response.data?.id,
    };
  } catch (error: any) {
    console.error('Failed to send verification email:', error);
    return {
      success: false,
      error: error?.message || 'Failed to send email',
    };
  }
}

/**
 * Validate email address format (simple validation)
 */
export function validateEmailAddress(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Sanitize email address (remove whitespace, etc.)
 */
export function sanitizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Check if email can be sent (based on environment configuration)
 */
export function isEmailServiceReady(): boolean {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    console.warn('RESEND_API_KEY is not configured, cannot send emails');
    return false;
  }

  return true;
}
