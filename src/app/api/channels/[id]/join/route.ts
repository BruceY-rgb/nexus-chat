import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { unauthorizedResponse } from "@/lib/api-response";

// Join Channel API
export async function POST(
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
      return NextResponse.json(unauthorizedResponse("Invalid token"), {
        status: 401,
      });
    }

    const currentUserId = decoded.userId;
    const channelId = params.id;

    // Check if channel exists
    const channel = await prisma.channel.findUnique({
      where: { id: channelId },
      include: {
        members: {
          where: { userId: currentUserId },
        },
      },
    });

    if (!channel) {
      return NextResponse.json({ error: "Channel not found" }, { status: 404 });
    }

    // Check if already a member
    if (channel.members.length > 0) {
      return NextResponse.json(
        { error: "Already a member of this channel" },
        { status: 400 },
      );
    }

    // Check private channels (temporarily allowed to join, approval flow can be added later)
    if (channel.isPrivate) {
      // TODO: Add approval flow here, such as sending join request
      // Currently temporarily allowed to join
    }

    // Join channel
    const channelMember = await prisma.channelMember.create({
      data: {
        channelId,
        userId: currentUserId,
        role: "member",
      },
      include: {
        channel: {
          select: {
            id: true,
            name: true,
            description: true,
            isPrivate: true,
          },
        },
        user: {
          select: {
            id: true,
            displayName: true,
            avatarUrl: true,
          },
        },
      },
    });

    return NextResponse.json(
      {
        message: "Successfully joined the channel",
        channelMember,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Error joining channel:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
