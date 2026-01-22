import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { unauthorizedResponse } from '@/lib/api-response';
import { Server as SocketIOServer } from 'socket.io';

export async function POST(request: NextRequest) {
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
    const body = await request.json();
    const { channelId, dmConversationId } = body;

    // 验证：必须指定 channelId 或 dmConversationId 中的一个，但不能同时指定
    if (!channelId && !dmConversationId) {
      return NextResponse.json(
        { error: 'Must specify either channelId or dmConversationId' },
        { status: 400 }
      );
    }

    if (channelId && dmConversationId) {
      return NextResponse.json(
        { error: 'Cannot specify both channelId and dmConversationId' },
        { status: 400 }
      );
    }

    const now = new Date();

    // 清除频道未读计数
    if (channelId) {
      // 验证用户是否是频道成员
      const channelMember = await prisma.channelMember.findFirst({
        where: {
          channelId,
          userId: currentUserId
        }
      });

      if (!channelMember) {
        return NextResponse.json(
          { error: 'You are not a member of this channel' },
          { status: 403 }
        );
      }

      // 更新频道成员的未读计数和最后阅读时间
      await prisma.channelMember.update({
        where: {
          channelId_userId: {
            channelId,
            userId: currentUserId
          }
        },
        data: {
          unreadCount: 0,
          lastReadAt: now
        }
      });

      // 广播未读计数更新
      if (typeof (global as any).io !== 'undefined') {
        const ioInstance = (global as any).io as SocketIOServer;
        ioInstance.to(`user:${currentUserId}`).emit('unread-count-update', {
          channelId,
          unreadCount: 0
        });
      }

      return NextResponse.json({
        success: true,
        channelId,
        unreadCount: 0
      });
    }

    // 清除 DM 未读计数
    if (dmConversationId) {
      // 验证用户是否是 DM 会话成员
      const conversationMember = await prisma.dMConversationMember.findFirst({
        where: {
          conversationId: dmConversationId,
          userId: currentUserId
        }
      });

      if (!conversationMember) {
        return NextResponse.json(
          { error: 'You are not a member of this conversation' },
          { status: 403 }
        );
      }

      // 更新 DM 成员的未读计数和最后阅读时间
      await prisma.dMConversationMember.update({
        where: {
          conversationId_userId: {
            conversationId: dmConversationId,
            userId: currentUserId
          }
        },
        data: {
          unreadCount: 0,
          lastReadAt: now
        }
      });

      // 广播未读计数更新
      if (typeof (global as any).io !== 'undefined') {
        const ioInstance = (global as any).io as SocketIOServer;
        ioInstance.to(`user:${currentUserId}`).emit('unread-count-update', {
          dmConversationId,
          unreadCount: 0
        });
      }

      return NextResponse.json({
        success: true,
        dmConversationId,
        unreadCount: 0
      });
    }

    return NextResponse.json({
      success: false,
      error: 'Invalid request'
    }, { status: 400 });
  } catch (error) {
    console.error('Error marking messages as read:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
