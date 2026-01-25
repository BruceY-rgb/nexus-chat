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
    const query = searchParams.get('query');
    const channelId = searchParams.get('channelId');
    const dmConversationId = searchParams.get('dmConversationId');

    if (!query || query.trim() === '') {
      return NextResponse.json(
        { error: '搜索关键词不能为空' },
        { status: 400 }
      );
    }

    // 检查是否同时提供了channelId和dmConversationId
    if (channelId && dmConversationId) {
      return NextResponse.json(
        { error: '不能同时指定频道ID和私聊ID' },
        { status: 400 }
      );
    }

    let results: any[] = [];

    if (channelId) {
      // 验证用户是否加入了该频道
      const membership = await prisma.channelMember.findFirst({
        where: {
          userId: currentUserId,
          channelId: channelId
        }
      });

      if (!membership) {
        return NextResponse.json(
          { error: '您尚未加入该频道' },
          { status: 403 }
        );
      }

      // 只在指定频道中搜索
      const messages = await prisma.message.findMany({
        where: {
          content: {
            contains: query,
            mode: 'insensitive'
          },
          channelId: channelId,
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
        take: 50
      });

      results = messages.map(message => {
        if (!message.channel) {
          return null;
        }
        return {
          id: message.id,
          content: message.content,
          createdAt: message.createdAt,
          user: message.user,
          channel: {
            id: message.channel.id,
            name: message.channel.name
          },
          type: 'channel' as const
        };
      }).filter(Boolean);

    } else if (dmConversationId) {
      // 验证用户是否参与该私聊
      const membership = await prisma.dMConversationMember.findFirst({
        where: {
          userId: currentUserId,
          conversationId: dmConversationId
        }
      });

      if (!membership) {
        return NextResponse.json(
          { error: '您尚未参与该私聊' },
          { status: 403 }
        );
      }

      // 只在指定私聊中搜索
      const messages = await prisma.message.findMany({
        where: {
          content: {
            contains: query,
            mode: 'insensitive'
          },
          dmConversationId: dmConversationId,
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
        take: 50
      });

      results = messages.map(message => {
        if (!message.dmConversation) {
          return null;
        }

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
          type: 'dm' as const
        };
      }).filter(Boolean);

    } else {
      // 如果没有指定channelId或dmConversationId，返回错误
      return NextResponse.json(
        { error: '必须指定频道ID或私聊ID' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      query,
      results,
      total: results.length
    });

  } catch (error) {
    console.error('搜索消息时发生错误:', error);
    return NextResponse.json(
      { error: '内部服务器错误' },
      { status: 500 }
    );
  }
}