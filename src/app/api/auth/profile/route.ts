// =====================================================
// 用户资料管理 API
// GET /api/auth/profile - 获取当前用户资料
// PUT /api/auth/profile - 更新用户资料
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { validateInput, updateProfileSchema } from '@/lib/validation';
import { successResponse, errorResponse, unauthorizedResponse, validationErrorResponse } from '@/lib/api-response';

// 强制动态渲染 - 因为这个API使用了 cookies
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('auth_token')?.value;

    if (!token) {
      return NextResponse.json(
        unauthorizedResponse(),
        { status: 401 }
      );
    }

    // 验证 token
    const decoded = verifyToken(token);
    if (!decoded) {
      return NextResponse.json(
        unauthorizedResponse('token无效'),
        { status: 401 }
      );
    }

    // 获取用户信息
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: {
        teamMemberships: true,
        notificationSettings: true,
      },
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

    return NextResponse.json(
      successResponse({
        user: {
          id: user.id,
          email: user.email,
          displayName: user.displayName,
          realName: user.realName,
          avatarUrl: user.avatarUrl,
          status: user.status,
          role: user.teamMemberships?.role || 'member',
          isOnline: user.isOnline,
          lastSeenAt: user.lastSeenAt,
          timezone: user.timezone,
          notificationSettings: user.notificationSettings,
        },
      })
    );
  } catch (error) {
    console.error('获取用户资料错误:', error);
    return NextResponse.json(
      errorResponse('获取用户资料失败'),
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const token = request.cookies.get('auth_token')?.value;

    if (!token) {
      return NextResponse.json(
        unauthorizedResponse(),
        { status: 401 }
      );
    }

    // 验证 token
    const decoded = verifyToken(token);
    if (!decoded) {
      return NextResponse.json(
        unauthorizedResponse('token无效'),
        { status: 401 }
      );
    }

    const body = await request.json();

    // 验证输入
    const validation = validateInput(updateProfileSchema, body);
    if (!validation.success) {
      return NextResponse.json(
        validationErrorResponse(validation.errors),
        { status: 400 }
      );
    }

    // 更新用户资料
    const updatedUser = await prisma.user.update({
      where: { id: decoded.userId },
      data: {
        displayName: validation.data.displayName,
        realName: validation.data.realName || null,
        avatarUrl: validation.data.avatarUrl || null,
        timezone: validation.data.timezone || 'UTC',
      },
      include: {
        teamMemberships: true,
        notificationSettings: true,
      },
    });

    return NextResponse.json(
      successResponse(
        {
          user: {
            id: updatedUser.id,
            email: updatedUser.email,
            displayName: updatedUser.displayName,
            realName: updatedUser.realName,
            avatarUrl: updatedUser.avatarUrl,
            status: updatedUser.status,
            role: updatedUser.teamMemberships?.role || 'member',
            isOnline: updatedUser.isOnline,
            lastSeenAt: updatedUser.lastSeenAt,
            timezone: updatedUser.timezone,
            notificationSettings: updatedUser.notificationSettings,
          },
        },
        '资料更新成功'
      )
    );
  } catch (error) {
    console.error('更新用户资料错误:', error);
    return NextResponse.json(
      errorResponse('更新用户资料失败'),
      { status: 500 }
    );
  }
}
