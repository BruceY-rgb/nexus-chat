import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { unauthorizedResponse } from '@/lib/api-response';

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

    const currentUserId = decoded.userId;

    // 获取频道未读计数
    const channelUnreads = await prisma.channelMember.findMany({
      where: {
        userId: currentUserId
      },
      select: {
        channelId: true,
        unreadCount: true
      }
    });

    // 获取 DM 未读计数
    const dmUnreads = await prisma.dMConversationMember.findMany({
      where: {
        userId: currentUserId
      },
      select: {
        conversationId: true,
        unreadCount: true
      }
    });

    // 合并结果
    const unreadMap: Record<string, number> = {};

    // 添加频道未读计数
    channelUnreads.forEach(({ channelId, unreadCount }) => {
      if (unreadCount > 0) {
        unreadMap[channelId] = unreadCount;
      }
    });

    // 添加 DM 未读计数
    dmUnreads.forEach(({ conversationId, unreadCount }) => {
      if (unreadCount > 0) {
        unreadMap[conversationId] = unreadCount;
      }
    });

    return NextResponse.json(unreadMap);
  } catch (error) {
    console.error('Error fetching unread counts:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
