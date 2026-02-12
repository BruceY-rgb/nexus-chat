import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { unauthorizedResponse } from '@/lib/api-response';

// 移除频道成员 API
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

    // 验证 token
    const decoded = verifyToken(token);
    if (!decoded) {
      return NextResponse.json(
        unauthorizedResponse('token无效'),
        { status: 401 }
      );
    }

    const currentUserId = decoded.userId;
    const channelId = params.id;

    // 获取请求体
    const body = await request.json();
    const { userId } = body;

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      );
    }

    // 检查频道是否存在
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

    // 检查当前用户是否是频道成员
    const isMember = channel.members.length > 0;
    if (!isMember) {
      return NextResponse.json(
        { error: 'You are not a member of this channel' },
        { status: 403 }
      );
    }

    // 检查当前用户权限（Owner 或 Admin 可以移除成员）
    const currentMember = channel.members[0];
    const isOwner = currentMember?.role === 'owner';
    const isAdmin = currentMember?.role === 'admin';

    // 如果既不是 owner 也不是 admin，不允许移除
    if (!isOwner && !isAdmin) {
      return NextResponse.json(
        { error: 'Only channel owner and admin can remove members' },
        { status: 403 }
      );
    }

    // 检查要移除的用户是否是频道成员
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

    // 不能移除频道 owner
    if (memberToRemove.role === 'owner') {
      return NextResponse.json(
        { error: 'Cannot remove channel owner' },
        { status: 400 }
      );
    }

    // 移除成员
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
