import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { unauthorizedResponse } from "@/lib/api-response";

// Global file search API

// Force dynamic rendering - because this API uses cookies
export const dynamic = "force-dynamic";

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

    const query = searchParams.get("query") || "";
    const channelId = searchParams.get("channelId");
    const fileType = searchParams.get("fileType") || "all"; // image|video|document|all
    const limit = parseInt(searchParams.get("limit") || "20");

    // Get user's joined channels and DMs
    const [channelMemberships, dmMemberships] = await Promise.all([
      prisma.channelMember.findMany({
        where: { userId: currentUserId },
        select: { channelId: true },
      }),
      prisma.dMConversationMember.findMany({
        where: { userId: currentUserId },
        select: { conversationId: true },
      }),
    ]);

    const joinedChannelIds = channelMemberships.map((m) => m.channelId);
    const joinedDmConversationIds = dmMemberships.map((m) => m.conversationId);

    // Build filter conditions
    const filter: any = {
      message: {
        OR: [
          { channelId: { in: joinedChannelIds } },
          { dmConversationId: { in: joinedDmConversationIds } },
        ],
        deletedAt: null,
      },
    };

    // Search by file name or message content
    if (query) {
      filter.OR = [
        {
          fileName: {
            contains: query,
            mode: "insensitive",
          },
        },
        {
          message: {
            content: {
              contains: query,
              mode: "insensitive",
            },
          },
        },
      ];
    }

    // Filter by channel
    if (channelId) {
      filter.message = {
        ...filter.message,
        channelId,
      };
    }

    // Filter by file type
    if (fileType && fileType !== "all") {
      const mimeTypePrefix: Record<string, string[]> = {
        image: ["image/"],
        video: ["video/"],
        document: [
          "application/pdf",
          "application/msword",
          "application/vnd.openxmlformats-officedocument",
          "text/",
        ],
      };

      const prefixes = mimeTypePrefix[fileType] || [];
      if (prefixes.length > 0) {
        filter.mimeType = {
          in: prefixes,
        };
      }
    }

    // Query attachments
    const attachments = await prisma.attachment.findMany({
      where: filter,
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
            channel: {
              select: {
                id: true,
                name: true,
              },
            },
            dmConversation: {
              select: {
                id: true,
                members: {
                  select: {
                    user: {
                      select: {
                        id: true,
                        displayName: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: limit,
    });

    // Format results
    const results = attachments.map((attachment: any) => {
      // Determine conversation type and name
      let conversationType: "channel" | "dm" = "channel";
      let conversationName = "";

      if (attachment.message.channelId) {
        conversationType = "channel";
        conversationName = attachment.message.channel?.name || "";
      } else if (attachment.message.dmConversationId) {
        conversationType = "dm";
        const otherMembers = attachment.message.dmConversation?.members
          .filter((m: any) => m.user.id !== currentUserId)
          .map((m: any) => m.user.displayName);
        conversationName = otherMembers?.join(", ") || "";
      }

      return {
        id: attachment.id,
        fileName: attachment.fileName,
        mimeType: attachment.mimeType,
        fileSize: attachment.fileSize?.toString(),
        createdAt: attachment.createdAt,
        sender: attachment.message?.user,
        conversation: {
          id:
            attachment.message.channelId ||
            attachment.message.dmConversationId,
          type: conversationType,
          name: conversationName,
        },
        message: {
          id: attachment.message.id,
          content: attachment.message.content,
          createdAt: attachment.message.createdAt,
        },
      };
    });

    return NextResponse.json({
      query,
      channelId,
      fileType,
      results,
      total: results.length,
    });
  } catch (error) {
    console.error("Error searching files:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
