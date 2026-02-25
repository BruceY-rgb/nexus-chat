import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { unauthorizedResponse } from '@/lib/api-response';
import { Server as SocketIOServer } from 'socket.io';

// Global variable to store Socket.IO instance
let io: SocketIOServer | null = null;

// Create or get DM conversation API
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
    const { userId } = body;

    // Validate input
    if (!userId || typeof userId !== 'string') {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    // Cannot create DM with yourself
    if (userId === currentUserId) {
      return NextResponse.json(
        { error: 'Cannot create DM with yourself' },
        { status: 400 }
      );
    }

    // Check if target user exists
    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        displayName: true,
        avatarUrl: true,
        isOnline: true
      }
    });

    if (!targetUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Check if DM conversation already exists (unique conversation between two users)
    const existingConversation = await prisma.dMConversation.findFirst({
      where: {
        members: {
          every: {
            userId: {
              in: [currentUserId, userId]
            }
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
                avatarUrl: true,
                isOnline: true
              }
            }
          }
        }
      }
    });

    if (existingConversation) {
      // If conversation exists, return it
      return NextResponse.json(existingConversation);
    }

    // Create new DM conversation
    const conversation = await prisma.dMConversation.create({
      data: {
        createdById: currentUserId,
        members: {
          create: [
            {
              userId: currentUserId
            },
            {
              userId: userId
            }
          ]
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
                avatarUrl: true,
                isOnline: true
              }
            }
          }
        }
      }
    });

    // Notify WebSocket clients that new conversation is created
    try {
      if (typeof (global as any).io !== 'undefined') {
        const ioInstance = (global as any).io as SocketIOServer;

        // Notify both users in the conversation
        conversation.members.forEach(member => {
          ioInstance.to(`user:${member.userId}`).emit('active-conversations-update', {
            dmConversationId: conversation.id,
            lastMessageAt: conversation.createdAt
          });
        });

        console.log(`📡 Broadcasted new conversation via WebSocket: ${conversation.id}`);
      }
    } catch (wsError) {
      console.error('WebSocket broadcast error:', wsError);
    }

    return NextResponse.json(conversation, { status: 201 });
  } catch (error) {
    console.error('Error creating DM conversation:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
