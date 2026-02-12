import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { unauthorizedResponse } from '@/lib/api-response';

// 强制动态渲染，避免静态生成错误
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
    let unreadThreadsCount = 0;
    let totalUnreadReplies = 0;

    for (const threadRoot of threadRoots) {
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
