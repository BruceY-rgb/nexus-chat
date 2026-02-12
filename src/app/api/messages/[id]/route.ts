import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { unauthorizedResponse } from '@/lib/api-response';
import { Server as SocketIOServer } from 'socket.io';
import { deleteFile } from '@/lib/s3';

/**
 * 递归遍历对象，将所有 BigInt 和 Date 字段转换为 String
 */
function convertBigIntToString(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === 'bigint') {
    return obj.toString();
  }

  if (obj instanceof Date) {
    return obj.toISOString();
  }

  if (Array.isArray(obj)) {
    return obj.map(item => convertBigIntToString(item));
  }

  if (typeof obj === 'object') {
    const converted: any = {};
    for (const [key, value] of Object.entries(obj)) {
      converted[key] = convertBigIntToString(value);
    }
    return converted;
  }

  return obj;
}

/**
 * PATCH /api/messages/[id] - 编辑消息
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
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
    const messageId = params.id;

    const body = await request.json();
    const { content } = body;

    // 验证内容
    if (!content || typeof content !== 'string' || content.trim() === '') {
      return NextResponse.json(
        { error: 'Message content cannot be empty' },
        { status: 400 }
      );
    }

    // 查找消息并验证权限
    const existingMessage = await prisma.message.findUnique({
      where: { id: messageId },
      include: {
        user: {
          select: {
            id: true,
            displayName: true
          }
        },
        channel: {
          select: {
            id: true,
            name: true
          }
        },
        dmConversation: {
          select: {
            id: true
          }
        }
      }
    });

    if (!existingMessage) {
      return NextResponse.json(
        { error: 'Message not found' },
        { status: 404 }
      );
    }

    // 检查是否是已删除的消息
    if (existingMessage.isDeleted) {
      return NextResponse.json(
        { error: 'Cannot edit deleted message' },
        { status: 400 }
      );
    }

    // 检查权限：只有消息作者可以编辑
    if (existingMessage.userId !== currentUserId) {
      return NextResponse.json(
        { error: "You don't have permission to edit this message" },
        { status: 403 }
      );
    }

    // 更新消息
    const updatedMessage = await prisma.message.update({
      where: { id: messageId },
      data: {
        content: content.trim(),
        isEdited: true,
        updatedAt: new Date()
      },
      include: {
        user: {
          select: {
            id: true,
            displayName: true,
            avatarUrl: true,
            realName: true
          }
        },
        channel: {
          select: {
            id: true,
            name: true
          }
        },
        dmConversation: {
          select: {
            id: true
          }
        },
        attachments: true,
        mentions: {
          include: {
            mentionedUser: {
              select: {
                id: true,
                displayName: true
              }
            }
          }
        }
      }
    });

    // 通过 WebSocket 广播更新后的消息
    try {
      const globalIo = (global as any).io;
      if (typeof globalIo !== 'undefined') {
        const ioInstance = globalIo as SocketIOServer;

        if (updatedMessage.channelId) {
          const channelRoom = `channel:${updatedMessage.channelId}`;
          ioInstance.to(channelRoom).emit('message:update', updatedMessage);
        } else if (updatedMessage.dmConversationId) {
          const dmRoom = `dm:${updatedMessage.dmConversationId}`;
          ioInstance.to(dmRoom).emit('message:update', updatedMessage);
        }

        console.log(`📡 [API] 消息更新事件已广播: ${messageId}`);
      }
    } catch (wsError) {
      console.error('❌ [API] WebSocket 广播错误:', wsError);
      // WebSocket 广播失败不影响 HTTP 响应
    }

    return NextResponse.json(convertBigIntToString(updatedMessage));
  } catch (error) {
    console.error('Error updating message:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/messages/[id] - 逻辑删除消息
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
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
    const messageId = params.id;

    // 查找消息并验证权限
    const existingMessage = await prisma.message.findUnique({
      where: { id: messageId },
      include: {
        user: {
          select: {
            id: true,
            displayName: true
          }
        },
        channel: {
          select: {
            id: true,
            name: true
          }
        },
        dmConversation: {
          select: {
            id: true
          }
        }
      }
    });

    if (!existingMessage) {
      return NextResponse.json(
        { error: 'Message not found' },
        { status: 404 }
      );
    }

    // 检查是否是已删除的消息
    if (existingMessage.isDeleted) {
      return NextResponse.json(
        { error: 'Message has been deleted' },
        { status: 400 }
      );
    }

    // 检查权限：只有消息作者可以删除
    if (existingMessage.userId !== currentUserId) {
      return NextResponse.json(
        { error: "You don't have permission to delete this message" },
        { status: 403 }
      );
    }

    // 删除消息的附件（OSS文件 + 数据库记录）
    try {
      const attachments = await prisma.attachment.findMany({
        where: { messageId: messageId }
      });

      // 删除OSS中的文件
      for (const attachment of attachments) {
        try {
          await deleteFile(attachment.s3Key);
        } catch (ossError) {
          console.error('Error deleting file from OSS:', ossError);
          // 继续删除数据库记录
        }
      }

      // 删除数据库中的附件记录
      await prisma.attachment.deleteMany({
        where: { messageId: messageId }
      });
    } catch (attachmentError) {
      console.error('Error deleting attachments:', attachmentError);
      // 附件删除失败不影响消息删除
    }

    // 执行逻辑删除：不修改 content 字段，只设置 isDeleted 标记
    const deletedMessage = await prisma.message.update({
      where: { id: messageId },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
        updatedAt: new Date()
      },
      include: {
        user: {
          select: {
            id: true,
            displayName: true,
            avatarUrl: true,
            realName: true
          }
        },
        channel: {
          select: {
            id: true,
            name: true
          }
        },
        dmConversation: {
          select: {
            id: true
          }
        }
      }
    });

    // 通过 WebSocket 广播删除事件
    try {
      const globalIo = (global as any).io;
      if (typeof globalIo !== 'undefined') {
        const ioInstance = globalIo as SocketIOServer;

        // 广播删除事件（携带删除的消息信息用于前端更新）
        const deletePayload = {
          id: deletedMessage.id,
          channelId: deletedMessage.channelId,
          dmConversationId: deletedMessage.dmConversationId,
          isDeleted: true,
          deletedAt: deletedMessage.deletedAt,
          userId: deletedMessage.userId
        };

        if (deletedMessage.channelId) {
          const channelRoom = `channel:${deletedMessage.channelId}`;
          ioInstance.to(channelRoom).emit('message-deleted', deletePayload);
        } else if (deletedMessage.dmConversationId) {
          const dmRoom = `dm:${deletedMessage.dmConversationId}`;
          ioInstance.to(dmRoom).emit('message-deleted', deletePayload);
        }

        console.log(`📡 [API] 消息删除事件已广播: ${messageId}`);
      }
    } catch (wsError) {
      console.error('❌ [API] WebSocket 广播错误:', wsError);
      // WebSocket 广播失败不影响 HTTP 响应
    }

    return NextResponse.json({
      success: true,
      message: '消息已删除',
      data: {
        id: deletedMessage.id,
        isDeleted: true,
        deletedAt: deletedMessage.deletedAt
      }
    });
  } catch (error) {
    console.error('Error deleting message:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
