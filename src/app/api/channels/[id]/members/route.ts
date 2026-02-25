import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { unauthorizedResponse } from "@/lib/api-response";

// Get channel members list API
export async function GET(
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

    const channelId = params.id;
    const currentUserId = decoded.userId;

    // Check if channel exists
    const channel = await prisma.channel.findUnique({
      where: { id: channelId },
      select: {
        id: true,
        name: true,
        isPrivate: true,
        members: {
          select: {
            user: {
              select: {
                id: true,
                slackUserId: true,
                email: true,
                displayName: true,
                realName: true,
                avatarUrl: true,
                isOnline: true,
                lastSeenAt: true,
              },
            },
            role: true,
            joinedAt: true,
          },
        },
      },
    });

    if (!channel) {
      return NextResponse.json({ error: "Channel not found" }, { status: 404 });
    }

    // Check if user is a channel member (including private and public channels)
    const isMember = channel.members.some(
      (member) => member.user.id === currentUserId,
    );

    if (!isMember) {
      return NextResponse.json(
        { error: "You are not a member of this channel" },
        { status: 403 },
      );
    }

    // Format return data
    const members = channel.members.map((member) => ({
      id: member.user.id,
      slackUserId: member.user.slackUserId,
      email: member.user.email,
      displayName: member.user.displayName,
      realName: member.user.realName,
      avatarUrl: member.user.avatarUrl,
      isOnline: member.user.isOnline,
      lastSeenAt: member.user.lastSeenAt,
      role: (member as any).role,
      joinedAt: (member as any).joinedAt,
    }));

    return NextResponse.json({
      members,
    });
  } catch (error) {
    console.error("Error fetching channel members:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
