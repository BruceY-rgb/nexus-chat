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

    // 检查是否是频道创建者
    const isOwner = channel.createdById === currentUserId;

    // 如果是频道创建者，检查剩余成员数量
    if (isOwner) {
      // 获取频道的成员总数
      const memberCount = await prisma.channelMember.count({
        where: { channelId }
      });

      // 如果删除当前成员后频道为空，则删除整个频道
      if (memberCount <= 1) {
        await prisma.$transaction([
          // 删除频道成员关系
          prisma.channelMember.delete({
            where: {
              id: channelMember.id
            }
          }),
          // 软删除频道
          prisma.channel.update({
            where: {
              id: channelId
            },
            data: {
              deletedAt: new Date()
            }
          })
        ]);

        return NextResponse.json({
          message: 'You were the last member. The channel has been deleted.',
          channelId,
          channelDeleted: true
        });
      } else {
        // 有其他成员，转移所有权给另一个成员
        // 获取除当前用户外的其他成员
        const otherMembers = await prisma.channelMember.findMany({
          where: {
            channelId,
            userId: { not: currentUserId }
          },
          take: 1
        });

        if (otherMembers.length > 0) {
          const newOwner = otherMembers[0];

          await prisma.$transaction([
            // 删除当前成员
            prisma.channelMember.delete({
              where: {
                id: channelMember.id
              }
            }),
            // 转移所有权
            prisma.channel.update({
              where: {
                id: channelId
              },
              data: {
                createdById: newOwner.userId
              }
            }),
            // 更新新所有者的角色
            prisma.channelMember.update({
              where: {
                id: newOwner.id
              },
              data: {
                role: 'owner'
              }
            })
          ]);

          return NextResponse.json({
            message: 'You left the channel. Ownership has been transferred to another member.',
            channelId,
            ownershipTransferred: true
          });
        }
      }
    }

    // 普通成员离开频道
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
