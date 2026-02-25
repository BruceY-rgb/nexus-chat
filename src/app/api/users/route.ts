import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { unauthorizedResponse } from '@/lib/api-response';

// Get user list API

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
    const search = searchParams.get('search') || '';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = (page - 1) * limit;
    const activeOnly = searchParams.get('activeOnly') === 'true'; // New: only get users with messages
    const targetUserId = searchParams.get('userId'); // New: get specific user ID

    // Build query conditions
    const where: any = {
      id: {
        not: currentUserId // Exclude current user
      }
    };

    // If targetUserId is specified, only query that user
    if (targetUserId) {
      where.id = targetUserId;
    }

    // If search term exists, support email and display name search
    if (search) {
      where.OR = [
        {
          email: {
            contains: search,
            mode: 'insensitive'
          }
        },
        {
          displayName: {
            contains: search,
            mode: 'insensitive'
          }
        },
        {
          realName: {
            contains: search,
            mode: 'insensitive'
          }
        }
      ];
    }

    // Determine query method based on activeOnly parameter
    let users;
    let total;

    // If targetUserId is specified, don't use pagination
    const finalOffset = targetUserId ? 0 : offset;
    const finalLimit = targetUserId ? 1 : limit;

    if (activeOnly) {
      // Only get users with messages (via DMConversationMember relationship)
      const dmMembers = await prisma.dMConversationMember.findMany({
        where: {
          userId: {
            not: currentUserId
          },
          conversation: {
            messages: {
              some: {} // Ensure conversation has messages
            }
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
              lastMessageAt: true
            }
          }
        },
        orderBy: [
          { conversation: { lastMessageAt: 'desc' } }, // Sort by last message time descending
          { user: { displayName: 'asc' } } // Then sort by display name
        ],
        skip: finalOffset,
        take: finalLimit
      });

      users = dmMembers.map(member => ({
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
        isStarred: member.isStarred || false
      }));

      // Get total count (for search)
      if (search) {
        total = await prisma.dMConversationMember.count({
          where: {
            userId: {
              not: currentUserId
            },
            conversation: {
              messages: {
                some: {}
              }
            },
            OR: [
              {
                user: {
                  email: {
                    contains: search,
                    mode: 'insensitive'
                  }
                }
              },
              {
                user: {
                  displayName: {
                    contains: search,
                    mode: 'insensitive'
                  }
                }
              },
              {
                user: {
                  realName: {
                    contains: search,
                    mode: 'insensitive'
                  }
                }
              }
            ]
          }
        });
      } else {
        total = await prisma.dMConversationMember.count({
          where: {
            userId: {
              not: currentUserId
            },
            conversation: {
              messages: {
                some: {}
              }
            }
          }
        });
      }
    } else {
      // Get all users (original logic)
      const result = await prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          displayName: true,
          realName: true,
          avatarUrl: true,
          isOnline: true,
          lastSeenAt: true,
          // Get DMConversationMember info with current user
          dmMembers: {
            where: {
              conversation: {
                members: {
                  some: {
                    userId: currentUserId
                  }
                }
              }
            },
            select: {
              conversationId: true,
              unreadCount: true,
              lastReadAt: true,
              isStarred: true
            }
          }
        },
        orderBy: [
          { isOnline: 'desc' }, // Online users first
          { displayName: 'asc' } // Then sort by display name
        ],
        skip: finalOffset,
        take: finalLimit
      });

      // Process user data, flatten DMConversationMember info
      users = result.map((user: any) => {
        const dmMember = user.dmMembers?.[0];
        return {
          id: user.id,
          email: user.email,
          displayName: user.displayName,
          realName: user.realName,
          avatarUrl: user.avatarUrl,
          isOnline: user.isOnline,
          lastSeenAt: user.lastSeenAt,
          dmConversationId: dmMember?.conversationId || null,
          unreadCount: dmMember?.unreadCount || 0,
          lastReadAt: dmMember?.lastReadAt || null,
          isStarred: dmMember?.isStarred || false
        };
      });

      total = await prisma.user.count({ where });
    }

    // Get current user info
    const currentUser = await prisma.user.findUnique({
      where: { id: currentUserId },
      select: {
        id: true,
        email: true,
        displayName: true,
        avatarUrl: true,
        isOnline: true
      }
    });

    return NextResponse.json({
      users,
      currentUser,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrevious: page > 1
      }
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
