import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { unauthorizedResponse } from "@/lib/api-response";

type NotificationLevel = "all" | "mentions" | "nothing";

// Update channel notification preferences API
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
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
    const channelId = params.id;

    const body = await request.json();
    const { notificationLevel } = body as {
      notificationLevel: NotificationLevel;
    };

    // Validate notificationLevel value
    if (
      !notificationLevel ||
      !["all", "mentions", "nothing"].includes(notificationLevel)
    ) {
      return NextResponse.json(
        {
          error:
            'Invalid notification level. Must be "all", "mentions", or "nothing"',
        },
        { status: 400 },
      );
    }

    // Check if channel exists
    const channel = await prisma.channel.findUnique({
      where: { id: channelId },
    });

    if (!channel) {
      return NextResponse.json({ error: "Channel not found" }, { status: 404 });
    }

    // Update channel member notification preferences
    try {
      const updatedMember = await prisma.channelMember.update({
        where: {
          channelId_userId: {
            channelId,
            userId: currentUserId,
          },
        },
        data: {
          notificationLevel,
        },
      });

      return NextResponse.json({
        message: "Notification preferences updated successfully",
        notificationLevel: updatedMember.notificationLevel,
      });
    } catch (updateError: any) {
      console.error("Update error:", updateError);
      // If record not found error
      if (updateError.code === "P2025") {
        return NextResponse.json(
          { error: "You are not a member of this channel" },
          { status: 403 },
        );
      }
      throw updateError;
    }
  } catch (error) {
    console.error("Error updating notification preferences:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}

// Get channel notification preferences API
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
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
    const channelId = params.id;

    // Get channel member notification preferences
    const member = await prisma.channelMember.findUnique({
      where: {
        channelId_userId: {
          channelId,
          userId: currentUserId,
        },
      },
    });

    if (!member) {
      return NextResponse.json(
        { error: "You are not a member of this channel" },
        { status: 403 },
      );
    }

    return NextResponse.json({
      notificationLevel: member.notificationLevel,
    });
  } catch (error) {
    console.error("Error getting notification preferences:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
