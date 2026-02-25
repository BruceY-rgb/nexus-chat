import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { unauthorizedResponse } from '@/lib/api-response';

// Remove channel member API
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const token = request.cookies.get('auth_token')?.value;

    if (!token) {
      return NextResponse.json(
        unauthorizedResponse(),
        { status: 401 }
      );
    }

    // Verify token
    const decoded = verifyToken(token);
    if (!decoded) {
      return NextResponse.json(
        unauthorizedResponse('Invalid token'),
        { status: 401 }
      );
    }

    const currentUserId = decoded.userId;
    const channelId = params.id;

    // Get request body
    const body = await request.json();
    const { userId } = body;

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      );
    }

    // Check if channel exists
    const channel = await prisma.channel.findUnique({
      where: { id: channelId },
      include: {
        members: {
          where: { userId: currentUserId }
        }
      }
    });

    if (!channel) {
      return NextResponse.json(
        { error: 'Channel not found' },
        { status: 404 }
      );
    }

    // Check if current user is a channel member
    const isMember = channel.members.length > 0;
    if (!isMember) {
      return NextResponse.json(
        { error: 'You are not a member of this channel' },
        { status: 403 }
      );
    }

    // Check current user permissions (Owner or Admin can remove members)
    const currentMember = channel.members[0];
    const isOwner = currentMember?.role === 'owner';
    const isAdmin = currentMember?.role === 'admin';

    // If neither owner nor admin, not allowed to remove
    if (!isOwner && !isAdmin) {
      return NextResponse.json(
        { error: 'Only channel owner and admin can remove members' },
        { status: 403 }
      );
    }

    // Check if the user to be removed is a channel member
    const memberToRemove = await prisma.channelMember.findFirst({
      where: {
        channelId,
        userId
      }
    });

    if (!memberToRemove) {
      return NextResponse.json(
        { error: 'User is not a member of this channel' },
        { status: 400 }
      );
    }

    // Cannot remove channel owner
    if (memberToRemove.role === 'owner') {
      return NextResponse.json(
        { error: 'Cannot remove channel owner' },
        { status: 400 }
      );
    }

    // Remove member
    await prisma.channelMember.delete({
      where: {
        id: memberToRemove.id
      }
    });

    return NextResponse.json({
      message: 'Successfully removed member from channel'
    });
  } catch (error) {
    console.error('Error removing member:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
