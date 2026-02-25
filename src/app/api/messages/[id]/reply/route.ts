import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { unauthorizedResponse } from '@/lib/api-response';
import { Server as SocketIOServer } from 'socket.io';
import { parseMentions, extractUsernames } from '@/lib/mention-parser';
import { notificationService } from '@/lib/notification-service';

/**
 * Recursively traverse object, convert all BigInt and Date fields to String
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

    // Verify token
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

    // Validate: must have text content or attachments
    const hasContent = content && typeof content === 'string' && content.trim() !== '';
    const hasAttachments = attachments && Array.isArray(attachments) && attachments.length > 0;

    if (!hasContent && !hasAttachments) {
      return NextResponse.json(
        { error: 'Reply must have content or attachments' },
        { status: 400 }
      );
    }

    // Validate parent message exists
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

    // Validate user permissions
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

    // Parse @mentions in reply (only when there is content)
    const mentions = hasContent ? parseMentions(content) : [];

    // Set WebSocket instance to NotificationService
    if (typeof (global as any).io !== 'undefined') {
      const ioInstance = (global as any).io as SocketIOServer;
      notificationService.setSocketIO(ioInstance);
    }

    // Create reply using transaction
    const reply = await prisma.$transaction(async (tx) => {
      // Create reply message
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

      // If there are attachments, create attachment records
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

      // Update parent message's reply count and last reply time
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

      // Re-query complete reply with attachments
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

    // Check if reply was created successfully
    if (!reply) {
      console.error('❌ [API] Reply creation failed or returned null');
      return NextResponse.json(
        { error: 'Failed to create reply' },
        { status: 500 }
      );
    }

    // If there are mentions, create mention records and notifications
    if (mentions.length > 0) {
      const usernames = extractUsernames(mentions);

      // Find user by displayName
      const mentionedUsers = await prisma.user.findMany({
        where: {
          displayName: { in: usernames }
        },
        select: {
          id: true,
          displayName: true
        }
      });

      // Create mention record
      if (mentionedUsers.length > 0) {
        await prisma.messageMention.createMany({
          data: mentionedUsers.map(user => ({
            messageId: reply.id,
            mentionedUserId: user.id
          })),
          skipDuplicates: true
        });

        console.log(`📌 Created ${mentionedUsers.length} mentions for reply ${reply.id}`);

        // Create notification for mention
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

    // Increase unread count for other users (except the replier)
    if (parentMessage.channelId) {
      // Increase thread unread count for channel members
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
      // Increase unread count for DM members
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

      // Update conversation's last message time
      await prisma.dMConversation.update({
        where: {
          id: parentMessage.dmConversationId
        },
        data: {
          lastMessageAt: new Date()
        }
      });
    }

    // Create thread reply notification
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

    // Broadcast new reply via WebSocket
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

        // Broadcast to channel or DM room
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
      // Even if WebSocket broadcast fails, it does not affect HTTP response
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
