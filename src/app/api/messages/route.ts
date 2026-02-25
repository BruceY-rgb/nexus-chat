import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { unauthorizedResponse } from "@/lib/api-response";
import { Server as SocketIOServer } from "socket.io";
import { parseMentions, extractUsernames } from "@/lib/mention-parser";
import { notificationService } from "@/lib/notification-service";

// Global variable to store Socket.IO instance
let io: SocketIOServer | null = null;

/**
 * Recursively traverse object, convert all BigInt and Date fields to String
 */
function convertBigIntToString(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === "bigint") {
    return obj.toString();
  }

  // Handle Date object, convert to ISO string
  if (obj instanceof Date) {
    return obj.toISOString();
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => convertBigIntToString(item));
  }

  if (typeof obj === "object") {
    const converted: any = {};
    for (const [key, value] of Object.entries(obj)) {
      converted[key] = convertBigIntToString(value);
    }
    return converted;
  }

  return obj;
}

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get("auth_token")?.value;

    if (!token) {
      return NextResponse.json(unauthorizedResponse(), { status: 401 });
    }

    // Set WebSocket instance to NotificationService
    if (typeof (global as any).io !== "undefined") {
      const ioInstance = (global as any).io as SocketIOServer;
      notificationService.setSocketIO(ioInstance);
    }

    // Verify token
    const decoded = verifyToken(token);
    if (!decoded) {
      return NextResponse.json(unauthorizedResponse("invalid token"), {
        status: 401,
      });
    }

    const currentUserId = decoded.userId;

    const body = await request.json();
    const { content, channelId, dmConversationId, attachments, quote } = body;

    // Quote data structure
    // quote: { messageId, content, userId, userName, avatarUrl, createdAt }

    // Validate: must have either text content or attachments
    const hasContent =
      content && typeof content === "string" && content.trim() !== "";
    const hasAttachments =
      attachments && Array.isArray(attachments) && attachments.length > 0;

    if (!hasContent && !hasAttachments) {
      return NextResponse.json(
        { error: "Message must have content or attachments" },
        { status: 400 },
      );
    }

    // Validate: must specify either channelId or dmConversationId, but not both
    if (!channelId && !dmConversationId) {
      return NextResponse.json(
        { error: "Must specify either channelId or dmConversationId" },
        { status: 400 },
      );
    }

    if (channelId && dmConversationId) {
      return NextResponse.json(
        { error: "Cannot specify both channelId and dmConversationId" },
        { status: 400 },
      );
    }

    // If channel message, verify user has permission to send messages in this channel
    if (channelId) {
      const channelMember = await prisma.channelMember.findFirst({
        where: {
          channelId,
          userId: currentUserId,
        },
      });

      if (!channelMember) {
        return NextResponse.json(
          { error: "You are not a member of this channel" },
          { status: 403 },
        );
      }
    }

    // If DM message, verify user is in this conversation
    if (dmConversationId) {
      if (!dmConversationId.startsWith("self-")) {
        const conversationMember = await prisma.dMConversationMember.findFirst({
          where: {
            conversationId: dmConversationId,
            userId: currentUserId,
          },
        });

        if (!conversationMember) {
          return NextResponse.json(
            { error: "You are not a member of this conversation" },
            { status: 403 },
          );
        }
      }
    }

    // Parse @mentions in message (only when there's content)
    const mentions = hasContent ? parseMentions(content) : [];

    // Use transaction to create message and attachments, ensuring data consistency
    const message = await prisma.$transaction(async (tx) => {
      // Create message
      const newMessage = await tx.message.create({
        data: {
          content: hasContent ? content.trim() : "", // If no content, set to empty string
          userId: currentUserId,
          channelId: channelId || null,
          dmConversationId: dmConversationId || null,
          messageType:
            attachments && attachments.length > 0
              ? attachments.some((att: any) =>
                  att.mimeType?.startsWith("image/"),
                )
                ? "image"
                : "file"
              : "text",
          // Quote fields - store snapshot of quoted message
          quotedContent: quote?.content || null,
          quotedUserId: quote?.userId || null,
          quotedUserName: quote?.userName || null,
          quotedAvatarUrl: quote?.avatarUrl || null,
          quotedAt: quote?.createdAt ? new Date(quote.createdAt) : null,
          isQuotedDeleted: false,
        },
        include: {
          user: {
            select: {
              id: true,
              displayName: true,
              avatarUrl: true,
              realName: true,
            },
          },
          channel: {
            select: {
              id: true,
              name: true,
            },
          },
          dmConversation: {
            select: {
              id: true,
            },
          },
        },
      });

      // If there are attachments, create attachment records
      if (attachments && attachments.length > 0) {
        const attachmentData = attachments.map((attachment: any) => ({
          messageId: newMessage.id,
          fileName: attachment.originalName || attachment.fileName,
          filePath: attachment.fileUrl,
          fileSize: attachment.fileSize.toString(),
          mimeType: attachment.mimeType,
          s3Key: attachment.s3Key,
          s3Bucket: attachment.s3Bucket,
          thumbnailUrl: attachment.thumbnailUrl || null,
        }));

        await tx.attachment.createMany({
          data: attachmentData,
        });

        console.log(
          `📎 Created ${attachments.length} attachments for message ${newMessage.id}`,
        );
      }

      // Re-fetch full message with attachments
      const fullMessage = await tx.message.findUnique({
        where: {
          id: newMessage.id,
        },
        include: {
          user: {
            select: {
              id: true,
              displayName: true,
              avatarUrl: true,
              realName: true,
            },
          },
          channel: {
            select: {
              id: true,
              name: true,
            },
          },
          dmConversation: {
            select: {
              id: true,
            },
          },
          attachments: true,
          mentions: {
            include: {
              mentionedUser: {
                select: {
                  id: true,
                  displayName: true,
                },
              },
            },
          },
        },
      });

      return fullMessage;
    });

    // Check if message was created successfully
    if (!message) {
      console.error("❌ [API] Message creation failed or returned null");
      return NextResponse.json(
        { error: "Failed to create message" },
        { status: 500 },
      );
    }

    // If there are mentions, create mention records and notifications
    if (mentions.length > 0) {
      const usernames = extractUsernames(mentions);

      // Find users by displayName
      const mentionedUsers = await prisma.user.findMany({
        where: {
          displayName: { in: usernames },
        },
        select: {
          id: true,
          displayName: true,
        },
      });

      // Create mention records
      if (mentionedUsers.length > 0) {
        await prisma.messageMention.createMany({
          data: mentionedUsers.map((user) => ({
            messageId: message.id,
            mentionedUserId: user.id,
          })),
          skipDuplicates: true,
        });

        console.log(
          `📌 Created ${mentionedUsers.length} mentions for message ${message.id}`,
        );

        // Create notifications for mentions
        try {
          await notificationService.createMentionNotifications(
            message.id,
            currentUserId,
            message.content,
            channelId || undefined,
            dmConversationId || undefined,
          );
        } catch (error) {
          console.error("Error creating mention notifications:", error);
        }
      }
    }

    // If channel message, increment unread count for all members (except sender)
    if (channelId) {
      await prisma.channelMember.updateMany({
        where: {
          channelId,
          userId: {
            not: currentUserId,
          },
        },
        data: {
          unreadCount: {
            increment: 1,
          },
        },
      });
    }

    // If DM message, increment unread count for other members
    if (dmConversationId && !dmConversationId.startsWith("self-")) {
      await prisma.dMConversationMember.updateMany({
        where: {
          conversationId: dmConversationId,
          userId: {
            not: currentUserId,
          },
        },
        data: {
          unreadCount: {
            increment: 1,
          },
        },
      });

      // Update conversation's last message time
      await prisma.dMConversation.update({
        where: {
          id: dmConversationId,
        },
        data: {
          lastMessageAt: new Date(),
        },
      });

      // Create notifications for DM messages
      try {
        await notificationService.createDMNotification(
          message.id,
          currentUserId,
          dmConversationId,
        );
      } catch (error) {
        console.error("Error creating DM notification:", error);
      }
    }

    // Broadcast new message via WebSocket
    try {
      // In production, should get io instance through global event system or Redis Pub/Sub
      // For simplicity, we use global variable here
      const globalIo = (global as any).io;
      if (typeof globalIo !== "undefined") {
        console.log(`✅ [API] WebSocket instance found:`, !!globalIo);
        const ioInstance = globalIo as SocketIOServer;

        // Log complete message info and attachment details
        const messageInfo: any = {
          messageId: message.id,
          content: message.content?.substring(0, 50),
          fromUser: currentUserId,
          channelId,
          dmConversationId,
          hasAttachments: !!(
            message.attachments && message.attachments.length > 0
          ),
          attachmentCount: message.attachments?.length || 0,
          timestamp: new Date().toISOString(),
        };

        if (message.attachments && message.attachments.length > 0) {
          messageInfo.attachments = message.attachments.map((att) => ({
            id: att.id,
            messageId: att.messageId,
            fileName: att.fileName,
            filePath: att.filePath,
            fileSize: att.fileSize,
            mimeType: att.mimeType,
            fileType: att.fileType,
            s3Key: att.s3Key,
            s3Bucket: att.s3Bucket,
            thumbnailUrl: att.thumbnailUrl,
            createdAt: att.createdAt?.toISOString(),
          }));
        }

        console.log(
          `🚀 [API] Broadcasting new message via WebSocket:`,
          messageInfo,
        );

        if (channelId) {
          const channelRoom = `channel:${channelId}`;
          console.log(`📡 [API] Broadcasting to channel room: ${channelRoom}`);
          console.log(
            `📨 [API] Message payload includes attachments:`,
            message.attachments,
          );
          ioInstance.to(channelRoom).emit("new-message", message);
          console.log(
            `✅ [API] Message broadcasted to channel room successfully`,
          );
        } else if (dmConversationId) {
          const dmRoom = `dm:${dmConversationId}`;
          console.log(`📡 [API] Broadcasting to DM room: ${dmRoom}`);
          console.log(
            `📨 [API] Message payload includes attachments:`,
            message.attachments,
          );
          ioInstance.to(dmRoom).emit("new-message", message);
          console.log(`✅ [API] Message broadcasted to DM room successfully`);
        }

        console.log(
          `📡 [API] WebSocket broadcast completed for message: ${message.id}`,
        );
      } else {
        console.warn(
          `⚠️ [API] WebSocket instance not found in global variables. Message will not be broadcasted.`,
        );
      }
    } catch (wsError) {
      console.error("❌ [API] WebSocket broadcast error:", wsError);
      // Even if WebSocket broadcast fails, it does not affect the HTTP response
    }

    return NextResponse.json(convertBigIntToString(message));
  } catch (error) {
    console.error("Error creating message:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get("auth_token")?.value;

    if (!token) {
      return NextResponse.json(unauthorizedResponse(), { status: 401 });
    }

    // Verify token
    const decoded = verifyToken(token);
    if (!decoded) {
      return NextResponse.json(unauthorizedResponse("invalid token"), {
        status: 401,
      });
    }

    const currentUserId = decoded.userId;
    const { searchParams } = new URL(request.url);
    const channelId = searchParams.get("channelId");
    const dmConversationId = searchParams.get("dmConversationId");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    // Validate: must specify either channelId or dmConversationId
    if (!channelId && !dmConversationId) {
      return NextResponse.json(
        { error: "Must specify either channelId or dmConversationId" },
        { status: 400 },
      );
    }

    if (channelId && dmConversationId) {
      return NextResponse.json(
        { error: "Cannot specify both channelId and dmConversationId" },
        { status: 400 },
      );
    }

    // Validate user permissions
    if (channelId) {
      const channelMember = await prisma.channelMember.findFirst({
        where: {
          channelId,
          userId: currentUserId,
        },
      });

      if (!channelMember) {
        return NextResponse.json(
          { error: "You are not a member of this channel" },
          { status: 403 },
        );
      }

      const messages = await prisma.message.findMany({
        where: {
          channelId,
          dmConversationId: null,
          deletedAt: null,
        },
        include: {
          user: {
            select: {
              id: true,
              displayName: true,
              avatarUrl: true,
              realName: true,
            },
          },
          attachments: true,
          mentions: {
            include: {
              mentionedUser: {
                select: {
                  id: true,
                  displayName: true,
                },
              },
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
        take: limit,
        skip: offset,
      });

      return NextResponse.json(convertBigIntToString(messages));
    }

    if (dmConversationId) {
      // Handle self-message space
      if (dmConversationId.startsWith("self-")) {
        const selfId = dmConversationId.replace("self-", "");
        if (selfId !== currentUserId) {
          return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
        }

        const messages = await prisma.message.findMany({
          where: {
            dmConversationId,
            channelId: null,
            deletedAt: null,
          },
          include: {
            user: {
              select: {
                id: true,
                displayName: true,
                avatarUrl: true,
                realName: true,
              },
            },
            attachments: true,
            mentions: {
              include: {
                mentionedUser: {
                  select: {
                    id: true,
                    displayName: true,
                  },
                },
              },
            },
          },
          orderBy: {
            createdAt: "desc",
          },
          take: limit,
          skip: offset,
        });

        return NextResponse.json(convertBigIntToString(messages));
      }

      // Regular DM conversation
      const conversationMember = await prisma.dMConversationMember.findFirst({
        where: {
          conversationId: dmConversationId,
          userId: currentUserId,
        },
      });

      if (!conversationMember) {
        return NextResponse.json(
          { error: "You are not a member of this conversation" },
          { status: 403 },
        );
      }

      const messages = await prisma.message.findMany({
        where: {
          dmConversationId,
          channelId: null,
          deletedAt: null,
        },
        include: {
          user: {
            select: {
              id: true,
              displayName: true,
              avatarUrl: true,
              realName: true,
            },
          },
          attachments: true,
          mentions: {
            include: {
              mentionedUser: {
                select: {
                  id: true,
                  displayName: true,
                },
              },
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
        take: limit,
        skip: offset,
      });

      return NextResponse.json(convertBigIntToString(messages));
    }

    return NextResponse.json([]);
  } catch (error) {
    console.error("Error fetching messages:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
