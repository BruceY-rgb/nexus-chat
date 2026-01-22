import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { unauthorizedResponse } from '@/lib/api-response';
import { Server as SocketIOServer } from 'socket.io';

// 全局变量存储 Socket.IO 实例
let io: SocketIOServer | null = null;

// 创建或获取私聊会话 API
export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('auth_token')?.value;

    if (!token) {
      return NextResponse.json(
        unauthorizedResponse(),
        { status: 401 }
      );
    }

    // 验证 token
    const decoded = verifyToken(token);
    if (!decoded) {
      return NextResponse.json(
        unauthorizedResponse('token无效'),
        { status: 401 }
      );
    }

    const currentUserId = decoded.userId;
    const body = await request.json();
    const { userId } = body;

    // 验证输入
    if (!userId || typeof userId !== 'string') {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    // 不能和自己创建私聊
    if (userId === currentUserId) {
      return NextResponse.json(
        { error: 'Cannot create DM with yourself' },
        { status: 400 }
      );
    }

    // 检查目标用户是否存在
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

    // 检查是否已经存在私聊会话（两个用户之间的唯一会话）
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
      // 如果会话存在，返回该会话
      return NextResponse.json(existingConversation);
    }

    // 创建新的私聊会话
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

    // 通知WebSocket客户端有新对话创建
    try {
      if (typeof (global as any).io !== 'undefined') {
        const ioInstance = (global as any).io as SocketIOServer;

        // 通知对话双方的用户
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
