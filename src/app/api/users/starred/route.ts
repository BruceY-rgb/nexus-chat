import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { unauthorizedResponse } from '@/lib/api-response';

// Get starred users list API
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

    // Get current user's starred users list
    const starredMembers = await prisma.dMConversationMember.findMany({
      where: {
        // Find starred members in conversations the current user participates in
        conversation: {
          members: {
            some: {
              userId: currentUserId
            }
          }
        },
        // Member is starred
        isStarred: true,
        // Exclude current user themselves
        userId: {
          not: currentUserId
        }
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            displayName: true,
            realName: true,
            avatarUrl: true,
            isOnline: true,
            lastSeenAt: true
          }
        },
        conversation: {
          select: {
            id: true,
            lastMessageAt: true,
            createdAt: true
          }
        }
      },
      orderBy: [
        { updatedAt: 'desc' } // Order by update time descending
      ]
    });

    // Format return data
    const starredUsers = starredMembers.map(member => ({
      id: member.user.id,
      email: member.user.email,
      displayName: member.user.displayName,
      realName: member.user.realName,
      avatarUrl: member.user.avatarUrl,
      isOnline: member.user.isOnline,
      lastSeenAt: member.user.lastSeenAt,
      dmConversationId: member.conversationId,
      unreadCount: member.unreadCount,
      lastReadAt: member.lastReadAt,
      lastMessageAt: member.conversation.lastMessageAt,
      isStarred: true
    }));

    return NextResponse.json({
      users: starredUsers,
      total: starredUsers.length
    });
  } catch (error) {
    console.error('Error fetching starred users:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Toggle user star status API
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
    const { starredUserId } = await request.json();

    if (!starredUserId) {
      return NextResponse.json(
        { error: 'starredUserId is required' },
        { status: 400 }
      );
    }

    // Find current DMConversationMember record
    // Note: Toggle the starredUserId's record, not the current user's record
    const dmMember = await prisma.dMConversationMember.findFirst({
      where: {
        userId: starredUserId,
        conversation: {
          members: {
            some: {
              userId: currentUserId
            }
          }
        }
      }
    });

    if (!dmMember) {
      // If conversation record not found, create one first
      // Create new DMConversation
      await prisma.dMConversation.create({
        data: {
          createdById: currentUserId,
          members: {
            create: [
              {
                userId: currentUserId,
                isStarred: false
              },
              {
                userId: starredUserId,
                isStarred: true  // Mark the user to be starred as true
              }
            ]
          }
        }
      });

      return NextResponse.json({
        success: true,
        isStarred: true,
        message: 'User starred successfully'
      });
    }

    // Toggle star status
    const updatedMember = await prisma.dMConversationMember.update({
      where: {
        id: dmMember.id
      },
      data: {
        isStarred: !dmMember.isStarred
      },
      select: {
        isStarred: true
      }
    });

    return NextResponse.json({
      success: true,
      isStarred: updatedMember.isStarred,
      message: updatedMember.isStarred ? 'User starred successfully' : 'User unstarred successfully'
    });
  } catch (error) {
    console.error('Error toggling star status:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
