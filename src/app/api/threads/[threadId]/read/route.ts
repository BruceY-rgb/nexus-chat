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

    // Verify token
    const decoded = verifyToken(token);
    if (!decoded) {
      return NextResponse.json(
        unauthorizedResponse('Invalid token'),
        { status: 401 }
      );
    }

    const currentUserId = decoded.userId;
    const threadId = params.threadId;

    // Validate thread exists
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

    // Validate user permissions
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

    // Mark thread as read
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

    // Broadcast thread read status change via WebSocket
    try {
      const globalIo = (global as any).io;
      if (typeof globalIo !== 'undefined') {
        const ioInstance = globalIo as SocketIOServer;

        // Calculate current user's unread threads total
        const unreadThreadsCount = await calculateUnreadThreadsCount(currentUserId);

        // Broadcast to current user
        ioInstance.to(`user:${currentUserId}`).emit('thread-read-status-changed', {
          threadId: threadId,
          readAt: new Date().toISOString(),
          unreadThreadsCount
        });

        // Update user unread threads count
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
 * Calculate user unread threads count
 */
async function calculateUnreadThreadsCount(userId: string): Promise<number> {
  // Get all thread root messages with replies
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

  // Calculate unread count for each thread
  let totalUnread = 0;
  for (const threadRoot of threadRoots) {
    // Get user's last read time
    const messageRead = await prisma.messageRead.findUnique({
      where: {
        messageId_userId: {
          messageId: threadRoot.id,
          userId: userId
        }
      }
    });

    const lastReadAt = messageRead?.readAt || new Date(0);

    // Calculate number of messages sent after lastReadAt in this thread (excluding user's own messages)
    const unreadReplies = threadRoot.replies.filter(reply =>
      reply.createdAt > lastReadAt && reply.userId !== userId
    ).length;

    if (unreadReplies > 0) {
      totalUnread++;
    }
  }

  return totalUnread;
}
