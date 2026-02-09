import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { unauthorizedResponse } from '@/lib/api-response';
import { Server as SocketIOServer } from 'socket.io';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { threadId: string } }
) {
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
    const threadId = params.threadId;

    // 验证线程是否存在
    const thread = await prisma.message.findUnique({
      where: { id: threadId },
      include: {
        channel: {
          select: {
            id: true,
            name: true
          }
        },
        dmConversation: {
          select: {
            id: true
          }
        }
      }
    });

    if (!thread) {
      return NextResponse.json(
        { error: 'Thread not found' },
        { status: 404 }
      );
    }

    // 验证用户权限
    if (thread.channelId) {
      const channelMember = await prisma.channelMember.findFirst({
        where: {
          channelId: thread.channelId,
          userId: currentUserId
        }
      });

      if (!channelMember) {
        return NextResponse.json(
          { error: 'You are not a member of this channel' },
          { status: 403 }
        );
      }
    } else if (thread.dmConversationId) {
      const conversationMember = await prisma.dMConversationMember.findFirst({
        where: {
          conversationId: thread.dmConversationId,
          userId: currentUserId
        }
      });

      if (!conversationMember) {
        return NextResponse.json(
          { error: 'You are not a member of this conversation' },
          { status: 403 }
        );
      }
    }

    // 标记线程为已读
    await prisma.messageRead.upsert({
      where: {
        messageId_userId: {
          messageId: threadId,
          userId: currentUserId
        }
      },
      update: {
        readAt: new Date()
      },
      create: {
        userId: currentUserId,
        messageId: threadId,
        readAt: new Date()
      }
    });

    // 通过 WebSocket 广播线程已读状态变更
    try {
      const globalIo = (global as any).io;
      if (typeof globalIo !== 'undefined') {
        const ioInstance = globalIo as SocketIOServer;

        // 计算当前用户的未读线程总数
        const unreadThreadsCount = await calculateUnreadThreadsCount(currentUserId);

        // 广播给当前用户
        ioInstance.to(`user:${currentUserId}`).emit('thread-read-status-changed', {
          threadId: threadId,
          readAt: new Date().toISOString(),
          unreadThreadsCount
        });

        // 更新用户未读线程计数
        ioInstance.to(`user:${currentUserId}`).emit('thread-unread-count-updated', {
          count: unreadThreadsCount
        });

        console.log(`✅ [API] Thread ${threadId} marked as read for user ${currentUserId}`);
      }
    } catch (wsError) {
      console.error('❌ [API] WebSocket broadcast error:', wsError);
    }

    return NextResponse.json({
      success: true,
      threadId,
      readAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error marking thread as read:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * 计算用户未读线程数量
 */
async function calculateUnreadThreadsCount(userId: string): Promise<number> {
  // 获取所有有回复的线程根消息
  const threadRoots = await prisma.message.findMany({
    where: {
      isThreadRoot: true,
      deletedAt: null,
      replies: {
        some: {}
      },
      OR: [
        {
          channel: {
            members: {
              some: {
                userId: userId
              }
            }
          }
        },
        {
          dmConversation: {
            members: {
              some: {
                userId: userId
              }
            }
          }
        }
      ]
    },
    include: {
      replies: {
        where: {
          deletedAt: null
        },
        select: {
          id: true,
          userId: true,
          createdAt: true
        }
      }
    }
  });

  // 计算每个线程的未读计数
  let totalUnread = 0;
  for (const threadRoot of threadRoots) {
    // 获取用户已读的最后时间
    const messageRead = await prisma.messageRead.findUnique({
      where: {
        messageId_userId: {
          messageId: threadRoot.id,
          userId: userId
        }
      }
    });

    const lastReadAt = messageRead?.readAt || new Date(0);

    // 计算该线程中用户在lastReadAt之后发送的消息数（排除自己发送的）
    const unreadReplies = threadRoot.replies.filter(reply =>
      reply.createdAt > lastReadAt && reply.userId !== userId
    ).length;

    if (unreadReplies > 0) {
      totalUnread++;
    }
  }

  return totalUnread;
}
