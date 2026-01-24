import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { unauthorizedResponse } from '@/lib/api-response';

// 获取星标用户列表 API
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

    // 获取当前用户星标的用户列表
    const starredMembers = await prisma.dMConversationMember.findMany({
      where: {
        // 查找当前用户参与的对话中被星标的成员
        conversation: {
          members: {
            some: {
              userId: currentUserId
            }
          }
        },
        // 该成员被星标
        isStarred: true,
        // 排除当前用户自己
        userId: {
          not: currentUserId
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
            id: true,
            lastMessageAt: true,
            createdAt: true
          }
        }
      },
      orderBy: [
        { updatedAt: 'desc' } // 按更新时间倒序
      ]
    });

    // 格式化返回数据
    const starredUsers = starredMembers.map(member => ({
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
      isStarred: true
    }));

    return NextResponse.json({
      users: starredUsers,
      total: starredUsers.length
    });
  } catch (error) {
    console.error('Error fetching starred users:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// 切换用户星标状态 API
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
    const { starredUserId } = await request.json();

    if (!starredUserId) {
      return NextResponse.json(
        { error: 'starredUserId is required' },
        { status: 400 }
      );
    }

    // 查找当前的 DMConversationMember 记录
    // 注意：要切换的是 starredUserId 的记录，而不是当前用户的记录
    const dmMember = await prisma.dMConversationMember.findFirst({
      where: {
        userId: starredUserId,
        conversation: {
          members: {
            some: {
              userId: currentUserId
            }
          }
        }
      }
    });

    if (!dmMember) {
      // 如果没有找到对话记录，先创建一个
      // 创建新的 DMConversation
      await prisma.dMConversation.create({
        data: {
          createdById: currentUserId,
          members: {
            create: [
              {
                userId: currentUserId,
                isStarred: false
              },
              {
                userId: starredUserId,
                isStarred: true  // 将被标星的用户标记为 true
              }
            ]
          }
        }
      });

      return NextResponse.json({
        success: true,
        isStarred: true,
        message: 'User starred successfully'
      });
    }

    // 切换星标状态
    const updatedMember = await prisma.dMConversationMember.update({
      where: {
        id: dmMember.id
      },
      data: {
        isStarred: !dmMember.isStarred
      },
      select: {
        isStarred: true
      }
    });

    return NextResponse.json({
      success: true,
      isStarred: updatedMember.isStarred,
      message: updatedMember.isStarred ? 'User starred successfully' : 'User unstarred successfully'
    });
  } catch (error) {
    console.error('Error toggling star status:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
