import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { unauthorizedResponse } from '@/lib/api-response';

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

    const currentUserId = decoded.userId;
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('query');

    if (!query || query.trim() === '') {
      return NextResponse.json(
        { error: '搜索关键词不能为空' },
        { status: 400 }
      );
    }

    // Get user's joined channels列表
    const channelMemberships = await prisma.channelMember.findMany({
      where: { userId: currentUserId },
      select: { channelId: true }
    });

    const joinedChannelIds = channelMemberships.map(m => m.channelId);

    // 获取用户参与的 DM 会话列表
    const dmMemberships = await prisma.dMConversationMember.findMany({
      where: { userId: currentUserId },
      select: { conversationId: true }
    });

    const joinedDmConversationIds = dmMemberships.map(m => m.conversationId);

    // 执行搜索：同时搜索频道消息和 DM 消息
    const [channelMessages, dmMessages] = await Promise.all([
      // 搜索频道消息
      prisma.message.findMany({
        where: {
          content: {
            contains: query,
            mode: 'insensitive'
          },
          channelId: {
            in: joinedChannelIds
          },
          dmConversationId: null,
          deletedAt: null
        },
        include: {
          user: {
            select: {
              id: true,
              displayName: true,
              avatarUrl: true
            }
          },
          channel: {
            select: {
              id: true,
              name: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        },
        take: 50 // 限制返回数量
      }),
      // 搜索 DM 消息
      prisma.message.findMany({
        where: {
          content: {
            contains: query,
            mode: 'insensitive'
          },
          dmConversationId: {
            in: joinedDmConversationIds
          },
          channelId: null,
          deletedAt: null
        },
        include: {
          user: {
            select: {
              id: true,
              displayName: true,
              avatarUrl: true
            }
          },
          dmConversation: {
            select: {
              id: true,
              members: {
                select: {
                  user: {
                    select: {
                      id: true,
                      displayName: true
                    }
                  }
                }
              }
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        },
        take: 50 // 限制返回数量
      })
    ]);

    // 格式化搜索结果
    const formatChannelMessage = (message: any) => ({
      id: message.id,
      content: message.content,
      createdAt: message.createdAt,
      user: message.user,
      channel: {
        id: message.channel.id,
        name: message.channel.name
      },
      type: 'channel'
    });

    const formatDmMessage = (message: any) => {
      // 获取对话中的其他成员
      const otherMembers = message.dmConversation.members
        .filter((m: any) => m.user.id !== currentUserId)
        .map((m: any) => m.user);

      return {
        id: message.id,
        content: message.content,
        createdAt: message.createdAt,
        user: message.user,
        dmConversation: {
          id: message.dmConversation.id,
          participants: otherMembers
        },
        type: 'dm'
      };
    };

    // 合并并排序搜索结果
    const results = [
      ...channelMessages.map(formatChannelMessage),
      ...dmMessages.map(formatDmMessage)
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return NextResponse.json({
      query,
      results,
      total: results.length
    });

  } catch (error) {
    console.error('Error occurred while searching messages:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}