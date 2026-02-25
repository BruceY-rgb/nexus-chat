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

    // Get channel unread counts
    const channelUnreads = await prisma.channelMember.findMany({
      where: {
        userId: currentUserId
      },
      select: {
        channelId: true,
        unreadCount: true
      }
    });

    // Get DM unread counts
    const dmUnreads = await prisma.dMConversationMember.findMany({
      where: {
        userId: currentUserId
      },
      select: {
        conversationId: true,
        unreadCount: true
      }
    });

    // Merge results
    const unreadMap: Record<string, number> = {};

    // Add channel unread counts
    channelUnreads.forEach(({ channelId, unreadCount }) => {
      if (unreadCount > 0) {
        unreadMap[channelId] = unreadCount;
      }
    });

    // Add DM unread counts
    dmUnreads.forEach(({ conversationId, unreadCount }) => {
      if (unreadCount > 0) {
        unreadMap[conversationId] = unreadCount;
      }
    });

    return NextResponse.json(unreadMap);
  } catch (error) {
    console.error('Error fetching unread counts:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
