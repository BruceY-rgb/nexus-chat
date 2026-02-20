import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { unauthorizedResponse } from "@/lib/api-response";

// Leave Channel API
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
    });

    if (!channel) {
      return NextResponse.json({ error: "Channel not found" }, { status: 404 });
    }

    // Check if is a member
    const channelMember = await prisma.channelMember.findFirst({
      where: {
        channelId,
        userId: currentUserId,
      },
    });

    if (!channelMember) {
      return NextResponse.json(
        { error: "Not a member of this channel" },
        { status: 400 },
      );
    }

    // Check if is channel creator
    const isOwner = channel.createdById === currentUserId;

    // If channel creator, check remaining member count
    if (isOwner) {
      // Get total member count of channel
      const memberCount = await prisma.channelMember.count({
        where: { channelId },
      });

      // If channel becomes empty after removing current member, delete the entire channel
      if (memberCount <= 1) {
        await prisma.$transaction([
          // Delete channel member relationship
          prisma.channelMember.delete({
            where: {
              id: channelMember.id,
            },
          }),
          // Soft delete channel
          prisma.channel.update({
            where: {
              id: channelId,
            },
            data: {
              deletedAt: new Date(),
            },
          }),
        ]);

        return NextResponse.json({
          message: "You were the last member. The channel has been deleted.",
          channelId,
          channelDeleted: true,
        });
      } else {
        // There are other members, transfer ownership to another member
        // Get other members except current user
        const otherMembers = await prisma.channelMember.findMany({
          where: {
            channelId,
            userId: { not: currentUserId },
          },
          take: 1,
        });

        if (otherMembers.length > 0) {
          const newOwner = otherMembers[0];

          await prisma.$transaction([
            // Delete current member
            prisma.channelMember.delete({
              where: {
                id: channelMember.id,
              },
            }),
            // Transfer ownership
            prisma.channel.update({
              where: {
                id: channelId,
              },
              data: {
                createdById: newOwner.userId,
              },
            }),
            // Update new owner's role
            prisma.channelMember.update({
              where: {
                id: newOwner.id,
              },
              data: {
                role: "owner",
              },
            }),
          ]);

          return NextResponse.json({
            message:
              "You left the channel. Ownership has been transferred to another member.",
            channelId,
            ownershipTransferred: true,
          });
        }
      }
    }

    // Regular member leaves channel
    await prisma.channelMember.delete({
      where: {
        id: channelMember.id,
      },
    });

    return NextResponse.json({
      message: "Successfully left the channel",
      channelId,
    });
  } catch (error) {
    console.error("Error leaving channel:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
