import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { unauthorizedResponse } from '@/lib/api-response';

// 用户搜索 API
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
    const query = searchParams.get('q');

    if (!query || query.trim() === '') {
      return NextResponse.json(
        { error: 'Search query is required' },
        { status: 400 }
      );
    }

    const searchTerm = query.trim();

    // 搜索用户（邮箱、显示名、真实姓名）
    const users = await prisma.user.findMany({
      where: {
        AND: [
          { id: { not: currentUserId } }, // 排除当前用户
          {
            OR: [
              {
                email: {
                  contains: searchTerm,
                  mode: 'insensitive'
                }
              },
              {
                displayName: {
                  contains: searchTerm,
                  mode: 'insensitive'
                }
              },
              {
                realName: {
                  contains: searchTerm,
                  mode: 'insensitive'
                }
              }
            ]
          }
        ]
      },
      select: {
        id: true,
        email: true,
        displayName: true,
        realName: true,
        avatarUrl: true,
        isOnline: true,
        lastSeenAt: true
      },
      orderBy: [
        { isOnline: 'desc' }, // 在线用户排在前面
        { displayName: 'asc' }
      ],
      take: 20 // 限制搜索结果数量
    });

    // 对搜索结果进行匹配度排序
    const sortedUsers = users.sort((a, b) => {
      // 优先显示精确匹配
      const aExactMatch =
        a.email.toLowerCase() === searchTerm.toLowerCase() ||
        a.displayName.toLowerCase() === searchTerm.toLowerCase() ||
        (a.realName && a.realName.toLowerCase() === searchTerm.toLowerCase());

      const bExactMatch =
        b.email.toLowerCase() === searchTerm.toLowerCase() ||
        b.displayName.toLowerCase() === searchTerm.toLowerCase() ||
        (b.realName && b.realName.toLowerCase() === searchTerm.toLowerCase());

      if (aExactMatch && !bExactMatch) return -1;
      if (!aExactMatch && bExactMatch) return 1;

      // 然后按匹配度排序（开头匹配优先）
      const aStartsWith =
        a.email.toLowerCase().startsWith(searchTerm.toLowerCase()) ||
        a.displayName.toLowerCase().startsWith(searchTerm.toLowerCase()) ||
        (a.realName && a.realName.toLowerCase().startsWith(searchTerm.toLowerCase()));

      const bStartsWith =
        b.email.toLowerCase().startsWith(searchTerm.toLowerCase()) ||
        b.displayName.toLowerCase().startsWith(searchTerm.toLowerCase()) ||
        (b.realName && b.realName.toLowerCase().startsWith(searchTerm.toLowerCase()));

      if (aStartsWith && !bStartsWith) return -1;
      if (!aStartsWith && bStartsWith) return 1;

      return 0;
    });

    return NextResponse.json({
      users: sortedUsers,
      query: searchTerm,
      count: sortedUsers.length
    });
  } catch (error) {
    console.error('Error searching users:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
