import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { unauthorizedResponse } from '@/lib/api-response';

// 离开频道 API
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

    // 检查频道是否存在
    const channel = await prisma.channel.findUnique({
      where: { id: channelId }
    });

    if (!channel) {
      return NextResponse.json(
        { error: 'Channel not found' },
        { status: 404 }
      );
    }

    // 检查是否是频道创建者
    if (channel.createdById === currentUserId) {
      return NextResponse.json(
        { error: 'Channel owner cannot leave the channel. Delete the channel instead.' },
        { status: 400 }
      );
    }

    // 检查是否是成员
    const channelMember = await prisma.channelMember.findFirst({
      where: {
        channelId,
        userId: currentUserId
      }
    });

    if (!channelMember) {
      return NextResponse.json(
        { error: 'Not a member of this channel' },
        { status: 400 }
      );
    }

    // 离开频道
    await prisma.channelMember.delete({
      where: {
        id: channelMember.id
      }
    });

    return NextResponse.json({
      message: 'Successfully left the channel',
      channelId
    });
  } catch (error) {
    console.error('Error leaving channel:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
