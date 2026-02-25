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
    const channelId = searchParams.get('channelId');
    const dmConversationId = searchParams.get('dmConversationId');

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

    let readPosition;

    // Get channel read position
    if (channelId) {
      // Verify user is a channel member
      const channelMember = await prisma.channelMember.findFirst({
        where: {
          channelId,
          userId: currentUserId
        },
        select: {
          lastReadAt: true,
          lastReadMessageId: true
        }
      });

      if (!channelMember) {
        return NextResponse.json(
          { error: 'You are not a member of this channel' },
          { status: 403 }
        );
      }

      readPosition = {
        lastReadAt: channelMember.lastReadAt,
        lastReadMessageId: channelMember.lastReadMessageId
      };
    }

    // Get DM conversation read position
    if (dmConversationId) {
      // Verify user is a DM conversation member
      const conversationMember = await prisma.dMConversationMember.findFirst({
        where: {
          conversationId: dmConversationId,
          userId: currentUserId
        },
        select: {
          lastReadAt: true,
          lastReadMessageId: true
        }
      });

      if (!conversationMember) {
        return NextResponse.json(
          { error: 'You are not a member of this conversation' },
          { status: 403 }
        );
      }

      readPosition = {
        lastReadAt: conversationMember.lastReadAt,
        lastReadMessageId: conversationMember.lastReadMessageId
      };
    }

    return NextResponse.json({
      success: true,
      ...readPosition
    });
  } catch (error) {
    console.error('Error getting read position:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
