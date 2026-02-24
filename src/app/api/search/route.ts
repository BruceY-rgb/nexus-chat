import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { unauthorizedResponse } from "@/lib/api-response";

// Global search API - unified search for messages, files, channels, users

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
    const type = searchParams.get("type") || "all"; // messages|files|channels|users|all
    const channelId = searchParams.get("channelId");
    const userId = searchParams.get("userId");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const limit = parseInt(searchParams.get("limit") || "20");

    // Build date filter conditions
    const dateFilter: {
      gte?: Date;
      lte?: Date;
    } = {};
    if (startDate) {
      dateFilter.gte = new Date(startDate);
    }
    if (endDate) {
      dateFilter.lte = new Date(endDate);
    }
    const hasDateFilter = Object.keys(dateFilter).length > 0;

    // Content filter for message/file search
    const contentFilter = query
      ? {
          content: {
            contains: query,
            mode: "insensitive" as const,
          },
        }
      : {};

    // Results object
    const results: {
      messages?: any[];
      files?: any[];
      channels?: any[];
      users?: any[];
    } = {};

    // Search messages
    if (type === "all" || type === "messages") {
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

      // Apply channelId filter if provided
      let channelFilter = undefined;
      if (channelId) {
        channelFilter = channelId;
      }

      // Search channel messages
      const channelMessages = await prisma.message.findMany({
        where: {
          ...contentFilter,
          channelId: channelFilter ? channelFilter : { in: joinedChannelIds },
          userId: userId || undefined,
          createdAt: hasDateFilter ? dateFilter : undefined,
          deletedAt: null,
        },
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
        },
        orderBy: {
          createdAt: "desc",
        },
        take: limit,
      });

      // Search DM messages
      const dmMessages = await prisma.message.findMany({
        where: {
          ...contentFilter,
          dmConversationId: { in: joinedDmConversationIds },
          userId: userId || undefined,
          createdAt: hasDateFilter ? dateFilter : undefined,
          deletedAt: null,
        },
        include: {
          user: {
            select: {
              id: true,
              displayName: true,
              avatarUrl: true,
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
        orderBy: {
          createdAt: "desc",
        },
        take: limit,
      });

      // Format and merge messages
      const formatChannelMessage = (message: any) => ({
        id: message.id,
        content: message.content,
        createdAt: message.createdAt,
        user: message.user,
        channel: {
          id: message.channel.id,
          name: message.channel.name,
        },
        type: "channel",
      });

      const formatDmMessage = (message: any) => {
        const otherMembers = message.dmConversation.members
          .filter((m: any) => m.user.id !== currentUserId)
          .map((m: any) => m.user);

        return {
          id: message.id,
          content: message.content,
          createdAt: message.createdAt,
          user: message.user,
          dmConversation: {
            id: message.dmConversation.id,
            participants: otherMembers,
          },
          type: "dm",
        };
      };

      const allMessages = [
        ...channelMessages.map(formatChannelMessage),
        ...dmMessages.map(formatDmMessage),
      ].sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      results.messages = allMessages;
    }

    // Search files (by message content association)
    if (type === "all" || type === "files") {
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

      // Search attachments with message content matching query
      const fileFilter: any = {
        message: {
          OR: [
            { channelId: { in: joinedChannelIds } },
            { dmConversationId: { in: joinedDmConversationIds } },
          ],
          deletedAt: null,
        },
      };

      if (query) {
        fileFilter.message = {
          ...fileFilter.message,
          content: {
            contains: query,
            mode: "insensitive",
          },
        };
      }

      if (channelId) {
        fileFilter.message = {
          ...fileFilter.message,
          channelId,
        };
      }

      const attachments = await prisma.attachment.findMany({
        where: fileFilter,
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
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
        take: limit,
      });

      results.files = attachments.map((attachment: any) => ({
        id: attachment.id,
        fileName: attachment.fileName,
        mimeType: attachment.mimeType,
        fileSize: attachment.fileSize?.toString(),
        createdAt: attachment.createdAt,
        message: {
          id: attachment.message.id,
          content: attachment.message.content,
          channel: attachment.message.channel,
        },
        sender: attachment.message?.user,
      }));
    }

    // Search channels
    if (type === "all" || type === "channels") {
      const channelFilter: any = {
        deletedAt: null,
      };

      if (query) {
        channelFilter.OR = [
          {
            name: {
              contains: query,
              mode: "insensitive",
            },
          },
          {
            description: {
              contains: query,
              mode: "insensitive",
            },
          },
        ];
      }

      // Get channels user has joined
      const joinedChannels = await prisma.channel.findMany({
        where: {
          ...channelFilter,
          members: {
            some: {
              userId: currentUserId,
            },
          },
        },
        select: {
          id: true,
          name: true,
          description: true,
          isPrivate: true,
          createdAt: true,
          createdBy: {
            select: {
              id: true,
              displayName: true,
              avatarUrl: true,
            },
          },
          _count: {
            select: {
              members: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
        take: limit,
      });

      results.channels = joinedChannels.map((channel: any) => ({
        ...channel,
        memberCount: channel._count.members,
      }));
    }

    // Search users
    if (type === "all" || type === "users") {
      if (query) {
        const users = await prisma.user.findMany({
          where: {
            id: { not: currentUserId },
            OR: [
              {
                email: {
                  contains: query,
                  mode: "insensitive",
                },
              },
              {
                displayName: {
                  contains: query,
                  mode: "insensitive",
                },
              },
              {
                realName: {
                  contains: query,
                  mode: "insensitive",
                },
              },
            ],
          },
          select: {
            id: true,
            email: true,
            displayName: true,
            realName: true,
            avatarUrl: true,
            isOnline: true,
            lastSeenAt: true,
          },
          orderBy: [
            { isOnline: "desc" },
            { displayName: "asc" },
          ],
          take: limit,
        });

        results.users = users;
      } else {
        results.users = [];
      }
    }

    return NextResponse.json({
      query,
      type,
      results,
    });
  } catch (error) {
    console.error("Error occurred while searching:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
