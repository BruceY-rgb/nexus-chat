import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { unauthorizedResponse } from '@/lib/api-response';
import { Server as SocketIOServer } from 'socket.io';
import { setupWebSocket } from '@/lib/websocket-server';

// 全局变量存储 Socket.IO 实例
let io: SocketIOServer | null = null;

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

    const body = await request.json();
    const { content, channelId, dmConversationId } = body;

    if (!content || typeof content !== 'string' || content.trim() === '') {
      return NextResponse.json(
        { error: 'Message content is required' },
        { status: 400 }
      );
    }

    // 验证：必须指定 channelId 或 dmConversationId 中的一个，但不能同时指定
    if (!channelId && !dmConversationId) {
      return NextResponse.json(
        { error: 'Must specify either channelId or dmConversationId' },
        { status: 400 }
      );
    }

    if (channelId && dmConversationId) {
      return NextResponse.json(
        { error: 'Cannot specify both channelId and dmConversationId' },
        { status: 400 }
      );
    }

    // 如果是频道消息，验证用户是否有权限在该频道发送消息
    if (channelId) {
      const channelMember = await prisma.channelMember.findFirst({
        where: {
          channelId,
          userId: currentUserId
        }
      });

      if (!channelMember) {
        return NextResponse.json(
          { error: 'You are not a member of this channel' },
          { status: 403 }
        );
      }
    }

    // 如果是私聊消息，验证用户是否在该会话中
    if (dmConversationId) {
      if (!dmConversationId.startsWith('self-')) {
        const conversationMember = await prisma.dMConversationMember.findFirst({
          where: {
            conversationId: dmConversationId,
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
    }

    // 创建消息
    const message = await prisma.message.create({
      data: {
        content: content.trim(),
        userId: currentUserId,
        channelId: channelId || null,
        dmConversationId: dmConversationId || null,
        messageType: 'text'
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
        }
      }
    });

    // 如果是频道消息，为所有成员（除发送者外）增加未读计数
    if (channelId) {
      await prisma.channelMember.updateMany({
        where: {
          channelId,
          userId: {
            not: currentUserId
          }
        },
        data: {
          unreadCount: {
            increment: 1
          }
        }
      });
    }

    // 如果是私聊消息，为其他成员增加未读计数
    if (dmConversationId && !dmConversationId.startsWith('self-')) {
      await prisma.dMConversationMember.updateMany({
        where: {
          conversationId: dmConversationId,
          userId: {
            not: currentUserId
          }
        },
        data: {
          unreadCount: {
            increment: 1
          }
        }
      });

      // 更新会话的最后消息时间
      await prisma.dMConversation.update({
        where: {
          id: dmConversationId
        },
        data: {
          lastMessageAt: new Date()
        }
      });
    }

    // 通过 WebSocket 广播新消息
    try {
      // 在生产环境中，应该通过全局事件系统或Redis Pub/Sub来获取 io 实例
      // 这里为了简化示例，我们使用全局变量
      if (typeof (global as any).io !== 'undefined') {
        const ioInstance = (global as any).io as SocketIOServer;

        if (channelId) {
          ioInstance.to(`channel:${channelId}`).emit('new-message', message);

          // 广播未读计数更新
          const channelMembers = await prisma.channelMember.findMany({
            where: { channelId },
            select: { userId: true, unreadCount: true }
          });

          channelMembers.forEach(member => {
            // 排除发送者本人
            if (member.userId !== currentUserId) {
              ioInstance.to(`user:${member.userId}`).emit('unread-count-update', {
                channelId,
                unreadCount: member.unreadCount
              });
            }
          });
        } else if (dmConversationId) {
          ioInstance.to(`dm:${dmConversationId}`).emit('new-message', message);

          // 广播未读计数更新
          const dmMembers = await prisma.dMConversationMember.findMany({
            where: { conversationId: dmConversationId },
            select: { userId: true, unreadCount: true }
          });

          dmMembers.forEach(member => {
            // 排除发送者本人
            if (member.userId !== currentUserId) {
              ioInstance.to(`user:${member.userId}`).emit('unread-count-update', {
                dmConversationId,
                unreadCount: member.unreadCount
              });

              // 通知活跃对话列表更新（新消息可能使对话出现在列表中）
              ioInstance.to(`user:${member.userId}`).emit('active-conversations-update', {
                dmConversationId,
                lastMessageAt: new Date()
              });
            }
          });
        }

        console.log(`📡 Broadcasted new message via WebSocket: ${message.id}`);
      }
    } catch (wsError) {
      console.error('WebSocket broadcast error:', wsError);
      // 即使 WebSocket 广播失败，也不影响 HTTP 响应
    }

    return NextResponse.json(message);
  } catch (error) {
    console.error('Error creating message:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
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
    const channelId = searchParams.get('channelId');
    const dmConversationId = searchParams.get('dmConversationId');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    // 验证：必须指定 channelId 或 dmConversationId 中的一个
    if (!channelId && !dmConversationId) {
      return NextResponse.json(
        { error: 'Must specify either channelId or dmConversationId' },
        { status: 400 }
      );
    }

    if (channelId && dmConversationId) {
      return NextResponse.json(
        { error: 'Cannot specify both channelId and dmConversationId' },
        { status: 400 }
      );
    }

    // 验证用户权限
    if (channelId) {
      const channelMember = await prisma.channelMember.findFirst({
        where: {
          channelId,
          userId: currentUserId
        }
      });

      if (!channelMember) {
        return NextResponse.json(
          { error: 'You are not a member of this channel' },
          { status: 403 }
        );
      }

      const messages = await prisma.message.findMany({
        where: {
          channelId,
          dmConversationId: null,
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
        take: limit,
        skip: offset
      });

      return NextResponse.json(messages);
    }

    if (dmConversationId) {
      // 处理自己的消息空间
      if (dmConversationId.startsWith('self-')) {
        const selfId = dmConversationId.replace('self-', '');
        if (selfId !== currentUserId) {
          return NextResponse.json(
            { error: 'Unauthorized' },
            { status: 403 }
          );
        }

        const messages = await prisma.message.findMany({
          where: {
            dmConversationId,
            channelId: null,
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
          take: limit,
          skip: offset
        });

        return NextResponse.json(messages);
      }

      // 普通 DM 会话
      const conversationMember = await prisma.dMConversationMember.findFirst({
        where: {
          conversationId: dmConversationId,
          userId: currentUserId
        }
      });

      if (!conversationMember) {
        return NextResponse.json(
          { error: 'You are not a member of this conversation' },
          { status: 403 }
        );
      }

      const messages = await prisma.message.findMany({
        where: {
          dmConversationId,
          channelId: null,
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
        take: limit,
        skip: offset
      });

      return NextResponse.json(messages);
    }

    return NextResponse.json([]);
  } catch (error) {
    console.error('Error fetching messages:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
