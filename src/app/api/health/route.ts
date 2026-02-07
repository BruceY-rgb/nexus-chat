import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

// 健康检查接口
export async function GET(request: NextRequest) {
  const healthCheck: any = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    checks: {
      database: 'unknown',
      websocket: 'unknown',
      auth: 'unknown'
    }
  };

  try {
    // 1. 检查数据库连接
    try {
      await prisma.$queryRaw`SELECT 1`;
      healthCheck.checks.database = 'connected';
    } catch (error) {
      healthCheck.checks.database = 'error';
      healthCheck.status = 'degraded';
      console.error('Database health check failed:', error);
    }

    // 2. 检查 WebSocket
    try {
      if (typeof (global as any).io !== 'undefined') {
        const io = (global as any).io;
        // 防御性检查：确保 io 实例有效
        if (io && typeof io === 'object' && io.engine) {
          healthCheck.checks.websocket = 'available';
          healthCheck.websocket = {
            connectedClients: io.engine.clientsCount,
            namespaces: io._nsps ? Object.keys(io._nsps).length : 0,
            hasEngine: !!io.engine,
            hasNsps: !!io._nsps,
            hasNspsLegacy: !!io.nsps
          };
        } else {
          healthCheck.checks.websocket = 'not-initialized';
          healthCheck.status = 'degraded';
          console.warn('WebSocket instance exists but is not properly initialized');
        }
      } else {
        healthCheck.checks.websocket = 'not-initialized';
        healthCheck.status = 'degraded';
      }
    } catch (error) {
      healthCheck.checks.websocket = 'error';
      healthCheck.status = 'degraded';
      console.error('WebSocket health check failed:', error);
    }

    // 3. 检查认证
    try {
      const token = request.cookies.get('auth_token')?.value;

      if (token) {
        const decoded = verifyToken(token);
        if (decoded) {
          healthCheck.checks.auth = 'authenticated';
          healthCheck.auth = {
            userId: decoded.userId,
            tokenValid: true
          };
        } else {
          healthCheck.checks.auth = 'invalid-token';
        }
      } else {
        healthCheck.checks.auth = 'no-token';
      }
    } catch (error) {
      healthCheck.checks.auth = 'error';
      healthCheck.status = 'degraded';
      console.error('Auth health check failed:', error);
    }

    const statusCode = healthCheck.status === 'ok' ? 200 : 503;

    return NextResponse.json(healthCheck, { status: statusCode });

  } catch (error) {
    console.error('Health check error:', error);

    return NextResponse.json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: 'Health check failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// 详细健康检查接口（需要认证）
export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('auth_token')?.value;

    if (!token) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const decoded = verifyToken(token);

    if (!decoded) {
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 401 }
      );
    }

    const currentUserId = decoded.userId;

    // 获取用户详细信息
    const user = await prisma.user.findUnique({
      where: { id: currentUserId },
      select: {
        id: true,
        email: true,
        displayName: true,
        isOnline: true,
        lastSeenAt: true
      }
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // 获取用户统计数据
    const stats = {
      user,
      statistics: {
        totalChannels: await prisma.channelMember.count({
          where: { userId: currentUserId }
        }),
        totalDMConversations: await prisma.dMConversationMember.count({
          where: { userId: currentUserId }
        }),
        totalMessages: await prisma.message.count({
          where: { userId: currentUserId }
        }),
        unreadMessages: await prisma.channelMember.aggregate({
          where: { userId: currentUserId },
          _sum: { unreadCount: true }
        })
      }
    };

    // 获取最近的频道
    const recentChannels = await prisma.channel.findMany({
      where: {
        members: {
          some: { userId: currentUserId }
        }
      },
      select: {
        id: true,
        name: true,
        isPrivate: true
      },
      take: 5
    });

    // 获取最近的私聊
    const recentDMs = await prisma.dMConversation.findMany({
      where: {
        members: {
          some: { userId: currentUserId }
        }
      },
      orderBy: {
        lastMessageAt: 'desc'
      },
      select: {
        id: true,
        lastMessageAt: true
      },
      take: 5
    });

    return NextResponse.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      data: {
        ...stats,
        recentChannels,
        recentDMs
      }
    });

  } catch (error) {
    console.error('Detailed health check error:', error);

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
