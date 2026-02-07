import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { Server as SocketIOServer } from 'socket.io';

const prisma = new PrismaClient();

// GET /api/messages/[id]/reactions - 获取消息的所有 reactions
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const messageId = params.id;

    // 获取消息的所有 reactions，包含用户信息
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

    // 按 emoji 分组统计
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

// POST /api/messages/[id]/reactions - 添加或移除 reaction
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

    // 检查用户是否已经对该消息添加了这个 emoji 的 reaction
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
      // 如果已存在，则移除 reaction
      await prisma.messageReaction.delete({
        where: {
          id: existingReaction.id,
        },
      });
      action = 'removed';
      reactionData = null;
    } else {
      // 如果不存在，则添加 reaction
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

    // 获取更新后的所有 reactions
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

    // 按 emoji 分组统计
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

    // 通过 WebSocket 广播反应更新
    try {
      // 获取全局 WebSocket 实例
      const globalIo = (global as any).io;
      if (typeof globalIo !== 'undefined') {
        const ioInstance = globalIo as SocketIOServer;

        // 查询消息以确定房间信息
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

          // 广播 reaction 更新事件 - 添加 userId 以便前端区分是自己还是其他用户触发
          ioInstance.to(roomName).emit('reaction-updated', {
            messageId,
            action,
            reactions: groupedReactions,
            userId // 关键修复：包含触发更新的用户ID
          });

          console.log(`📡 [API] Broadcasted reaction update to room: ${roomName}`);
        }
      }
    } catch (wsError) {
      console.error('❌ [API] WebSocket broadcast error:', wsError);
      // 即使 WebSocket 广播失败，也不影响 HTTP 响应
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
