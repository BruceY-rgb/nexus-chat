import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { unauthorizedResponse } from "@/lib/api-response";

// Update Channel API
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
      return NextResponse.json(unauthorizedResponse("Invalid token"), {
        status: 401,
      });
    }

    const currentUserId = decoded.userId;
    const channelId = params.id;

    // Get request body
    const body = await request.json();
    const { name, description, isPrivate } = body;

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

    // Check if current user is a channel member
    const isMember = channel.members.length > 0;
    if (!isMember) {
      return NextResponse.json(
        { error: "You are not a member of this channel" },
        { status: 403 },
      );
    }

    // Check if current user has permission (Owner can update channel info)
    const currentMember = channel.members[0];
    const isOwner = currentMember?.role === "owner";

    if (!isOwner) {
      return NextResponse.json(
        { error: "Only channel owner can update channel settings" },
        { status: 403 },
      );
    }

    // Build update data
    const updateData: {
      name?: string;
      description?: string | null;
      isPrivate?: boolean;
    } = {};

    if (name !== undefined) {
      const trimmedName = name.trim();
      if (!trimmedName) {
        return NextResponse.json(
          { error: "Channel name cannot be empty" },
          { status: 400 },
        );
      }

      // Check if name already exists (excluding current channel)
      const existingChannel = await prisma.channel.findFirst({
        where: {
          name: trimmedName,
          id: { not: channelId },
        },
      });

      if (existingChannel) {
        return NextResponse.json(
          { error: "Channel name already exists" },
          { status: 400 },
        );
      }

      updateData.name = trimmedName;
    }

    if (description !== undefined) {
      updateData.description = description.trim() || null;
    }

    if (isPrivate !== undefined) {
      updateData.isPrivate = isPrivate;
    }

    // Update channel
    const updatedChannel = await prisma.channel.update({
      where: { id: channelId },
      data: updateData,
    });

    return NextResponse.json({
      message: "Channel updated successfully",
      channel: {
        id: updatedChannel.id,
        name: updatedChannel.name,
        description: updatedChannel.description,
        isPrivate: updatedChannel.isPrivate,
      },
    });
  } catch (error) {
    console.error("Error updating channel:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
