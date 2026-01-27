// =====================================================
// 用户注册 API
// POST /api/auth/register
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hashPassword, generateToken, createUserSession } from '@/lib/auth';
import { validateInput, registerSchema } from '@/lib/validation';
import { successResponse, errorResponse, validationErrorResponse } from '@/lib/api-response';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // 验证输入
    const validation = validateInput(registerSchema, body);
    if (!validation.success) {
      return NextResponse.json(
        validationErrorResponse(validation.errors),
        { status: 400 }
      );
    }

    const { email, password, displayName, realName } = validation.data;

    // 检查邮箱是否已存在
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        errorResponse('该邮箱已被注册', 'EMAIL_EXISTS'),
        { status: 409 }
      );
    }

    // 创建用户
    const passwordHash = await hashPassword(password);

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        displayName,
        realName,
        emailVerifiedAt: new Date(),
      },
    });

    // 添加到团队成员
    await prisma.teamMember.create({
      data: {
        userId: user.id,
        role: 'member',
      },
    });

    // 创建默认通知设置
    await prisma.notificationSettings.create({
      data: {
        userId: user.id,
      },
    });

    // 生成 token 和会话
    const token = generateToken(user.id);
    const userAgent = request.headers.get('user-agent') || undefined;
    const ipAddress = request.ip || request.headers.get('x-forwarded-for') || undefined;

    await createUserSession(user.id, token, ipAddress, userAgent);

    // 设置 cookie
    const response = NextResponse.json(
      successResponse(
        {
          user: {
            id: user.id,
            email: user.email,
            displayName: user.displayName,
            realName: user.realName,
            avatarUrl: user.avatarUrl,
          },
        },
        '注册成功'
      ),
      { status: 201 }
    );

    response.cookies.set('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7天
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('注册错误:', error);
    return NextResponse.json(
      errorResponse('Registration failed, please try again later'),
      { status: 500 }
    );
  }
}