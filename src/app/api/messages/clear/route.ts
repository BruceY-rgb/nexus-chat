import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { unauthorizedResponse } from '@/lib/api-response';
import { Server as SocketIOServer } from 'socket.io';

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
        unauthorizedResponse('Invalid token'),
        { status: 401 }
      );
    }

    const currentUserId = decoded.userId;
    const body = await request.json();
    const { channelId, dmConversationId } = body;

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

      // 获取要删除的消息ID（用于后续清理相关数据）
      const messagesToDelete = await prisma.message.findMany({
        where: {
          channelId,
          dmConversationId: null
        },
        select: {
          id: true
        }
      });

      const messageIds = messagesToDelete.map(msg => msg.id);

      if (messageIds.length > 0) {
        // 删除相关的提及记录
        await prisma.messageMention.deleteMany({
          where: {
            messageId: {
              in: messageIds
            }
          }
        });

        // 删除相关的附件记录
        await prisma.attachment.deleteMany({
          where: {
            messageId: {
              in: messageIds
            }
          }
        });

        // 删除消息
        await prisma.message.deleteMany({
          where: {
            channelId,
            dmConversationId: null
          }
        });

        // 重置频道成员的未读计数
        await prisma.channelMember.updateMany({
          where: {
            channelId
          },
          data: {
            unreadCount: 0
          }
        });

        // 通过 WebSocket 广播消息清空事件
        try {
          if (typeof (global as any).io !== 'undefined') {
            const ioInstance = (global as any).io as SocketIOServer;

            // 广播给频道所有成员
            ioInstance.to(`channel:${channelId}`).emit('messages-cleared', {
              channelId,
              clearedBy: currentUserId,
              messageCount: messageIds.length
            });

            // 广播未读计数更新
            const channelMembers = await prisma.channelMember.findMany({
              where: { channelId },
              select: { userId: true, unreadCount: true }
            });

            channelMembers.forEach(member => {
              ioInstance.to(`user:${member.userId}`).emit('unread-count-update', {
                channelId,
                unreadCount: 0
              });
            });

            console.log(`🧹 Broadcasted messages cleared via WebSocket for channel: ${channelId}`);
          }
        } catch (wsError) {
          console.error('WebSocket broadcast error:', wsError);
          // 即使 WebSocket 广播失败，也不影响 HTTP 响应
        }
      }

      return NextResponse.json({
        success: true,
        message: 'Messages cleared successfully',
        clearedCount: messageIds.length
      });
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

        // 获取要删除的消息ID
        const messagesToDelete = await prisma.message.findMany({
          where: {
            dmConversationId
          },
          select: {
            id: true
          }
        });

        const messageIds = messagesToDelete.map(msg => msg.id);

        if (messageIds.length > 0) {
          // 删除相关的提及记录
          await prisma.messageMention.deleteMany({
            where: {
              messageId: {
                in: messageIds
              }
            }
          });

          // 删除相关的附件记录
          await prisma.attachment.deleteMany({
            where: {
              messageId: {
                in: messageIds
              }
            }
          });

          // 删除消息
          await prisma.message.deleteMany({
            where: {
              dmConversationId
            }
          });

          return NextResponse.json({
            success: true,
            message: 'Messages cleared successfully',
            clearedCount: messageIds.length
          });
        }
      } else {
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

        // 获取要删除的消息ID
        const messagesToDelete = await prisma.message.findMany({
          where: {
            dmConversationId
          },
          select: {
            id: true
          }
        });

        const messageIds = messagesToDelete.map(msg => msg.id);

        if (messageIds.length > 0) {
          // 删除相关的提及记录
          await prisma.messageMention.deleteMany({
            where: {
              messageId: {
                in: messageIds
              }
            }
          });

          // 删除相关的附件记录
          await prisma.attachment.deleteMany({
            where: {
              messageId: {
                in: messageIds
              }
            }
          });

          // 删除消息
          await prisma.message.deleteMany({
            where: {
              dmConversationId
            }
          });

          // 重置会话成员的未读计数
          await prisma.dMConversationMember.updateMany({
            where: {
              conversationId: dmConversationId
            },
            data: {
              unreadCount: 0
            }
          });

          // 通过 WebSocket 广播消息清空事件
          try {
            if (typeof (global as any).io !== 'undefined') {
              const ioInstance = (global as any).io as SocketIOServer;

              // 广播给会话所有成员
              ioInstance.to(`dm:${dmConversationId}`).emit('messages-cleared', {
                dmConversationId,
                clearedBy: currentUserId,
                messageCount: messageIds.length
              });

              // 广播未读计数更新
              const dmMembers = await prisma.dMConversationMember.findMany({
                where: { conversationId: dmConversationId },
                select: { userId: true, unreadCount: true }
              });

              dmMembers.forEach(member => {
                ioInstance.to(`user:${member.userId}`).emit('unread-count-update', {
                  dmConversationId,
                  unreadCount: 0
                });
              });

              console.log(`🧹 Broadcasted messages cleared via WebSocket for DM: ${dmConversationId}`);
            }
          } catch (wsError) {
            console.error('WebSocket broadcast error:', wsError);
            // 即使 WebSocket 广播失败，也不影响 HTTP 响应
          }
        }

        return NextResponse.json({
          success: true,
          message: 'Messages cleared successfully',
          clearedCount: messageIds.length
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: 'No messages to clear',
      clearedCount: 0
    });
  } catch (error) {
    console.error('Error clearing messages:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
