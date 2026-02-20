import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { unauthorizedResponse } from "@/lib/api-response";
import { Server as SocketIOServer } from "socket.io";
import { deleteFile } from "@/lib/s3";

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

/**
 * PATCH /api/messages/[id] - Edit message
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
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
    const messageId = params.id;

    const body = await request.json();
    const { content } = body;

    // Validate content
    if (!content || typeof content !== "string" || content.trim() === "") {
      return NextResponse.json(
        { error: "Message content cannot be empty" },
        { status: 400 },
      );
    }

    // Find message and verify permissions
    const existingMessage = await prisma.message.findUnique({
      where: { id: messageId },
      include: {
        user: {
          select: {
            id: true,
            displayName: true,
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

    if (!existingMessage) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 });
    }

    // Check if message is already deleted
    if (existingMessage.isDeleted) {
      return NextResponse.json(
        { error: "Cannot edit deleted message" },
        { status: 400 },
      );
    }

    // Check permission: only message author can edit
    if (existingMessage.userId !== currentUserId) {
      return NextResponse.json(
        { error: "You don't have permission to edit this message" },
        { status: 403 },
      );
    }

    // Update message
    const updatedMessage = await prisma.message.update({
      where: { id: messageId },
      data: {
        content: content.trim(),
        isEdited: true,
        updatedAt: new Date(),
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

    // Broadcast updated message via WebSocket
    try {
      const globalIo = (global as any).io;
      if (typeof globalIo !== "undefined") {
        const ioInstance = globalIo as SocketIOServer;

        if (updatedMessage.channelId) {
          const channelRoom = `channel:${updatedMessage.channelId}`;
          ioInstance.to(channelRoom).emit("message:update", updatedMessage);
        } else if (updatedMessage.dmConversationId) {
          const dmRoom = `dm:${updatedMessage.dmConversationId}`;
          ioInstance.to(dmRoom).emit("message:update", updatedMessage);
        }

        console.log(`📡 [API] Message update event broadcast: ${messageId}`);
      }
    } catch (wsError) {
      console.error("❌ [API] WebSocket broadcast error:", wsError);
      // WebSocket broadcast failure does not affect HTTP response
    }

    return NextResponse.json(convertBigIntToString(updatedMessage));
  } catch (error) {
    console.error("Error updating message:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/messages/[id] - Logical delete message
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
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
    const messageId = params.id;

    // Find message and verify permissions
    const existingMessage = await prisma.message.findUnique({
      where: { id: messageId },
      include: {
        user: {
          select: {
            id: true,
            displayName: true,
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

    if (!existingMessage) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 });
    }

    // Check if message is already deleted
    if (existingMessage.isDeleted) {
      return NextResponse.json(
        { error: "Message has been deleted" },
        { status: 400 },
      );
    }

    // Check permission: only message author can delete
    if (existingMessage.userId !== currentUserId) {
      return NextResponse.json(
        { error: "You don't have permission to delete this message" },
        { status: 403 },
      );
    }

    // Delete message attachments (OSS files + database records)
    try {
      const attachments = await prisma.attachment.findMany({
        where: { messageId: messageId },
      });

      // Delete files from OSS
      for (const attachment of attachments) {
        try {
          await deleteFile(attachment.s3Key);
        } catch (ossError) {
          console.error("Error deleting file from OSS:", ossError);
          // Continue deleting database records
        }
      }

      // Delete attachment records from database
      await prisma.attachment.deleteMany({
        where: { messageId: messageId },
      });
    } catch (attachmentError) {
      console.error("Error deleting attachments:", attachmentError);
      // Attachment deletion failure does not affect message deletion
    }

    // Perform logical delete: do not modify content field, only set isDeleted flag
    const deletedMessage = await prisma.message.update({
      where: { id: messageId },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
        updatedAt: new Date(),
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

    // Broadcast deletion event via WebSocket
    try {
      const globalIo = (global as any).io;
      if (typeof globalIo !== "undefined") {
        const ioInstance = globalIo as SocketIOServer;

        // Broadcast deletion event (with deleted message info for frontend update)
        const deletePayload = {
          id: deletedMessage.id,
          channelId: deletedMessage.channelId,
          dmConversationId: deletedMessage.dmConversationId,
          isDeleted: true,
          deletedAt: deletedMessage.deletedAt,
          userId: deletedMessage.userId,
        };

        if (deletedMessage.channelId) {
          const channelRoom = `channel:${deletedMessage.channelId}`;
          ioInstance.to(channelRoom).emit("message-deleted", deletePayload);
        } else if (deletedMessage.dmConversationId) {
          const dmRoom = `dm:${deletedMessage.dmConversationId}`;
          ioInstance.to(dmRoom).emit("message-deleted", deletePayload);
        }

        console.log(`📡 [API] Message deletion event broadcast: ${messageId}`);
      }
    } catch (wsError) {
      console.error("❌ [API] WebSocket broadcast error:", wsError);
      // WebSocket broadcast failure does not affect HTTP response
    }

    return NextResponse.json({
      success: true,
      message: "Message deleted",
      data: {
        id: deletedMessage.id,
        isDeleted: true,
        deletedAt: deletedMessage.deletedAt,
      },
    });
  } catch (error) {
    console.error("Error deleting message:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
