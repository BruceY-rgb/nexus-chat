import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { unauthorizedResponse } from '@/lib/api-response';

// 全部已读 API
export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('auth_token')?.value;

    if (!token) {
      return NextResponse.json(
        unauthorizedResponse(),
        { status: 401 }
      );
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return NextResponse.json(
        unauthorizedResponse('token无效'),
        { status: 401 }
      );
    }

    const currentUserId = decoded.userId;
    const now = new Date();

    // 获取用户的所有频道成员记录（有未读消息的）
    const channelMembers = await prisma.channelMember.findMany({
      where: {
        userId: currentUserId,
        unreadCount: { gt: 0 }
      },
      select: {
        id: true,
        channelId: true,
        channel: {
          select: {
            name: true
          }
        }
      }
    });

    // 获取用户的所有 DM 成员记录（有未读消息的）
    const dmMembers = await prisma.dMConversationMember.findMany({
      where: {
        userId: currentUserId,
        unreadCount: { gt: 0 }
      },
      select: {
        id: true,
        conversationId: true,
        conversation: {
          select: {
            id: true
          }
        }
      }
    });

    // 获取每个 DM 会话的最新消息
    const dmConversationIds = dmMembers.map(m => m.conversationId);
    const latestDmMessages = await prisma.message.findMany({
      where: {
        dmConversationId: { in: dmConversationIds }
      },
      orderBy: {
        createdAt: 'desc'
      },
      distinct: ['dmConversationId'],
      select: {
        id: true,
        dmConversationId: true
      }
    });

    const latestDmMessageMap = new Map(
      latestDmMessages.map(m => [m.dmConversationId, m.id])
    );

    // 批量更新频道成员已读状态
    if (channelMembers.length > 0) {
      await prisma.channelMember.updateMany({
        where: {
          id: { in: channelMembers.map(m => m.id) }
        },
        data: {
          lastReadAt: now,
          unreadCount: 0
        }
      });
    }

    // 批量更新 DM 成员已读状态
    if (dmMembers.length > 0) {
      const updates = dmMembers.map(member => {
        const lastReadMessageId = latestDmMessageMap.get(member.conversationId);
        return prisma.dMConversationMember.update({
          where: {
            id: member.id
          },
          data: {
            lastReadAt: now,
            unreadCount: 0,
            lastReadMessageId
          }
        });
      });
      await prisma.$transaction(updates);
    }

    const totalMarked = channelMembers.length + dmMembers.length;

    return NextResponse.json({
      message: 'All messages marked as read',
      channelsMarkedRead: channelMembers.length,
      conversationsMarkedRead: dmMembers.length,
      totalMarked
    });
  } catch (error) {
    console.error('Error marking all as read:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
