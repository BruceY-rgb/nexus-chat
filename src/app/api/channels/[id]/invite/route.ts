import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { unauthorizedResponse } from '@/lib/api-response';

// 邀请成员到频道 API
export async function POST(
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
    const { userIds } = body;

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return NextResponse.json(
        { error: 'userIds is required and must be an array' },
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

    // 检查当前用户权限（Owner 或 Admin 可以邀请成员）
    const currentMember = channel.members[0];
    const isOwner = currentMember?.role === 'owner';
    const isAdmin = currentMember?.role === 'admin';

    // 如果既不是 owner 也不是 admin，不允许邀请
    if (!isOwner && !isAdmin) {
      return NextResponse.json(
        { error: 'Only channel owner and admin can invite members' },
        { status: 403 }
      );
    }

    // 检查被邀请的用户是否存在
    const usersToInvite = await prisma.user.findMany({
      where: {
        id: { in: userIds }
      },
      select: {
        id: true,
        displayName: true,
        realName: true,
        avatarUrl: true
      }
    });

    if (usersToInvite.length === 0) {
      return NextResponse.json(
        { error: 'No valid users found to invite' },
        { status: 400 }
      );
    }

    // 获取频道现有成员
    const existingMembers = await prisma.channelMember.findMany({
      where: {
        channelId,
        userId: { in: userIds }
      },
      select: {
        userId: true
      }
    });

    const existingMemberIds = new Set(existingMembers.map(m => m.userId));

    // 过滤掉已经是频道成员的用户
    const newUserIds = usersToInvite
      .filter(user => !existingMemberIds.has(user.id))
      .map(user => user.id);

    if (newUserIds.length === 0) {
      return NextResponse.json(
        { error: 'All users are already channel members' },
        { status: 400 }
      );
    }

    // 批量创建成员关系
    const invitedMembers = await prisma.channelMember.createManyAndReturn({
      data: newUserIds.map(userId => ({
        channelId,
        userId,
        role: 'member'
      })),
      include: {
        user: {
          select: {
            id: true,
            displayName: true,
            realName: true,
            avatarUrl: true,
            email: true
          }
        }
      }
    });

    return NextResponse.json({
      message: `Successfully invited ${invitedMembers.length} member(s)`,
      invitedMembers: invitedMembers.map(m => ({
        id: m.user.id,
        displayName: m.user.displayName,
        realName: m.user.realName,
        avatarUrl: m.user.avatarUrl,
        email: m.user.email,
        role: m.role
      })),
      skippedCount: userIds.length - newUserIds.length
    }, { status: 201 });
  } catch (error) {
    console.error('Error inviting members:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
