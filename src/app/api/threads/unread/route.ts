import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { unauthorizedResponse } from '@/lib/api-response';

// Force dynamic rendering to avoid static generation errors
export const dynamic = 'force-dynamic';

/**
 * Recursively traverse object, convert all BigInt and Date fields to String
 */
function convertBigIntToString(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === 'bigint') {
    return obj.toString();
  }

  if (obj instanceof Date) {
    return obj.toISOString();
  }

  if (Array.isArray(obj)) {
    return obj.map(item => convertBigIntToString(item));
  }

  if (typeof obj === 'object') {
    const converted: any = {};
    for (const [key, value] of Object.entries(obj)) {
      converted[key] = convertBigIntToString(value);
    }
    return converted;
  }

  return obj;
}

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
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');

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
        user: {
          select: {
            id: true,
            displayName: true,
            avatarUrl: true,
            realName: true
          }
        },
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
        },
        replies: {
          where: {
            deletedAt: null
          },
          include: {
            user: {
              select: {
                id: true,
                displayName: true,
                avatarUrl: true,
                realName: true
              }
            }
          },
          orderBy: {
            createdAt: 'desc'
          },
          take: 1 // Only get last reply
        },
        _count: {
          select: {
            replies: {
              where: {
                deletedAt: null
              }
            }
          }
        }
      },
      orderBy: [
        {
          lastReplyAt: 'desc'
        }
      ],
      take: limit,
      skip: offset
    });

    // Calculate unread count for each thread
    const unreadThreads = await Promise.all(
      threadRoots.map(async (threadRoot) => {
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
        const unreadReplies = await prisma.message.count({
          where: {
            parentMessageId: threadRoot.id,
            deletedAt: null,
            createdAt: {
              gt: lastReadAt
            },
            userId: {
              not: currentUserId
            }
          }
        });

        return {
          ...threadRoot,
          unreadCount: unreadReplies,
          lastReadAt
        };
      })
    );

    // Filter threads with unread messages
    const threadsWithUnread = unreadThreads.filter(thread => thread.unreadCount > 0);

    // Get total count (for pagination)
    const totalCount = await prisma.message.count({
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
      }
    });

    return NextResponse.json({
      threads: convertBigIntToString(threadsWithUnread),
      totalCount,
      hasMore: offset + limit < totalCount
    });

  } catch (error) {
    console.error('Error fetching unread threads:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
