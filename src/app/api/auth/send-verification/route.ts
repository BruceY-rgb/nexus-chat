// =====================================================
// 发送邮箱验证码 API
// POST /api/auth/send-verification
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { validateInput, sendVerificationSchema } from '@/lib/validation';
import { successResponse, errorResponse, validationErrorResponse } from '@/lib/api-response';
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

    // TODO: 实际发送邮件
    // 这里应该集成真实的邮件服务，如 SendGrid、AWS SES 或 Nodemailer
    console.log(`发送验证码到 ${email}: ${verificationCode}`);

    // 在开发环境中，直接返回验证码（仅用于测试）
    if (process.env.NODE_ENV === 'development') {
      console.log(`开发模式：验证码为 ${verificationCode}`);
    }

    return NextResponse.json(
      successResponse(
        {
          email,
          // 开发环境返回验证码，生产环境不返回
          ...(process.env.NODE_ENV === 'development' && { code: verificationCode }),
        },
        '验证码已发送'
      )
    );
  } catch (error) {
    console.error('发送验证码错误:', error);
    return NextResponse.json(
      errorResponse('发送验证码失败，请稍后重试'),
      { status: 500 }
    );
  }
}
