import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { deleteFile, getSignedUrl } from "@/lib/s3";
import {
  successResponse,
  unauthorizedResponse,
  notFoundResponse,
  forbiddenResponse,
  errorResponse,
} from "@/lib/api-response";
import { Server as SocketIOServer } from "socket.io";

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
 * GET /api/attachments
 * Get all attachments for current conversation
 */
export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get("auth_token")?.value;

    if (!token) {
      return NextResponse.json(unauthorizedResponse(), { status: 401 });
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return NextResponse.json(unauthorizedResponse("invalid token"), {
        status: 401,
      });
    }

    const { searchParams } = new URL(request.url);
    const conversationId = searchParams.get("conversationId");
    const conversationType = searchParams.get("conversationType"); // 'channel' or 'dm'

    if (!conversationId || !conversationType) {
      return NextResponse.json(
        errorResponse(
          "Missing required parameters: conversationId, conversationType",
        ),
        { status: 400 },
      );
    }

    // Build query conditions
    const whereClause: any = {};

    if (conversationType === "channel") {
      whereClause.message = {
        channelId: conversationId,
      };
    } else if (conversationType === "dm") {
      whereClause.message = {
        dmConversationId: conversationId,
      };
    }

    // Query attachments
    const attachments = await prisma.attachment.findMany({
      where: whereClause,
      include: {
        message: {
          include: {
            user: {
              select: {
                id: true,
                displayName: true,
                avatarUrl: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // Generate signed URL for each attachment
    const attachmentsWithUrls = await Promise.all(
      attachments.map(async (attachment: any) => {
        let previewUrl = null;
        try {
          previewUrl = await getSignedUrl(attachment.s3Key);
        } catch (error) {
          console.error("Error generating preview URL:", error);
        }

        return {
          ...convertBigIntToString(attachment),
          previewUrl,
          // Extract sender info from message (user is the relation from Message to User)
          sender: attachment.message?.user || null,
          messageContent: attachment.message?.content || "",
          messageCreatedAt: attachment.message?.createdAt || null,
        };
      }),
    );

    return NextResponse.json(successResponse(attachmentsWithUrls));
  } catch (error) {
    console.error("Error fetching attachments:", error);
    return NextResponse.json(errorResponse("Failed to get file list"), {
      status: 500,
    });
  }
}

/**
 * DELETE /api/attachments
 * Delete specified attachment (only uploader can delete)
 */
export async function DELETE(request: NextRequest) {
  try {
    const token = request.cookies.get("auth_token")?.value;

    if (!token) {
      return NextResponse.json(unauthorizedResponse(), { status: 401 });
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return NextResponse.json(unauthorizedResponse("invalid token"), {
        status: 401,
      });
    }

    const currentUserId = decoded.userId;

    const { searchParams } = new URL(request.url);
    const attachmentId = searchParams.get("id");

    if (!attachmentId) {
      return NextResponse.json(
        errorResponse("Missing required parameter: id"),
        {
          status: 400,
        },
      );
    }

    // Query attachment and its associated message
    const attachment = await prisma.attachment.findUnique({
      where: { id: attachmentId },
      include: {
        message: true,
      },
    });

    if (!attachment) {
      return NextResponse.json(notFoundResponse("File not found"), {
        status: 404,
      });
    }

    // Verify if user is the file uploader
    if (attachment.message.userId !== currentUserId) {
      return NextResponse.json(
        forbiddenResponse("Only the uploader can delete this file"),
        {
          status: 403,
        },
      );
    }

    // Delete file from OSS
    try {
      await deleteFile(attachment.s3Key);
    } catch (error) {
      console.error("Error deleting file from OSS:", error);
      // Continue deleting database records even if OSS deletion fails
    }

    // Delete database records
    await prisma.attachment.delete({
      where: { id: attachmentId },
    });

    // Also logically delete the corresponding message (show "This message was deleted" placeholder)
    const deletedMessage = await prisma.message.update({
      where: { id: attachment.messageId },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
        updatedAt: new Date(),
      },
    });

    // Broadcast message deletion event via WebSocket
    try {
      const globalIo = (global as any).io;
      if (typeof globalIo !== "undefined") {
        const ioInstance = globalIo as SocketIOServer;

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

        console.log(
          `📡 [API] File deletion caused message deletion event broadcast: ${deletedMessage.id}`,
        );
      }
    } catch (wsError) {
      console.error("❌ [API] WebSocket broadcast error:", wsError);
    }

    return NextResponse.json(
      successResponse(null, "File deleted successfully"),
    );
  } catch (error) {
    console.error("Error deleting attachment:", error);
    return NextResponse.json(errorResponse("Failed to delete file"), {
      status: 500,
    });
  }
}
