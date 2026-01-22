import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { unauthorizedResponse } from '@/lib/api-response';

// 获取活跃DM会话列表 API（按最后消息时间排序）
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

    // 获取当前用户的活跃DM会话（只包含有消息的会话）
    const dmConversations = await prisma.dMConversation.findMany({
      where: {
        members: {
          some: {
            userId: currentUserId
          }
        },
        messages: {
          some: {} // 只要有消息就符合条件
        }
      },
      include: {
        members: {
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
            }
          }
        },
        messages: {
          where: {
            isDeleted: false
          },
          orderBy: {
            createdAt: 'desc'
          },
          take: 1, // 只获取最后一条消息
          include: {
            user: {
              select: {
                id: true,
                displayName: true,
                avatarUrl: true
              }
            }
          }
        },
        _count: {
          select: {
            messages: {
              where: {
                isDeleted: false
              }
            }
          }
        }
      },
      orderBy: {
        lastMessageAt: 'desc' // 按最后消息时间倒序排列
      }
    });

    // 处理数据，只返回对方用户的信息
    const processedConversations = dmConversations
      .filter(conv => conv.members.length === 2) // 确保是两人会话
      .map(conv => {
        // 获取对方用户信息（排除当前用户）
        const otherMember = conv.members.find(m => m.userId !== currentUserId);
        const lastMessage = conv.messages[0];

        return {
          conversationId: conv.id,
          lastMessageAt: conv.lastMessageAt,
          createdAt: conv.createdAt,
          otherUser: {
            id: otherMember?.user.id,
            email: otherMember?.user.email,
            displayName: otherMember?.user.displayName,
            realName: otherMember?.user.realName,
            avatarUrl: otherMember?.user.avatarUrl,
            isOnline: otherMember?.user.isOnline,
            lastSeenAt: otherMember?.user.lastSeenAt
          },
          unreadCount: otherMember?.unreadCount || 0,
          lastReadAt: otherMember?.lastReadAt || null,
          lastMessage: lastMessage ? {
            id: lastMessage.id,
            content: lastMessage.content,
            createdAt: lastMessage.createdAt,
            user: {
              id: lastMessage.user.id,
              displayName: lastMessage.user.displayName,
              avatarUrl: lastMessage.user.avatarUrl
            }
          } : null,
          messageCount: conv._count.messages
        };
      })
      // 如果有搜索词，进行过滤
      .filter(conv => {
        if (!search) return true;
        const searchLower = search.toLowerCase();
        return (
          conv.otherUser.displayName?.toLowerCase().includes(searchLower) ||
          conv.otherUser.email?.toLowerCase().includes(searchLower) ||
          conv.otherUser.realName?.toLowerCase().includes(searchLower)
        );
      });

    return NextResponse.json({
      conversations: processedConversations,
      total: processedConversations.length
    });
  } catch (error) {
    console.error('Error fetching active DM conversations:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
