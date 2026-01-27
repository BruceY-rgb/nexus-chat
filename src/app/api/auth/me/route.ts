// =====================================================
// 获取当前用户信息 API
// GET /api/auth/me
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { successResponse, errorResponse, unauthorizedResponse } from '@/lib/api-response';

export async function GET(request: NextRequest) {
  try {
    // 优先使用 httpOnly token, 备用 ws_token
    const token = request.cookies.get('auth_token')?.value || request.cookies.get('ws_token')?.value;

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

    // 更新在线状态
    await prisma.user.update({
      where: { id: user.id },
      data: {
        isOnline: true,
        lastSeenAt: new Date(),
      },
    });

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
    console.error('获取用户信息错误:', error);
    return NextResponse.json(
      errorResponse('Failed to get user information'),
      { status: 500 }
    );
  }
}