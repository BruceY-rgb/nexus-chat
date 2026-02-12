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

    // 获取过滤参数
    const channelId = searchParams.get('channelId');
    const dmConversationId = searchParams.get('dmConversationId');
    const userId = searchParams.get('userId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    // 检查是否需要执行搜索：需要有关键词或有过滤条件
    if ((!query || query.trim() === '') && !channelId && !dmConversationId && !userId && !startDate && !endDate) {
      return NextResponse.json(
        { error: '请提供搜索关键词或过滤条件' },
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

    // 构建时间过滤条件
    const dateFilter: {
      gte?: Date;
      lte?: Date;
    } = {};
    if (startDate) {
      dateFilter.gte = new Date(startDate);
    }
    if (endDate) {
      dateFilter.lte = new Date(endDate);
    }

    // 构建内容搜索条件（支持无关键词查询）
    const contentFilter = query ? {
      content: {
        contains: query,
        mode: 'insensitive' as const
      }
    } : {};

    // 执行搜索：根据是否有channelId或dmConversationId来决定搜索范围
    let channelMessages: any[] = [];
    let dmMessages: any[] = [];

    // 如果指定了channelId，只搜索该频道
    if (channelId) {
      channelMessages = await prisma.message.findMany({
        where: {
          ...contentFilter,
          channelId: channelId,
          userId: userId || undefined,
          createdAt: Object.keys(dateFilter).length > 0 ? dateFilter : undefined,
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
    }
    // 如果指定了dmConversationId，只搜索该DM对话
    else if (dmConversationId) {
      dmMessages = await prisma.message.findMany({
        where: {
          ...contentFilter,
          dmConversationId: dmConversationId,
          userId: userId || undefined,
          createdAt: Object.keys(dateFilter).length > 0 ? dateFilter : undefined,
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
    }
    // 否则全局搜索（搜索用户加入的所有频道和DM）
    else {
      [channelMessages, dmMessages] = await Promise.all([
        // 搜索频道消息
        prisma.message.findMany({
          where: {
            ...contentFilter,
            channelId: { in: joinedChannelIds },
            userId: userId || undefined,
            createdAt: Object.keys(dateFilter).length > 0 ? dateFilter : undefined,
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
        }),
        // 搜索 DM 消息
        prisma.message.findMany({
          where: {
            ...contentFilter,
            dmConversationId: {
              in: joinedDmConversationIds
            },
            userId: userId || undefined,
            createdAt: Object.keys(dateFilter).length > 0 ? dateFilter : undefined,
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
      })
    ]);
    }

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