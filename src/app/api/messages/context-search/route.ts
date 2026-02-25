import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { unauthorizedResponse } from '@/lib/api-response';

// Force dynamic rendering - because this API uses cookies
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
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('query');
    const channelId = searchParams.get('channelId');
    const dmConversationId = searchParams.get('dmConversationId');

    if (!query || query.trim() === '') {
      return NextResponse.json(
        { error: 'Search query cannot be empty' },
        { status: 400 }
      );
    }

    // Check if both channelId and dmConversationId are provided
    if (channelId && dmConversationId) {
      return NextResponse.json(
        { error: 'Cannot specify both channel ID and DM conversation ID' },
        { status: 400 }
      );
    }

    let results: any[] = [];

    if (channelId) {
      // Verify user has joined the channel
      const membership = await prisma.channelMember.findFirst({
        where: {
          userId: currentUserId,
          channelId: channelId
        }
      });

      if (!membership) {
        return NextResponse.json(
          { error: 'You have not joined this channel' },
          { status: 403 }
        );
      }

      // Search only in specified channel
      const messages = await prisma.message.findMany({
        where: {
          content: {
            contains: query,
            mode: 'insensitive'
          },
          channelId: channelId,
          dmConversationId: null,
          deletedAt: null
        },
        include: {
          user: {
            select: {
              id: true,
              displayName: true,
              avatarUrl: true
            }
          },
          channel: {
            select: {
              id: true,
              name: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        },
        take: 50
      });

      results = messages.map(message => {
        if (!message.channel) {
          return null;
        }
        return {
          id: message.id,
          content: message.content,
          createdAt: message.createdAt,
          user: message.user,
          channel: {
            id: message.channel.id,
            name: message.channel.name
          },
          type: 'channel' as const
        };
      }).filter(Boolean);

    } else if (dmConversationId) {
      // Verify user is participating in the DM
      const membership = await prisma.dMConversationMember.findFirst({
        where: {
          userId: currentUserId,
          conversationId: dmConversationId
        }
      });

      if (!membership) {
        return NextResponse.json(
          { error: 'You are not a participant in this conversation' },
          { status: 403 }
        );
      }

      // Search only in specified DM
      const messages = await prisma.message.findMany({
        where: {
          content: {
            contains: query,
            mode: 'insensitive'
          },
          dmConversationId: dmConversationId,
          channelId: null,
          deletedAt: null
        },
        include: {
          user: {
            select: {
              id: true,
              displayName: true,
              avatarUrl: true
            }
          },
          dmConversation: {
            select: {
              id: true,
              members: {
                select: {
                  user: {
                    select: {
                      id: true,
                      displayName: true
                    }
                  }
                }
              }
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        },
        take: 50
      });

      results = messages.map(message => {
        if (!message.dmConversation) {
          return null;
        }

        // Get other members in the conversation
        const otherMembers = message.dmConversation.members
          .filter((m: any) => m.user.id !== currentUserId)
          .map((m: any) => m.user);

        return {
          id: message.id,
          content: message.content,
          createdAt: message.createdAt,
          user: message.user,
          dmConversation: {
            id: message.dmConversation.id,
            participants: otherMembers
          },
          type: 'dm' as const
        };
      }).filter(Boolean);

    } else {
      // If neither channelId nor dmConversationId is specified, return error
      return NextResponse.json(
        { error: 'Must specify either channel ID or DM conversation ID' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      query,
      results,
      total: results.length
    });

  } catch (error) {
    console.error('Error occurred while searching messages:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}