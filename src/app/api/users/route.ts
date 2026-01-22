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

    // 构建查询条件
    const where: any = {
      id: {
        not: currentUserId // 排除当前用户
      }
    };

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
        }
      ];
    }

    // 获取用户列表（包含 DMConversationMember 信息）
    const [users, total] = await Promise.all([
      prisma.user.findMany({
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
              lastReadAt: true
            }
          }
        },
        orderBy: [
          { isOnline: 'desc' }, // 在线用户排在前面
          { displayName: 'asc' } // 然后按显示名排序
        ],
        skip: offset,
        take: limit
      }),
      prisma.user.count({ where })
    ]);

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

    // 处理用户数据，将 DMConversationMember 信息展平
    const processedUsers = users.map((user: any) => {
      const dmMember = user.dmMembers?.[0]; // 每个用户与当前用户最多有一个 DM 会话
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
        lastReadAt: dmMember?.lastReadAt || null
      };
    });

    return NextResponse.json({
      users: processedUsers,
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
