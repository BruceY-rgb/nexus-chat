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

    // Verify token
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

    // Validate: must specify either channelId or dmConversationId, but not both
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

    // Validate user permissions
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

      // Get message IDs to delete (for subsequent cleanup)
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
        // Delete related mention records
        await prisma.messageMention.deleteMany({
          where: {
            messageId: {
              in: messageIds
            }
          }
        });

        // Delete related attachment records
        await prisma.attachment.deleteMany({
          where: {
            messageId: {
              in: messageIds
            }
          }
        });

        // Delete messages
        await prisma.message.deleteMany({
          where: {
            channelId,
            dmConversationId: null
          }
        });

        // Reset channel members' unread count
        await prisma.channelMember.updateMany({
          where: {
            channelId
          },
          data: {
            unreadCount: 0
          }
        });

        // Broadcast message cleared event via WebSocket
        try {
          if (typeof (global as any).io !== 'undefined') {
            const ioInstance = (global as any).io as SocketIOServer;

            // Broadcast to all channel members
            ioInstance.to(`channel:${channelId}`).emit('messages-cleared', {
              channelId,
              clearedBy: currentUserId,
              messageCount: messageIds.length
            });

            // Broadcast unread count update
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
          // Even if WebSocket broadcast fails, it does not affect the HTTP response
        }
      }

      return NextResponse.json({
        success: true,
        message: 'Messages cleared successfully',
        clearedCount: messageIds.length
      });
    }

    if (dmConversationId) {
      // Handle own message space
      if (dmConversationId.startsWith('self-')) {
        const selfId = dmConversationId.replace('self-', '');
        if (selfId !== currentUserId) {
          return NextResponse.json(
            { error: 'Unauthorized' },
            { status: 403 }
          );
        }

        // Get message IDs to delete
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
          // Delete related mention records
          await prisma.messageMention.deleteMany({
            where: {
              messageId: {
                in: messageIds
              }
            }
          });

          // Delete related attachment records
          await prisma.attachment.deleteMany({
            where: {
              messageId: {
                in: messageIds
              }
            }
          });

          // Delete messages
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
        // Regular DM conversation
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

        // Get message IDs to delete
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
          // Delete related mention records
          await prisma.messageMention.deleteMany({
            where: {
              messageId: {
                in: messageIds
              }
            }
          });

          // Delete related attachment records
          await prisma.attachment.deleteMany({
            where: {
              messageId: {
                in: messageIds
              }
            }
          });

          // Delete messages
          await prisma.message.deleteMany({
            where: {
              dmConversationId
            }
          });

          // Reset conversation members' unread count
          await prisma.dMConversationMember.updateMany({
            where: {
              conversationId: dmConversationId
            },
            data: {
              unreadCount: 0
            }
          });

          // Broadcast message cleared event via WebSocket
          try {
            if (typeof (global as any).io !== 'undefined') {
              const ioInstance = (global as any).io as SocketIOServer;

              // Broadcast to all conversation members
              ioInstance.to(`dm:${dmConversationId}`).emit('messages-cleared', {
                dmConversationId,
                clearedBy: currentUserId,
                messageCount: messageIds.length
              });

              // Broadcast unread count update
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
            // Even if WebSocket broadcast fails, it does not affect the HTTP response
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
