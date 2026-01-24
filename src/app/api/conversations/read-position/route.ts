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
    const { searchParams } = new URL(request.url);
    const channelId = searchParams.get('channelId');
    const dmConversationId = searchParams.get('dmConversationId');

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

    let readPosition;

    // 获取频道阅读位置
    if (channelId) {
      // 验证用户是否是频道成员
      const channelMember = await prisma.channelMember.findFirst({
        where: {
          channelId,
          userId: currentUserId
        },
        select: {
          lastReadAt: true,
          lastReadMessageId: true
        }
      });

      if (!channelMember) {
        return NextResponse.json(
          { error: 'You are not a member of this channel' },
          { status: 403 }
        );
      }

      readPosition = {
        lastReadAt: channelMember.lastReadAt,
        lastReadMessageId: channelMember.lastReadMessageId
      };
    }

    // 获取 DM 会话阅读位置
    if (dmConversationId) {
      // 验证用户是否是 DM 会话成员
      const conversationMember = await prisma.dMConversationMember.findFirst({
        where: {
          conversationId: dmConversationId,
          userId: currentUserId
        },
        select: {
          lastReadAt: true,
          lastReadMessageId: true
        }
      });

      if (!conversationMember) {
        return NextResponse.json(
          { error: 'You are not a member of this conversation' },
          { status: 403 }
        );
      }

      readPosition = {
        lastReadAt: conversationMember.lastReadAt,
        lastReadMessageId: conversationMember.lastReadMessageId
      };
    }

    return NextResponse.json({
      success: true,
      ...readPosition
    });
  } catch (error) {
    console.error('Error getting read position:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
