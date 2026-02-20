import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { unauthorizedResponse } from "@/lib/api-response";

// Mark all as read API
export async function POST(request: NextRequest) {
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
    const now = new Date();

    // Get all channel membership records for user (with unread messages)
    const channelMembers = await prisma.channelMember.findMany({
      where: {
        userId: currentUserId,
        unreadCount: { gt: 0 },
      },
      select: {
        id: true,
        channelId: true,
        channel: {
          select: {
            name: true,
          },
        },
      },
    });

    // Get all DM membership records for user (with unread messages)
    const dmMembers = await prisma.dMConversationMember.findMany({
      where: {
        userId: currentUserId,
        unreadCount: { gt: 0 },
      },
      select: {
        id: true,
        conversationId: true,
        conversation: {
          select: {
            id: true,
          },
        },
      },
    });

    // Get latest message for each DM conversation
    const dmConversationIds = dmMembers.map((m) => m.conversationId);
    const latestDmMessages = await prisma.message.findMany({
      where: {
        dmConversationId: { in: dmConversationIds },
      },
      orderBy: {
        createdAt: "desc",
      },
      distinct: ["dmConversationId"],
      select: {
        id: true,
        dmConversationId: true,
      },
    });

    const latestDmMessageMap = new Map(
      latestDmMessages.map((m) => [m.dmConversationId, m.id]),
    );

    // Batch update channel members read status
    if (channelMembers.length > 0) {
      await prisma.channelMember.updateMany({
        where: {
          id: { in: channelMembers.map((m) => m.id) },
        },
        data: {
          lastReadAt: now,
          unreadCount: 0,
        },
      });
    }

    // Batch update DM members read status
    if (dmMembers.length > 0) {
      const updates = dmMembers.map((member) => {
        const lastReadMessageId = latestDmMessageMap.get(member.conversationId);
        return prisma.dMConversationMember.update({
          where: {
            id: member.id,
          },
          data: {
            lastReadAt: now,
            unreadCount: 0,
            lastReadMessageId,
          },
        });
      });
      await prisma.$transaction(updates);
    }

    const totalMarked = channelMembers.length + dmMembers.length;

    return NextResponse.json({
      message: "All messages marked as read",
      channelsMarkedRead: channelMembers.length,
      conversationsMarkedRead: dmMembers.length,
      totalMarked,
    });
  } catch (error) {
    console.error("Error marking all as read:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
