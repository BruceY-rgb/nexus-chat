import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { unauthorizedResponse } from '@/lib/api-response';

// Force dynamic rendering - because this API uses cookies
export const dynamic = 'force-dynamic';

// Get active DM conversation list API (sorted by last message time)
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
    const search = searchParams.get('search') || '';

    // Get all DM conversations of current user (including newly created, no messages)
    const dmConversations = await prisma.dMConversation.findMany({
      where: {
        members: {
          some: {
            userId: currentUserId
          }
        }
      },
      include: {
        members: {
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
            }
          }
        },
        messages: {
          where: {
            isDeleted: false
          },
          orderBy: {
            createdAt: 'desc'
          },
          take: 1, // Only get last message
          include: {
            user: {
              select: {
                id: true,
                displayName: true,
                avatarUrl: true
              }
            }
          }
        },
        _count: {
          select: {
            messages: {
              where: {
                isDeleted: false
              }
            }
          }
        }
      },
      orderBy: {
        lastMessageAt: 'desc' // Sort by last message time descending
      }
    });

    // Process data, return only the other user's information
    const processedConversations = dmConversations
      .filter(conv => conv.members.length === 2) // Ensure it's a two-person conversation
      .map(conv => {
        // Get other user's information (excluding current user)
        const otherMember = conv.members.find(m => m.userId !== currentUserId);
        const lastMessage = conv.messages[0];

        return {
          conversationId: conv.id,
          lastMessageAt: conv.lastMessageAt,
          createdAt: conv.createdAt,
          otherUser: {
            id: otherMember?.user.id,
            email: otherMember?.user.email,
            displayName: otherMember?.user.displayName,
            realName: otherMember?.user.realName,
            avatarUrl: otherMember?.user.avatarUrl,
            isOnline: otherMember?.user.isOnline,
            lastSeenAt: otherMember?.user.lastSeenAt,
            isStarred: otherMember?.isStarred || false
          },
          unreadCount: otherMember?.unreadCount || 0,
          lastReadAt: otherMember?.lastReadAt || null,
          lastMessage: lastMessage ? {
            id: lastMessage.id,
            content: lastMessage.content,
            createdAt: lastMessage.createdAt,
            user: {
              id: lastMessage.user.id,
              displayName: lastMessage.user.displayName,
              avatarUrl: lastMessage.user.avatarUrl
            }
          } : null,
          messageCount: conv._count.messages
        };
      })
      // Filter if search term exists
      .filter(conv => {
        if (!search) return true;
        const searchLower = search.toLowerCase();
        return (
          conv.otherUser.displayName?.toLowerCase().includes(searchLower) ||
          conv.otherUser.email?.toLowerCase().includes(searchLower) ||
          conv.otherUser.realName?.toLowerCase().includes(searchLower)
        );
      });

    return NextResponse.json({
      conversations: processedConversations,
      total: processedConversations.length
    });
  } catch (error) {
    console.error('Error fetching active DM conversations:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
