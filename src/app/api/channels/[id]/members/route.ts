import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { unauthorizedResponse } from '@/lib/api-response';

// 获取频道成员列表 API
export async function GET(
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

    const channelId = params.id;
    const currentUserId = decoded.userId;

    // 检查频道是否存在
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
                email: true,
                displayName: true,
                realName: true,
                avatarUrl: true,
                isOnline: true,
                lastSeenAt: true
              }
            },
            role: true,
            joinedAt: true
          }
        }
      }
    });

    if (!channel) {
      return NextResponse.json(
        { error: 'Channel not found' },
        { status: 404 }
      );
    }

    // 检查用户是否是频道成员（包括私有和公有频道）
    const isMember = channel.members.some(member => member.user.id === currentUserId);

    if (!isMember) {
      return NextResponse.json(
        { error: 'You are not a member of this channel' },
        { status: 403 }
      );
    }

    // 格式化返回数据
    const members = channel.members.map((member) => ({
      id: member.user.id,
      email: member.user.email,
      displayName: member.user.displayName,
      realName: member.user.realName,
      avatarUrl: member.user.avatarUrl,
      isOnline: member.user.isOnline,
      lastSeenAt: member.user.lastSeenAt,
      role: (member as any).role,
      joinedAt: (member as any).joinedAt
    }));

    return NextResponse.json({
      members
    });
  } catch (error) {
    console.error('Error fetching channel members:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
