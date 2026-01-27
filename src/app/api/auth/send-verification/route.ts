// =====================================================
// 发送邮箱验证码 API
// POST /api/auth/send-verification
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { validateInput, sendVerificationSchema } from '@/lib/validation';
import { successResponse, errorResponse, validationErrorResponse } from '@/lib/api-response';
import { sendVerificationEmail, isEmailServiceReady } from '@/lib/email-service';
import { checkEmailRateLimit, checkIPRateLimit, getEmailSendStatus } from '@/lib/rate-limiter';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // 验证输入
    const validation = validateInput(sendVerificationSchema, body);
    if (!validation.success) {
      return NextResponse.json(
        validationErrorResponse(validation.errors),
        { status: 400 }
      );
    }

    const { email } = validation.data;

    // 获取客户端IP
    const clientIP = request.ip || request.headers.get('x-forwarded-for') || 'unknown';

    // 检查IP频率限制
    const ipLimitResult = checkIPRateLimit(clientIP);
    if (!ipLimitResult.allowed) {
      console.warn(`⚠️  IP频率限制触发: ${clientIP}`);
      return NextResponse.json(
        errorResponse('Request too frequent, please try again later', 'IP_RATE_LIMIT_EXCEEDED'),
        { status: 429 }
      );
    }

    // 检查邮箱频率限制
    const emailLimitResult = checkEmailRateLimit(email);
    if (!emailLimitResult.allowed) {
      console.warn(`⚠️  邮箱频率限制触发: ${email}`);
      return NextResponse.json(
        errorResponse('Sending verification code too frequent, please try again later', 'EMAIL_RATE_LIMIT_EXCEEDED'),
        { status: 429 }
      );
    }

    // 查找用户
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return NextResponse.json(
        errorResponse('用户不存在', 'USER_NOT_FOUND'),
        { status: 404 }
      );
    }

    if (user.status !== 'active') {
      return NextResponse.json(
        errorResponse('账户已被禁用', 'ACCOUNT_DISABLED'),
        { status: 403 }
      );
    }

    // 生成6位验证码
    const verificationCode = crypto.randomInt(100000, 999999).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5分钟后过期

    // 更新用户的验证码
    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerificationCode: verificationCode,
        emailCodeExpiresAt: expiresAt,
      },
    });

    // 检查邮件服务是否已配置
    if (!isEmailServiceReady()) {
      console.error('❌ 邮件服务未配置');
      return NextResponse.json(
        errorResponse('Email service not configured, please contact administrator', 'EMAIL_SERVICE_NOT_CONFIGURED'),
        { status: 500 }
      );
    }

    // 发送验证码邮件
    console.log(`📧 发送验证码到 ${email}: ${verificationCode}`);

    const emailResult = await sendVerificationEmail({
      to: email,
      email,
      code: verificationCode,
    });

    if (!emailResult.success) {
      console.error('❌ 邮件发送失败:', emailResult.error);
      return NextResponse.json(
        errorResponse('Failed to send verification code, please try again later', 'EMAIL_SEND_FAILED'),
        { status: 500 }
      );
    }

    console.log('✅ 验证码邮件发送成功:', emailResult.messageId);

    // 在开发环境中，返回验证码方便测试
    if (process.env.NODE_ENV === 'development') {
      console.log(`开发模式：验证码为 ${verificationCode}`);
    }

    const responseData: any = {
      email,
      message: '验证码已发送',
    };

    // 开发环境返回验证码方便测试
    if (process.env.NODE_ENV === 'development') {
      responseData.code = verificationCode;
    }

    return NextResponse.json(
      successResponse(responseData, '验证码已发送')
    );
  } catch (error) {
    console.error('发送验证码错误:', error);
    return NextResponse.json(
      errorResponse('Failed to send verification code, please try again later'),
      { status: 500 }
    );
  }
}
