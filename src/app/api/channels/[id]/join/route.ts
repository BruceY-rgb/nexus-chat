import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { unauthorizedResponse } from '@/lib/api-response';

// 加入频道 API
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

    // 检查是否已经是成员
    if (channel.members.length > 0) {
      return NextResponse.json(
        { error: 'Already a member of this channel' },
        { status: 400 }
      );
    }

    // 检查私有频道（暂时允许加入，后续可以添加审批流程）
    if (channel.isPrivate) {
      // TODO: 这里可以添加审批流程，比如发送加入申请
      // 现在暂时允许加入
    }

    // 加入频道
    const channelMember = await prisma.channelMember.create({
      data: {
        channelId,
        userId: currentUserId,
        role: 'member'
      },
      include: {
        channel: {
          select: {
            id: true,
            name: true,
            description: true,
            isPrivate: true
          }
        },
        user: {
          select: {
            id: true,
            displayName: true,
            avatarUrl: true
          }
        }
      }
    });

    return NextResponse.json({
      message: 'Successfully joined the channel',
      channelMember
    }, { status: 201 });
  } catch (error) {
    console.error('Error joining channel:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
