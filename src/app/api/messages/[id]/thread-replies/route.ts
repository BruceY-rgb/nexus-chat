import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { unauthorizedResponse } from '@/lib/api-response';

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

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
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
    const messageId = params.id;

    // 验证消息是否存在
    const parentMessage = await prisma.message.findUnique({
      where: { id: messageId },
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

    if (!parentMessage) {
      return NextResponse.json(
        { error: 'Message not found' },
        { status: 404 }
      );
    }

    // 验证用户权限
    if (parentMessage.channelId) {
      const channelMember = await prisma.channelMember.findFirst({
        where: {
          channelId: parentMessage.channelId,
          userId: currentUserId
        }
      });

      if (!channelMember) {
        return NextResponse.json(
          { error: 'You are not a member of this channel' },
          { status: 403 }
        );
      }
    } else if (parentMessage.dmConversationId) {
      const conversationMember = await prisma.dMConversationMember.findFirst({
        where: {
          conversationId: parentMessage.dmConversationId,
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

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    // 获取线程回复列表
    const replies = await prisma.message.findMany({
      where: {
        parentMessageId: messageId,
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
        },
        attachments: true,
        mentions: {
          include: {
            mentionedUser: {
              select: {
                id: true,
                displayName: true
              }
            }
          }
        },
        reactions: {
          include: {
            user: {
              select: {
                id: true,
                displayName: true
              }
            }
          }
        }
      },
      orderBy: {
        createdAt: 'asc'
      },
      take: limit,
      skip: offset
    });

    // 获取回复总数
    const totalCount = await prisma.message.count({
      where: {
        parentMessageId: messageId,
        deletedAt: null
      }
    });

    // 标记已读
    if (parentMessage.channelId) {
      // 标记频道线程为已读
      await prisma.messageRead.upsert({
        where: {
          messageId_userId: {
            messageId: messageId,
            userId: currentUserId
          }
        },
        update: {
          readAt: new Date()
        },
        create: {
          userId: currentUserId,
          messageId: messageId,
          readAt: new Date()
        }
      });
    } else if (parentMessage.dmConversationId) {
      // 标记DM线程为已读
      await prisma.messageRead.upsert({
        where: {
          messageId_userId: {
            messageId: messageId,
            userId: currentUserId
          }
        },
        update: {
          readAt: new Date()
        },
        create: {
          userId: currentUserId,
          messageId: messageId,
          readAt: new Date()
        }
      });
    }

    return NextResponse.json({
      replies: convertBigIntToString(replies),
      parentMessage: convertBigIntToString(parentMessage),
      totalCount,
      hasMore: offset + limit < totalCount
    });

  } catch (error) {
    console.error('Error fetching thread replies:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
