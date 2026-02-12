import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { deleteFile, getSignedUrl } from '@/lib/s3';
import { successResponse, unauthorizedResponse, notFoundResponse, forbiddenResponse, errorResponse } from '@/lib/api-response';
import { Server as SocketIOServer } from 'socket.io';

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
 * GET /api/attachments
 * 获取当前会话的所有附件
 */
export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('auth_token')?.value;

    if (!token) {
      return NextResponse.json(
        unauthorizedResponse(),
        { status: 401 }
      );
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return NextResponse.json(
        unauthorizedResponse('token无效'),
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const conversationId = searchParams.get('conversationId');
    const conversationType = searchParams.get('conversationType'); // 'channel' or 'dm'

    if (!conversationId || !conversationType) {
      return NextResponse.json(
        errorResponse('缺少必要参数: conversationId, conversationType'),
        { status: 400 }
      );
    }

    // 构建查询条件
    const whereClause: any = {};

    if (conversationType === 'channel') {
      whereClause.message = {
        channelId: conversationId
      };
    } else if (conversationType === 'dm') {
      whereClause.message = {
        dmConversationId: conversationId
      };
    }

    // 查询附件
    const attachments = await prisma.attachment.findMany({
      where: whereClause,
      include: {
        message: {
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
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // 为每个附件生成签名URL
    const attachmentsWithUrls = await Promise.all(
      attachments.map(async (attachment: any) => {
        let previewUrl = null;
        try {
          previewUrl = await getSignedUrl(attachment.s3Key);
        } catch (error) {
          console.error('Error generating preview URL:', error);
        }

        return {
          ...convertBigIntToString(attachment),
          previewUrl,
          // 从message中提取发送者信息 (user是Message到User的关系)
          sender: attachment.message?.user || null,
          messageContent: attachment.message?.content || '',
          messageCreatedAt: attachment.message?.createdAt || null
        };
      })
    );

    return NextResponse.json(successResponse(attachmentsWithUrls));
  } catch (error) {
    console.error('Error fetching attachments:', error);
    return NextResponse.json(
      errorResponse('获取文件列表失败'),
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/attachments
 * 删除指定的附件（只有上传者可以删除）
 */
export async function DELETE(request: NextRequest) {
  try {
    const token = request.cookies.get('auth_token')?.value;

    if (!token) {
      return NextResponse.json(
        unauthorizedResponse(),
        { status: 401 }
      );
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return NextResponse.json(
        unauthorizedResponse('token无效'),
        { status: 401 }
      );
    }

    const currentUserId = decoded.userId;

    const { searchParams } = new URL(request.url);
    const attachmentId = searchParams.get('id');

    if (!attachmentId) {
      return NextResponse.json(
        errorResponse('缺少必要参数: id'),
        { status: 400 }
      );
    }

    // 查询附件及其关联的消息
    const attachment = await prisma.attachment.findUnique({
      where: { id: attachmentId },
      include: {
        message: true
      }
    });

    if (!attachment) {
      return NextResponse.json(
        notFoundResponse('文件不存在'),
        { status: 404 }
      );
    }

    // 验证是否是文件上传者
    if (attachment.message.userId !== currentUserId) {
      return NextResponse.json(
        forbiddenResponse('只能删除自己上传的文件'),
        { status: 403 }
      );
    }

    // 删除OSS中的文件
    try {
      await deleteFile(attachment.s3Key);
    } catch (error) {
      console.error('Error deleting file from OSS:', error);
      // 继续删除数据库记录，即使OSS删除失败
    }

    // 删除数据库记录
    await prisma.attachment.delete({
      where: { id: attachmentId }
    });

    // 同时逻辑删除对应的message（显示"This message was deleted"占位符）
    const deletedMessage = await prisma.message.update({
      where: { id: attachment.messageId },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
        updatedAt: new Date()
      }
    });

    // 通过 WebSocket 广播消息删除事件
    try {
      const globalIo = (global as any).io;
      if (typeof globalIo !== 'undefined') {
        const ioInstance = globalIo as SocketIOServer;

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

        console.log(`📡 [API] 文件删除导致消息删除事件已广播: ${deletedMessage.id}`);
      }
    } catch (wsError) {
      console.error('❌ [API] WebSocket 广播错误:', wsError);
    }

    return NextResponse.json(successResponse(null, '文件删除成功'));
  } catch (error) {
    console.error('Error deleting attachment:', error);
    return NextResponse.json(
      errorResponse('文件删除失败'),
      { status: 500 }
    );
  }
}
