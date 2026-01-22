import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { unauthorizedResponse } from '@/lib/api-response';

// 获取频道列表 API
export async function GET(request: NextRequest) {
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
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'all'; // 'all', 'joined', 'public', 'private'
    const search = searchParams.get('search') || '';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = (page - 1) * limit;

    // 构建查询条件
    let where: any = {
      deletedAt: null
    };

    // 根据类型过滤
    if (type === 'joined') {
      // 只获取已加入的频道
      where.members = {
        some: {
          userId: currentUserId
        }
      };
    } else if (type === 'public') {
      where.isPrivate = false;
    } else if (type === 'private') {
      where.isPrivate = true;
      // 私有频道只能看到自己加入的
      where.members = {
        some: {
          userId: currentUserId
        }
      };
    }

    // 搜索过滤
    if (search) {
      where.AND = where.AND || [];
      where.AND.push({
        OR: [
          {
            name: {
              contains: search,
              mode: 'insensitive'
            }
          },
          {
            description: {
              contains: search,
              mode: 'insensitive'
            }
          }
        ]
      });
    }

    // 获取频道列表
    const [channels, total] = await Promise.all([
      prisma.channel.findMany({
        where,
        select: {
          id: true,
          name: true,
          description: true,
          isPrivate: true,
          createdAt: true,
          createdBy: {
            select: {
              id: true,
              displayName: true,
              avatarUrl: true
            }
          },
          _count: {
            select: {
              members: true
            }
          },
          members: {
            where: {
              userId: currentUserId
            },
            select: {
              id: true,
              role: true,
              joinedAt: true
            }
          }
        },
        orderBy: [
          { createdAt: 'desc' }
        ],
        skip: offset,
        take: limit
      }),
      prisma.channel.count({ where })
    ]);

    // 格式化返回数据
    const formattedChannels = channels.map((channel: any) => ({
      ...channel,
      isJoined: channel.members.length > 0,
      memberCount: channel._count.members,
      members: undefined // 移除members字段，避免冗余
    }));

    return NextResponse.json({
      channels: formattedChannels,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrevious: page > 1
      }
    });
  } catch (error) {
    console.error('Error fetching channels:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// 创建频道 API
export async function POST(request: NextRequest) {
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
    const body = await request.json();
    const { name, description, isPrivate } = body;

    // 验证输入
    if (!name || typeof name !== 'string' || name.trim() === '') {
      return NextResponse.json(
        { error: 'Channel name is required' },
        { status: 400 }
      );
    }

    // 检查频道名称是否已存在
    const existingChannel = await prisma.channel.findUnique({
      where: { name: name.trim() }
    });

    if (existingChannel) {
      return NextResponse.json(
        { error: 'Channel name already exists' },
        { status: 400 }
      );
    }

    // 创建频道
    const channel = await prisma.channel.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        isPrivate: isPrivate || false,
        createdById: currentUserId
      },
      select: {
        id: true,
        name: true,
        description: true,
        isPrivate: true,
        createdAt: true,
        createdBy: {
          select: {
            id: true,
            displayName: true,
            avatarUrl: true
          }
        }
      }
    });

    // 自动将创建者添加为频道成员
    await prisma.channelMember.create({
      data: {
        channelId: channel.id,
        userId: currentUserId,
        role: 'owner'
      }
    });

    return NextResponse.json({
      channel: {
        ...channel,
        isJoined: true,
        memberCount: 1
      }
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating channel:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
