import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Server as SocketIOServer } from 'socket.io';

// GET /api/messages/[id]/reactions - Get all reactions for a message
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const messageId = params.id;

    // Get all reactions for message, including user info
    const reactions = await prisma.messageReaction.findMany({
      where: {
        messageId,
      },
      include: {
        user: {
          select: {
            id: true,
            displayName: true,
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    // Group by emoji and count
    const groupedReactions = reactions.reduce((acc, reaction) => {
      const existing = acc.find(r => r.emoji === reaction.emoji);
      if (existing) {
        existing.count += 1;
        existing.users.push({
          id: reaction.user.id,
          displayName: reaction.user.displayName,
        });
      } else {
        acc.push({
          emoji: reaction.emoji,
          count: 1,
          users: [
            {
              id: reaction.user.id,
              displayName: reaction.user.displayName,
            },
          ],
        });
      }
      return acc;
    }, [] as Array<{
      emoji: string;
      count: number;
      users: Array<{ id: string; displayName: string }>;
    }>);

    return NextResponse.json(groupedReactions);
  } catch (error) {
    console.error('Error fetching reactions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch reactions' },
      { status: 500 }
    );
  }
}

// POST /api/messages/[id]/reactions - Add or remove reaction
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const messageId = params.id;
    const body = await request.json();
    const { emoji, userId } = body;

    if (!emoji || !userId) {
      return NextResponse.json(
        { error: 'Emoji and userId are required' },
        { status: 400 }
      );
    }

    // Check if user has already added this emoji reaction to the message
    const existingReaction = await prisma.messageReaction.findUnique({
      where: {
        messageId_userId_emoji: {
          messageId,
          userId,
          emoji,
        },
      },
    });

    let reactionData;
    let action: 'added' | 'removed';

    if (existingReaction) {
      // If exists, remove reaction
      await prisma.messageReaction.delete({
        where: {
          id: existingReaction.id,
        },
      });
      action = 'removed';
      reactionData = null;
    } else {
      // If not exists, add reaction
      reactionData = await prisma.messageReaction.create({
        data: {
          messageId,
          userId,
          emoji,
        },
        include: {
          user: {
            select: {
              id: true,
              displayName: true,
            },
          },
        },
      });
      action = 'added';
    }

    // Get all updated reactions
    const allReactions = await prisma.messageReaction.findMany({
      where: { messageId },
      include: {
        user: {
          select: {
            id: true,
            displayName: true,
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    // Group by emoji and count
    const groupedReactions = allReactions.reduce((acc, reaction) => {
      const existing = acc.find(r => r.emoji === reaction.emoji);
      if (existing) {
        existing.count += 1;
        existing.users.push({
          id: reaction.user.id,
          displayName: reaction.user.displayName,
        });
      } else {
        acc.push({
          emoji: reaction.emoji,
          count: 1,
          users: [
            {
              id: reaction.user.id,
              displayName: reaction.user.displayName,
            },
          ],
        });
      }
      return acc;
    }, [] as Array<{
      emoji: string;
      count: number;
      users: Array<{ id: string; displayName: string }>;
    }>);

    // Broadcast reaction update via WebSocket
    try {
      // Get global WebSocket instance
      const globalIo = (global as any).io;
      if (typeof globalIo !== 'undefined') {
        const ioInstance = globalIo as SocketIOServer;

        // Query message to determine room info
        const message = await prisma.message.findUnique({
          where: { id: messageId },
          select: {
            channelId: true,
            dmConversationId: true
          }
        });

        if (message) {
          const roomName = message.channelId
            ? `channel:${message.channelId}`
            : `dm:${message.dmConversationId}`;

          // Broadcast reaction update event - include userId so frontend can distinguish between self or other user triggers
          ioInstance.to(roomName).emit('reaction-updated', {
            messageId,
            action,
            reactions: groupedReactions,
            userId // Key fix: include userId that triggered the update
          });

          console.log(`📡 [API] Broadcasted reaction update to room: ${roomName}`);
        }
      }
    } catch (wsError) {
      console.error('❌ [API] WebSocket broadcast error:', wsError);
      // Even if WebSocket broadcast fails, it does not affect HTTP response
    }

    return NextResponse.json({
      action,
      reaction: reactionData,
      reactions: groupedReactions,
    });
  } catch (error) {
    console.error('Error toggling reaction:', error);
    return NextResponse.json(
      { error: 'Failed to toggle reaction' },
      { status: 500 }
    );
  }
}
