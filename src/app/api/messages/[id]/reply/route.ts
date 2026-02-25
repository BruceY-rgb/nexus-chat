import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { unauthorizedResponse } from '@/lib/api-response';
import { Server as SocketIOServer } from 'socket.io';
import { parseMentions, extractUsernames } from '@/lib/mention-parser';
import { notificationService } from '@/lib/notification-service';

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

export async function POST(
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
        unauthorizedResponse('Invalid token'),
        { status: 401 }
      );
    }

    const currentUserId = decoded.userId;
    const parentMessageId = params.id;

    const body = await request.json();
    const { content, attachments } = body;

    // 验证：必须有文字内容或附件之一
    const hasContent = content && typeof content === 'string' && content.trim() !== '';
    const hasAttachments = attachments && Array.isArray(attachments) && attachments.length > 0;

    if (!hasContent && !hasAttachments) {
      return NextResponse.json(
        { error: 'Reply must have content or attachments' },
        { status: 400 }
      );
    }

    // 验证父消息是否存在
    const parentMessage = await prisma.message.findUnique({
      where: { id: parentMessageId },
      include: {
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

    if (!parentMessage) {
      return NextResponse.json(
        { error: 'Parent message not found' },
        { status: 404 }
      );
    }

    // 验证用户权限
    if (parentMessage.channelId) {
      const channelMember = await prisma.channelMember.findFirst({
        where: {
          channelId: parentMessage.channelId,
          userId: currentUserId
        }
      });

      if (!channelMember) {
        return NextResponse.json(
          { error: 'You are not a member of this channel' },
          { status: 403 }
        );
      }
    } else if (parentMessage.dmConversationId) {
      const conversationMember = await prisma.dMConversationMember.findFirst({
        where: {
          conversationId: parentMessage.dmConversationId,
          userId: currentUserId
        }
      });

      if (!conversationMember) {
        return NextResponse.json(
          { error: 'You are not a member of this conversation' },
          { status: 403 }
        );
      }
    }

    // 解析回复中的 @提及（只有当有内容时才解析）
    const mentions = hasContent ? parseMentions(content) : [];

    // 设置 WebSocket 实例到 NotificationService
    if (typeof (global as any).io !== 'undefined') {
      const ioInstance = (global as any).io as SocketIOServer;
      notificationService.setSocketIO(ioInstance);
    }

    // 使用事务创建回复
    const reply = await prisma.$transaction(async (tx) => {
      // 创建回复消息
      const newReply = await tx.message.create({
        data: {
          content: hasContent ? content.trim() : '',
          userId: currentUserId,
          channelId: parentMessage.channelId,
          dmConversationId: parentMessage.dmConversationId,
          parentMessageId: parentMessageId,
          messageType: attachments && attachments.length > 0 ? (attachments.some((att: any) => att.mimeType?.startsWith('image/')) ? 'image' : 'file') : 'text'
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

      // 如果有附件，创建附件记录
      if (attachments && attachments.length > 0) {
        const attachmentData = attachments.map((attachment: any) => ({
          messageId: newReply.id,
          fileName: attachment.originalName || attachment.fileName,
          filePath: attachment.fileUrl,
          fileSize: attachment.fileSize.toString(),
          mimeType: attachment.mimeType,
          s3Key: attachment.s3Key,
          s3Bucket: attachment.s3Bucket,
          thumbnailUrl: attachment.thumbnailUrl || null
        }));

        await tx.attachment.createMany({
          data: attachmentData
        });
      }

      // 更新父消息的回复计数和最后回复时间
      await tx.message.update({
        where: { id: parentMessageId },
        data: {
          threadReplyCount: {
            increment: 1
          },
          lastReplyAt: new Date(),
          isThreadRoot: true
        }
      });

      // 重新查询包含附件的完整回复
      const fullReply = await tx.message.findUnique({
        where: {
          id: newReply.id
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

      return fullReply;
    });

    // 检查回复是否创建成功
    if (!reply) {
      console.error('❌ [API] Reply creation failed or returned null');
      return NextResponse.json(
        { error: 'Failed to create reply' },
        { status: 500 }
      );
    }

    // 如果有提及，创建提及记录和通知
    if (mentions.length > 0) {
      const usernames = extractUsernames(mentions);

      // 根据 displayName 查找用户
      const mentionedUsers = await prisma.user.findMany({
        where: {
          displayName: { in: usernames }
        },
        select: {
          id: true,
          displayName: true
        }
      });

      // 创建提及记录
      if (mentionedUsers.length > 0) {
        await prisma.messageMention.createMany({
          data: mentionedUsers.map(user => ({
            messageId: reply.id,
            mentionedUserId: user.id
          })),
          skipDuplicates: true
        });

        console.log(`📌 Created ${mentionedUsers.length} mentions for reply ${reply.id}`);

        // 为提及创建通知
        try {
          await notificationService.createMentionNotifications(
            reply.id,
            currentUserId,
            reply.content,
            parentMessage.channelId || undefined,
            parentMessage.dmConversationId || undefined
          );
        } catch (error) {
          console.error('Error creating mention notifications:', error);
        }
      }
    }

    // 为其他用户增加未读计数（除了回复者）
    if (parentMessage.channelId) {
      // 为频道成员增加线程未读计数
      await prisma.channelMember.updateMany({
        where: {
          channelId: parentMessage.channelId,
          userId: {
            not: currentUserId
          }
        },
        data: {
          unreadCount: {
            increment: 1
          }
        }
      });
    } else if (parentMessage.dmConversationId) {
      // 为DM成员增加未读计数
      await prisma.dMConversationMember.updateMany({
        where: {
          conversationId: parentMessage.dmConversationId,
          userId: {
            not: currentUserId
          }
        },
        data: {
          unreadCount: {
            increment: 1
          }
        }
      });

      // 更新会话的最后消息时间
      await prisma.dMConversation.update({
        where: {
          id: parentMessage.dmConversationId
        },
        data: {
          lastMessageAt: new Date()
        }
      });
    }

    // 创建线程回复通知
    try {
      await notificationService.createThreadReplyNotification(
        reply.id,
        parentMessageId,
        currentUserId,
        reply.content,
        parentMessage.channelId || undefined,
        parentMessage.dmConversationId || undefined
      );
    } catch (error) {
      console.error('Error creating thread reply notification:', error);
    }

    // 通过 WebSocket 广播新回复
    try {
      const globalIo = (global as any).io;
      if (typeof globalIo !== 'undefined') {
        console.log(`✅ [API] WebSocket instance found:`, !!globalIo);
        const ioInstance = globalIo as SocketIOServer;

        const messageInfo: any = {
          replyId: reply.id,
          parentMessageId: parentMessageId,
          content: reply.content?.substring(0, 50),
          fromUser: currentUserId,
          channelId: parentMessage.channelId,
          dmConversationId: parentMessage.dmConversationId,
          hasAttachments: !!(reply.attachments && reply.attachments.length > 0),
          attachmentCount: reply.attachments?.length || 0,
          timestamp: new Date().toISOString()
        };

        if (reply.attachments && reply.attachments.length > 0) {
          messageInfo.attachments = reply.attachments.map((att: any) => ({
            id: att.id,
            fileName: att.fileName,
            mimeType: att.mimeType,
            fileSize: att.fileSize,
            filePath: att.filePath
          }));
        }

        console.log(`🚀 [API] Broadcasting new thread reply via WebSocket:`, messageInfo);

        // 广播到频道或DM房间
        if (parentMessage.channelId) {
          const channelRoom = `channel:${parentMessage.channelId}`;
          ioInstance.to(channelRoom).emit('thread-reply-created', {
            threadId: parentMessageId,
            message: reply,
            replyCount: parentMessage.threadReplyCount + 1
          });
        } else if (parentMessage.dmConversationId) {
          const dmRoom = `dm:${parentMessage.dmConversationId}`;
          ioInstance.to(dmRoom).emit('thread-reply-created', {
            threadId: parentMessageId,
            message: reply,
            replyCount: parentMessage.threadReplyCount + 1
          });
        }

        console.log(`📡 [API] Thread reply broadcast completed for reply: ${reply.id}`);
      } else {
        console.warn(`⚠️ [API] WebSocket instance not found in global variables. Reply will not be broadcasted.`);
      }
    } catch (wsError) {
      console.error('❌ [API] WebSocket broadcast error:', wsError);
      // 即使 WebSocket 广播失败，也不影响 HTTP 响应
    }

    return NextResponse.json(convertBigIntToString(reply));
  } catch (error) {
    console.error('Error creating thread reply:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
