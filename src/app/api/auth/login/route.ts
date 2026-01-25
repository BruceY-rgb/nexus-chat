// =====================================================
// 用户登录 API（支持密码或验证码登录）
// POST /api/auth/login
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyPassword, generateToken, createUserSession } from '@/lib/auth';
import { validateInput, loginSchema, verificationLoginSchema } from '@/lib/validation';
import { successResponse, errorResponse, validationErrorResponse } from '@/lib/api-response';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const loginType = body.code ? 'verification' : 'password';

    let validation;

    // 根据登录类型验证输入
    if (loginType === 'password') {
      validation = validateInput(loginSchema, body);
      if (!validation.success) {
        return NextResponse.json(
          validationErrorResponse(validation.errors),
          { status: 400 }
        );
      }
    } else {
      validation = validateInput(verificationLoginSchema, body);
      if (!validation.success) {
        return NextResponse.json(
          validationErrorResponse(validation.errors),
          { status: 400 }
        );
      }
    }

    const { email } = validation.data;
    const passwordOrCode = loginType === 'password' ? body.password : body.code;

    // 查找用户
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        teamMemberships: true,
        notificationSettings: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        errorResponse('邮箱或密码错误', 'INVALID_CREDENTIALS'),
        { status: 401 }
      );
    }

    // 检查用户状态
    if (user.status !== 'active') {
      return NextResponse.json(
        errorResponse('账户已被禁用，请联系管理员', 'ACCOUNT_DISABLED'),
        { status: 403 }
      );
    }

    // 验证登录凭据
    if (loginType === 'password') {
      // 密码登录
      if (!user.passwordHash) {
        return NextResponse.json(
          errorResponse('该账户未设置密码，请使用验证码登录', 'NO_PASSWORD'),
          { status: 401 }
        );
      }

      const isValidPassword = await verifyPassword(passwordOrCode, user.passwordHash);
      if (!isValidPassword) {
        return NextResponse.json(
          errorResponse('邮箱或密码错误', 'INVALID_CREDENTIALS'),
          { status: 401 }
        );
      }
    } else {
      // 验证码登录
      if (!user.emailVerificationCode || !user.emailCodeExpiresAt) {
        return NextResponse.json(
          errorResponse('未发送验证码，请先获取验证码', 'NO_VERIFICATION_CODE'),
          { status: 401 }
        );
      }

      if (new Date() > user.emailCodeExpiresAt) {
        return NextResponse.json(
          errorResponse('验证码已过期，请重新获取', 'CODE_EXPIRED'),
          { status: 401 }
        );
      }

      if (user.emailVerificationCode !== passwordOrCode) {
        return NextResponse.json(
          errorResponse('验证码错误', 'INVALID_CODE'),
          { status: 401 }
        );
      }

      // 验证码使用后立即清除
      await prisma.user.update({
        where: { id: user.id },
        data: {
          emailVerificationCode: null,
          emailCodeExpiresAt: null,
        },
      });
    }

    // 更新在线状态
    await prisma.user.update({
      where: { id: user.id },
      data: {
        isOnline: true,
        lastSeenAt: new Date(),
      },
    });

    // 生成 token 和会话
    const token = generateToken(user.id);
    const userAgent = request.headers.get('user-agent') || undefined;
    const ipAddress = request.ip || request.headers.get('x-forwarded-for') || undefined;

    await createUserSession(user.id, token, ipAddress, userAgent);

    // 返回用户信息（不包含密码）
    const response = NextResponse.json(
      successResponse(
        {
          user: {
            id: user.id,
            email: user.email,
            displayName: user.displayName,
            realName: user.realName,
            avatarUrl: user.avatarUrl,
            status: user.status,
            role: user.teamMemberships?.role || 'member',
            isOnline: true,
            notificationSettings: user.notificationSettings,
          },
        },
        '登录成功'
      )
    );

    // 设置 cookie (httpOnly, 用于 API 认证)
    response.cookies.set('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7天
      path: '/',
    });

    // 同时设置一个非 httpOnly 的 token 供 WebSocket 使用
    response.cookies.set('ws_token', token, {
      httpOnly: false, // JavaScript 可以访问
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7天
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('登录错误:', error);
    return NextResponse.json(
      errorResponse('登录失败，请稍后重试'),
      { status: 500 }
    );
  }
}