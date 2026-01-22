import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { unauthorizedResponse } from '@/lib/api-response';
import { PrismaClient } from '@prisma/client';

type PrismaTransaction = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>;

export async function GET(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
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
    const targetUserId = params.userId;

    // 验证用户ID格式（必须是UUID格式）
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(targetUserId)) {
      return NextResponse.json(
        { error: '无效的用户ID格式' },
        { status: 400 }
      );
    }

    // 验证目标用户是否存在
    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, displayName: true }
    });

    if (!targetUser) {
      return NextResponse.json(
        { error: '用户不存在' },
        { status: 404 }
      );
    }

    // 验证当前用户是否存在
    const currentUser = await prisma.user.findUnique({
      where: { id: currentUserId },
      select: { id: true, displayName: true }
    });

    if (!currentUser) {
      return NextResponse.json(
        { error: '当前用户不存在' },
        { status: 404 }
      );
    }

    if (currentUserId === targetUserId) {
      // 如果是与自己的对话，返回一个特殊的对话对象
      return NextResponse.json({
        id: `self-${currentUserId}`,
        createdById: currentUserId,
        lastMessageAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        isOwnSpace: true,
        members: [
          {
            user: {
              id: currentUserId,
              displayName: 'You',
              avatarUrl: null,
              realName: null
            }
          }
        ]
      });
    }

    // 查找现有的私聊会话（两个用户之间的会话）
    const existingConversation = await prisma.dMConversation.findFirst({
      where: {
        AND: [
          {
            members: {
              some: {
                userId: currentUserId
              }
            }
          },
          {
            members: {
              some: {
                userId: targetUserId
              }
            }
          }
        ]
      },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                displayName: true,
                avatarUrl: true,
                realName: true,
                status: true,
                isOnline: true
              }
            }
          }
        },
        messages: {
          take: 1,
          orderBy: {
            createdAt: 'desc'
          },
          include: {
            user: {
              select: {
                id: true,
                displayName: true,
                avatarUrl: true
              }
            }
          }
        }
      }
    });

    if (existingConversation) {
      return NextResponse.json(existingConversation);
    }

    // 如果不存在，创建新的私聊会话
    const newConversation = await prisma.$transaction(async (tx: PrismaTransaction) => {
      // 再次验证用户存在（事务内）
      const [currentUserExists, targetUserExists] = await Promise.all([
        tx.user.findUnique({
          where: { id: currentUserId },
          select: { id: true }
        }),
        tx.user.findUnique({
          where: { id: targetUserId },
          select: { id: true }
        })
      ]);

      if (!currentUserExists) {
        throw new Error('当前用户不存在');
      }

      if (!targetUserExists) {
        throw new Error('目标用户不存在');
      }

      // 创建新对话
      const conversation = await tx.dMConversation.create({
        data: {
          createdById: currentUserId,
          members: {
            create: [
              {
                userId: currentUserId
              },
              {
                userId: targetUserId
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
                  displayName: true,
                  avatarUrl: true,
                  realName: true,
                  status: true,
                  isOnline: true
                }
              }
            }
          },
          messages: {
            take: 1,
            orderBy: {
              createdAt: 'desc'
            }
          }
        }
      });

      return conversation;
    });

    return NextResponse.json(newConversation);
  } catch (error: any) {
    console.error('Error getting DM conversation:', error);

    // 提供更具体的错误信息
    if (error.code === 'P2003') {
      return NextResponse.json(
        { error: '外键约束错误：用户不存在' },
        { status: 400 }
      );
    }

    if (error.message?.includes('用户不存在')) {
      return NextResponse.json(
        { error: error.message },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
