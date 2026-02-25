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
    const { channelId, dmConversationId, lastReadMessageId } = body;

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

    const now = new Date();

    // Clear channel unread count
    if (channelId) {
      // Verify user is a channel member
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

      // Update channel member's unread count and last read time
      await prisma.channelMember.update({
        where: {
          channelId_userId: {
            channelId,
            userId: currentUserId
          }
        },
        data: {
          unreadCount: 0,
          lastReadAt: now,
          ...(lastReadMessageId && { lastReadMessageId })
        }
      });

      // Broadcast unread count update
      if (typeof (global as any).io !== 'undefined') {
        const ioInstance = (global as any).io as SocketIOServer;
        ioInstance.to(`user:${currentUserId}`).emit('unread-count-update', {
          channelId,
          unreadCount: 0
        });
      }

      return NextResponse.json({
        success: true,
        channelId,
        unreadCount: 0
      });
    }

    // Clear DM unread count
    if (dmConversationId) {
      // Verify user is a DM conversation member
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

      // Update DM member's unread count and last read time
      await prisma.dMConversationMember.update({
        where: {
          conversationId_userId: {
            conversationId: dmConversationId,
            userId: currentUserId
          }
        },
        data: {
          unreadCount: 0,
          lastReadAt: now,
          ...(lastReadMessageId && { lastReadMessageId })
        }
      });

      // Broadcast unread count update
      if (typeof (global as any).io !== 'undefined') {
        const ioInstance = (global as any).io as SocketIOServer;
        ioInstance.to(`user:${currentUserId}`).emit('unread-count-update', {
          dmConversationId,
          unreadCount: 0
        });
      }

      return NextResponse.json({
        success: true,
        dmConversationId,
        unreadCount: 0
      });
    }

    return NextResponse.json({
      success: false,
      error: 'Invalid request'
    }, { status: 400 });
  } catch (error) {
    console.error('Error marking messages as read:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
