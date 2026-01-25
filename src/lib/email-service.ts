// =====================================================
// 邮件发送服务
// 使用 Resend API 发送验证码邮件
// =====================================================

import { Resend } from 'resend';
import {
  generateVerificationEmailHTML,
  generateVerificationEmailText,
  getVerificationEmailSubject,
} from './email-templates';

// 邮件发送配置
interface EmailConfig {
  from: string;
  replyTo?: string;
  appName?: string;
}

// 验证码邮件数据
interface VerificationEmailData {
  to: string;
  email: string;
  code: string;
  appName?: string;
}

// 邮件发送结果
interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

// 初始化 Resend 客户端
function getResendClient(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    console.error('❌ RESEND_API_KEY 环境变量未配置');
    return null;
  }

  try {
    return new Resend(apiKey);
  } catch (error) {
    console.error('❌ Resend 客户端初始化失败:', error);
    return null;
  }
}

/**
 * 获取邮件配置
 */
function getEmailConfig(): EmailConfig {
  const from = process.env.EMAIL_FROM || 'Slack聊天应用 <noreply@your-domain.com>';
  const replyTo = process.env.EMAIL_REPLY_TO;
  const appName = process.env.APP_NAME || 'Slack聊天应用';

  return { from, replyTo, appName };
}

/**
 * 发送验证码邮件
 */
export async function sendVerificationEmail(data: VerificationEmailData): Promise<EmailResult> {
  const resend = getResendClient();

  if (!resend) {
    return {
      success: false,
      error: '邮件服务未正确配置',
    };
  }

  const { to, email, code } = data;
  const config = getEmailConfig();

  try {
    console.log(`📧 准备发送验证码邮件到: ${email}`);

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

    // 添加回复地址（如果有）
    if (config.replyTo) {
      emailOptions.reply_to = config.replyTo;
    }

    const response = await resend.emails.send(emailOptions);

    console.log('✅ 邮件发送成功:', response);

    if (response.error) {
      console.error('❌ Resend API 返回错误:', response.error);
      return {
        success: false,
        error: response.error.message || '邮件发送失败',
      };
    }

    return {
      success: true,
      messageId: response.data?.id,
    };
  } catch (error: any) {
    console.error('❌ 发送验证码邮件失败:', error);
    return {
      success: false,
      error: error?.message || '邮件发送失败',
    };
  }
}

/**
 * 验证邮件地址格式（简单验证）
 */
export function validateEmailAddress(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * 清理邮箱地址（移除空格等）
 */
export function sanitizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * 检查是否可以发送邮件（基于环境配置）
 */
export function isEmailServiceReady(): boolean {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    console.warn('⚠️  RESEND_API_KEY 未配置，无法发送邮件');
    return false;
  }

  return true;
}
