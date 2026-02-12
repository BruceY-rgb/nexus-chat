import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { unauthorizedResponse } from '@/lib/api-response';

// 强制动态渲染，避免静态生成错误
export const dynamic = 'force-dynamic';

/**
 * 递归遍历对象，将所有 BigInt 和 Date 字段转换为 String
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
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');

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
          take: 1 // 只获取最后一条回复
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

    // 计算每个线程的未读计数
    const unreadThreads = await Promise.all(
      threadRoots.map(async (threadRoot) => {
        // 获取用户已读的最后时间
        const messageRead = await prisma.messageRead.findUnique({
          where: {
            messageId_userId: {
              messageId: threadRoot.id,
              userId: currentUserId
            }
          }
        });

        const lastReadAt = messageRead?.readAt || new Date(0);

        // 计算该线程中用户在lastReadAt之后发送的消息数（排除自己发送的）
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

    // 过滤出有未读消息的线程
    const threadsWithUnread = unreadThreads.filter(thread => thread.unreadCount > 0);

    // 获取总数（用于分页）
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
