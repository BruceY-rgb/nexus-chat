import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { unauthorizedResponse } from '@/lib/api-response';

// Force dynamic rendering to avoid static generation errors
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

    // Verify token
    const decoded = verifyToken(token);
    if (!decoded) {
      return NextResponse.json(
        unauthorizedResponse('Invalid token'),
        { status: 401 }
      );
    }

    const currentUserId = decoded.userId;

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
                  userId: currentUserId
                }
              }
            }
          },
          {
            dmConversation: {
              members: {
                some: {
                  userId: currentUserId
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
    let unreadThreadsCount = 0;
    let totalUnreadReplies = 0;

    for (const threadRoot of threadRoots) {
      // Get user's last read time
      const messageRead = await prisma.messageRead.findUnique({
        where: {
          messageId_userId: {
            messageId: threadRoot.id,
            userId: currentUserId
          }
        }
      });

      const lastReadAt = messageRead?.readAt || new Date(0);

      // Calculate number of messages sent after lastReadAt in this thread (excluding user's own messages)
      const unreadReplies = threadRoot.replies.filter(reply =>
        reply.createdAt > lastReadAt && reply.userId !== currentUserId
      );

      if (unreadReplies.length > 0) {
        unreadThreadsCount++;
        totalUnreadReplies += unreadReplies.length;
      }
    }

    return NextResponse.json({
      unreadThreadsCount,
      totalUnreadReplies
    });

  } catch (error) {
    console.error('Error fetching thread count:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
