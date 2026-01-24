import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { unauthorizedResponse } from '@/lib/api-response';

// 获取用户列表 API
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
    const search = searchParams.get('search') || '';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = (page - 1) * limit;
    const activeOnly = searchParams.get('activeOnly') === 'true'; // 新增：只获取有消息的用户
    const targetUserId = searchParams.get('userId'); // 新增：获取特定用户ID

    // 构建查询条件
    const where: any = {
      id: {
        not: currentUserId // 排除当前用户
      }
    };

    // 如果指定了 targetUserId，则只查询该用户
    if (targetUserId) {
      where.id = targetUserId;
    }

    // 如果有搜索词，支持邮箱和显示名搜索
    if (search) {
      where.OR = [
        {
          email: {
            contains: search,
            mode: 'insensitive'
          }
        },
        {
          displayName: {
            contains: search,
            mode: 'insensitive'
          }
        },
        {
          realName: {
            contains: search,
            mode: 'insensitive'
          }
        }
      ];
    }

    // 根据 activeOnly 参数决定查询方式
    let users;
    let total;

    // 如果指定了 targetUserId，不使用分页
    const finalOffset = targetUserId ? 0 : offset;
    const finalLimit = targetUserId ? 1 : limit;

    if (activeOnly) {
      // 只获取有消息的用户（通过 DMConversationMember 关系）
      const dmMembers = await prisma.dMConversationMember.findMany({
        where: {
          userId: {
            not: currentUserId
          },
          conversation: {
            messages: {
              some: {} // 确保该会话有消息
            }
          }
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              displayName: true,
              realName: true,
              avatarUrl: true,
              isOnline: true,
              lastSeenAt: true
            }
          },
          conversation: {
            select: {
              lastMessageAt: true
            }
          }
        },
        select: {
          isStarred: true,
          conversationId: true,
          unreadCount: true,
          lastReadAt: true
        },
        orderBy: [
          { conversation: { lastMessageAt: 'desc' } }, // 按最后消息时间倒序
          { user: { displayName: 'asc' } } // 然后按显示名排序
        ],
        skip: finalOffset,
        take: finalLimit
      });

      users = dmMembers.map(member => ({
        id: member.user.id,
        email: member.user.email,
        displayName: member.user.displayName,
        realName: member.user.realName,
        avatarUrl: member.user.avatarUrl,
        isOnline: member.user.isOnline,
        lastSeenAt: member.user.lastSeenAt,
        dmConversationId: member.conversationId,
        unreadCount: member.unreadCount,
        lastReadAt: member.lastReadAt,
        lastMessageAt: member.conversation.lastMessageAt,
        isStarred: member.isStarred || false
      }));

      // 获取总数（用于搜索时）
      if (search) {
        total = await prisma.dMConversationMember.count({
          where: {
            userId: {
              not: currentUserId
            },
            conversation: {
              messages: {
                some: {}
              }
            },
            OR: [
              {
                user: {
                  email: {
                    contains: search,
                    mode: 'insensitive'
                  }
                }
              },
              {
                user: {
                  displayName: {
                    contains: search,
                    mode: 'insensitive'
                  }
                }
              },
              {
                user: {
                  realName: {
                    contains: search,
                    mode: 'insensitive'
                  }
                }
              }
            ]
          }
        });
      } else {
        total = await prisma.dMConversationMember.count({
          where: {
            userId: {
              not: currentUserId
            },
            conversation: {
              messages: {
                some: {}
              }
            }
          }
        });
      }
    } else {
      // 获取所有用户（原有逻辑）
      const result = await prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          displayName: true,
          realName: true,
          avatarUrl: true,
          isOnline: true,
          lastSeenAt: true,
          // 获取与当前用户的 DMConversationMember 信息
          dmMembers: {
            where: {
              conversation: {
                members: {
                  some: {
                    userId: currentUserId
                  }
                }
              }
            },
            select: {
              conversationId: true,
              unreadCount: true,
              lastReadAt: true,
              isStarred: true
            }
          }
        },
        orderBy: [
          { isOnline: 'desc' }, // 在线用户排在前面
          { displayName: 'asc' } // 然后按显示名排序
        ],
        skip: finalOffset,
        take: finalLimit
      });

      // 处理用户数据，将 DMConversationMember 信息展平
      users = result.map((user: any) => {
        const dmMember = user.dmMembers?.[0];
        return {
          id: user.id,
          email: user.email,
          displayName: user.displayName,
          realName: user.realName,
          avatarUrl: user.avatarUrl,
          isOnline: user.isOnline,
          lastSeenAt: user.lastSeenAt,
          dmConversationId: dmMember?.conversationId || null,
          unreadCount: dmMember?.unreadCount || 0,
          lastReadAt: dmMember?.lastReadAt || null,
          isStarred: dmMember?.isStarred || false
        };
      });

      total = await prisma.user.count({ where });
    }

    // 获取当前用户信息
    const currentUser = await prisma.user.findUnique({
      where: { id: currentUserId },
      select: {
        id: true,
        email: true,
        displayName: true,
        avatarUrl: true,
        isOnline: true
      }
    });

    return NextResponse.json({
      users,
      currentUser,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrevious: page > 1
      }
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
