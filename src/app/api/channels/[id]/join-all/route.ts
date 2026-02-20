import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { unauthorizedResponse } from "@/lib/api-response";

// Batch join channel API - add all team members to specified channel
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
      return NextResponse.json(unauthorizedResponse("invalid token"), {
        status: 401,
      });
    }

    const channelId = params.id;

    // Check if channel exists
    const channel = await prisma.channel.findUnique({
      where: { id: channelId },
    });

    if (!channel) {
      return NextResponse.json({ error: "Channel not found" }, { status: 404 });
    }

    // Get all team members
    const teamMembers = await prisma.teamMember.findMany({
      where: {
        status: "active",
      },
      include: {
        user: {
          select: {
            id: true,
            displayName: true,
            email: true,
          },
        },
      },
    });

    // Get existing channel members
    const existingMembers = await prisma.channelMember.findMany({
      where: {
        channelId: channelId,
      },
      select: {
        userId: true,
      },
    });

    const existingMemberIds = new Set(existingMembers.map((m) => m.userId));

    // Filter out members who have already joined
    const newMembers = teamMembers.filter(
      (tm) => !existingMemberIds.has(tm.userId),
    );

    // Batch create channel member records
    const createdMembers = await Promise.all(
      newMembers.map((member) =>
        prisma.channelMember.create({
          data: {
            channelId: channelId,
            userId: member.userId,
            role: "member",
          },
          include: {
            user: {
              select: {
                id: true,
                email: true,
                displayName: true,
                realName: true,
                avatarUrl: true,
                isOnline: true,
              },
            },
          },
        }),
      ),
    );

    return NextResponse.json({
      message: `Successfully added ${createdMembers.length} members to the channel`,
      channel: {
        id: channel.id,
        name: channel.name,
      },
      addedMembers: createdMembers.map((member) => ({
        id: member.user.id,
        displayName: member.user.displayName,
        email: member.user.email,
      })),
    });
  } catch (error) {
    console.error("Error joining all members to channel:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
