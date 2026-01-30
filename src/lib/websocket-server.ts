import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HTTPServer } from 'http';
import { verifyToken } from './auth';
import { prisma } from './prisma';

// 扩展 SocketIOServer 类型以支持自定义方法
interface ExtendedSocketIOServer extends SocketIOServer {
  broadcastNewMessage: (message: any, channelId?: string, dmConversationId?: string) => void;
  broadcastMessageUpdate: (message: any, channelId?: string, dmConversationId?: string) => void;
  broadcastMessageDelete: (messageId: string, channelId?: string, dmConversationId?: string) => void;
  broadcastNewNotification: (notification: any, userId: string) => void;
}

// 用户连接信息
interface ConnectedUser {
  userId: string;
  socketId: string;
  channels: Set<string>;
  dmConversations: Set<string>;
}

export function setupWebSocket(httpServer: HTTPServer): ExtendedSocketIOServer {
  // 动态获取允许的域名
  const getAllowedOrigins = () => {
    const origins = [
      "http://127.0.0.1:3000",
      "http://localhost:3000",
      "http://localhost:3001",
    ];

    // 添加生产环境域名
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    if (appUrl) {
      // 添加完整的 URL
      origins.push(appUrl);

      // 从 URL 中提取域名并添加
      try {
        const url = new URL(appUrl.startsWith('http') ? appUrl : `http://${appUrl}`);
        origins.push(url.origin);

        // 如果是 https，也允许 http 版本（反向代理场景）
        if (url.protocol === 'https:') {
          origins.push(`http://${url.host}`);
        }
      } catch (e) {
        console.warn('Invalid NEXT_PUBLIC_APP_URL:', appUrl);
      }
    }

    // 添加 Slack 相关的生产域名（支持 Nginx 反向代理）
    const slackDomains = [
      "https://slack.rlenv.data4o.ai",
      "http://slack.rlenv.data4o.ai",
      "https://www.rlenv.data4o.ai",
      "http://www.rlenv.data4o.ai",
      "https://rlenv.data4o.ai",
      "http://rlenv.data4o.ai",
    ];

    slackDomains.forEach(domain => {
      if (!origins.includes(domain)) {
        origins.push(domain);
      }
    });

    // 添加其他常见生产域名（如果环境变量未设置）
    const prodDomains = [
      "https://instagram.rlenv.data4o.ai",
      "http://instagram.rlenv.data4o.ai"
    ];

    prodDomains.forEach(domain => {
      if (!origins.includes(domain)) {
        origins.push(domain);
      }
    });

    console.log('🔍 [CORS] Allowed origins:', origins);
    return origins;
  };

  const io = new SocketIOServer(httpServer, {
    cors: {
      // 使用函数动态验证 Origin，支持反向代理
      origin: function (origin, callback) {
        // 允许没有 Origin 的请求（移动应用等）
        if (!origin) return callback(null, true);

        const allowedOrigins = getAllowedOrigins();

        // 检查 Origin 是否在允许列表中
        if (allowedOrigins.includes(origin)) {
          console.log('✅ [CORS] Origin allowed:', origin);
          return callback(null, true);
        }

        // 对于 Nginx 反向代理场景，检查是否是来自已知域名的子域名
        try {
          const originUrl = new URL(origin);
          const originHostname = originUrl.hostname;

          // 检查是否是 *.rlenv.data4o.ai 的子域名
          if (originHostname.endsWith('.rlenv.data4o.ai') || originHostname === 'rlenv.data4o.ai') {
            console.log('✅ [CORS] Subdomain allowed:', origin);
            return callback(null, true);
          }

          // 检查是否是 localhost（开发环境）
          if (originHostname === 'localhost' || originHostname === '127.0.0.1') {
            console.log('✅ [CORS] Localhost allowed:', origin);
            return callback(null, true);
          }
        } catch (e) {
          console.warn('⚠️ [CORS] Invalid origin format:', origin);
        }

        // 拒绝未知来源
        console.error('❌ [CORS] Origin not allowed:', origin);
        return callback(new Error('Not allowed by CORS'), false);
      },
      credentials: true,
      methods: ["GET", "POST"],
      allowedHeaders: ["Content-Type", "Authorization", "Cookie", "X-Requested-With"]
    },
    transports: ['websocket', 'polling'],
    // 明确指定 Socket.io 路径（避免与其他应用冲突）
    // 默认是 /socket.io，这里明确指定以增强可读性
    path: '/socket.io',

    // 添加 ping 超时配置（适合反向代理环境）
    pingTimeout: 60000,      // 60秒无活动后断开
    pingInterval: 25000,     // 25秒发送一次 ping

    // 生产环境优化配置
    allowUpgrades: true,     // 允许从轮询升级到 WebSocket
    upgradeTimeout: 10000,   // 10秒升级超时
    connectTimeout: 20000,   // 20秒连接超时

    // 适配反向代理的额外配置
    // 允许更多请求头
    allowEIO3: true,         // 兼容 Engine.IO v3 客户端
  }) as ExtendedSocketIOServer;

  // 存储在线用户信息
  const connectedUsers = new Map<string, ConnectedUser>();

  // 认证中间件
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      const clientInfo = {
        id: socket.id,
        ip: socket.handshake.address,
        userAgent: socket.handshake.headers['user-agent']
      };

      console.log(`🔐 [Auth] New connection attempt:`, clientInfo);

      if (!token) {
        console.error(`❌ [Auth] Authentication failed - No token provided:`, clientInfo);
        return next(new Error('Authentication error: No token provided'));
      }

      const decoded = verifyToken(token);

      if (!decoded) {
        console.error(`❌ [Auth] Authentication failed - Invalid token:`, {
          ...clientInfo,
          tokenPreview: token.substring(0, 20) + '...',
          tokenLength: token.length
        });
        return next(new Error('Authentication error: Invalid token'));
      }

      // 将用户信息附加到 socket
      socket.data.userId = decoded.userId;

      console.log(`✅ [Auth] Authentication successful:`, {
        ...clientInfo,
        userId: decoded.userId
      });

      next();
    } catch (error) {
      console.error(`❌ [Auth] Authentication error:`, {
        error: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined,
        socketId: socket.id
      });
      next(new Error('Authentication error'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const userId = socket.data.userId;
    const connectionInfo = {
      socketId: socket.id,
      userId,
      ip: socket.handshake.address,
      userAgent: socket.handshake.headers['user-agent'],
      transport: socket.conn.transport.name
    };

    console.log(`✅ [Connection] User connected:`, connectionInfo);

    // 错误事件监听
    socket.on('error', (error) => {
      console.error(`❌ [Socket Error] Socket error:`, {
        socketId: socket.id,
        userId,
        error: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined
      });
    });

    // 初始化用户连接信息
    if (!connectedUsers.has(userId)) {
      connectedUsers.set(userId, {
        userId,
        socketId: socket.id,
        channels: new Set(),
        dmConversations: new Set()
      });
    }

    // 加入用户自己的通知房间
    socket.join(`user:${userId}`);

    // 更新用户在线状态
    updateUserPresence(userId, true);

    // 加入频道房间
    socket.on('join-channel', async (channelId: string) => {
      try {
        console.log(`🔍 尝试加入频道:`, { socketId: socket.id, userId, channelId });

        // 验证用户是否有权限加入该频道
        const channelMember = await prisma.channelMember.findFirst({
          where: {
            channelId,
            userId
          },
          include: {
            channel: true
          }
        });

        if (!channelMember) {
          console.log(`❌ 未找到频道成员关系:`, { userId, channelId });
          socket.emit('error', { message: `Not authorized to join channel ${channelId}` });
          return;
        }

        socket.join(`channel:${channelId}`);
        connectedUsers.get(userId)?.channels.add(channelId);

        console.log(`✅ 用户加入频道成功:`, { userId, channelId: channelMember.channel.name, role: channelMember.role });
      } catch (error) {
        console.error('❌ 加入频道错误:', { userId, channelId, error });
        socket.emit('error', { message: 'Failed to join channel' });
      }
    });

    // 离开频道房间
    socket.on('leave-channel', (channelId: string) => {
      socket.leave(`channel:${channelId}`);
      connectedUsers.get(userId)?.channels.delete(channelId);
      console.log(`User ${userId} left channel ${channelId}`);
    });

    // 加入私聊房间
    socket.on('join-dm', async (conversationId: string) => {
      try {
        console.log(`🔍 尝试加入私聊:`, { socketId: socket.id, userId, conversationId });

        // 验证用户是否有权限加入该私聊
        if (!conversationId.startsWith('self-')) {
          const conversationMember = await prisma.dMConversationMember.findFirst({
            where: {
              conversationId,
              userId
            },
            include: {
              conversation: true
            }
          });

          if (!conversationMember) {
            console.log(`❌ 未找到私聊成员关系:`, { userId, conversationId });
            socket.emit('error', { message: `Not authorized to join conversation ${conversationId}` });
            return;
          }

          console.log(`✅ 用户加入私聊成功:`, { userId, conversationId });
        } else {
          // 验证自己的消息空间
          const selfId = conversationId.replace('self-', '');
          if (selfId !== userId) {
            console.log(`❌ 未授权访问他人空间:`, { userId, selfId });
            socket.emit('error', { message: 'Not authorized to access this space' });
            return;
          }
          console.log(`✅ 用户访问自己空间:`, { userId });
        }

        socket.join(`dm:${conversationId}`);
        connectedUsers.get(userId)?.dmConversations.add(conversationId);

        console.log(`✅ 用户加入 DM:`, { userId, conversationId });
      } catch (error) {
        console.error('❌ 加入私聊错误:', { userId, conversationId, error });
        socket.emit('error', { message: 'Failed to join DM conversation' });
      }
    });

    // 离开私聊房间
    socket.on('leave-dm', (conversationId: string) => {
      socket.leave(`dm:${conversationId}`);
      connectedUsers.get(userId)?.dmConversations.delete(conversationId);
      console.log(`User ${userId} left DM ${conversationId}`);
    });

    // 打字指示器
    socket.on('typing-start', (data: { channelId?: string; dmConversationId?: string }) => {
      const { channelId, dmConversationId } = data;

      if (channelId) {
        socket.to(`channel:${channelId}`).emit('user-typing', {
          userId,
          channelId,
          isTyping: true
        });
      } else if (dmConversationId) {
        socket.to(`dm:${dmConversationId}`).emit('user-typing', {
          userId,
          dmConversationId,
          isTyping: true
        });
      }
    });

    socket.on('typing-stop', (data: { channelId?: string; dmConversationId?: string }) => {
      const { channelId, dmConversationId } = data;

      if (channelId) {
        socket.to(`channel:${channelId}`).emit('user-typing', {
          userId,
          channelId,
          isTyping: false
        });
      } else if (dmConversationId) {
        socket.to(`dm:${dmConversationId}`).emit('user-typing', {
          userId,
          dmConversationId,
          isTyping: false
        });
      }
    });

    // Message read标记
    socket.on('message-read', (data: {
      messageIds: string[];
      channelId?: string;
      dmConversationId?: string;
    }) => {
      const { messageIds, channelId, dmConversationId } = data;

      // 广播给房间内的其他用户
      if (channelId) {
        socket.to(`channel:${channelId}`).emit('message-read-by-user', {
          userId,
          messageIds,
          channelId
        });
      } else if (dmConversationId) {
        socket.to(`dm:${dmConversationId}`).emit('message-read-by-user', {
          userId,
          messageIds,
          dmConversationId
        });
      }
    });

    // 获取在线用户列表
    socket.on('get-online-users', () => {
      const onlineUsers = Array.from(connectedUsers.values()).map(user => ({
        userId: user.userId,
        channels: Array.from(user.channels),
        dmConversations: Array.from(user.dmConversations)
      }));

      socket.emit('online-users', onlineUsers);
    });

    // 断开连接
    socket.on('disconnect', (reason) => {
      const disconnectInfo = {
        socketId: socket.id,
        userId,
        reason,
        timestamp: new Date().toISOString()
      };

      console.log(`❌ [Disconnect] User disconnected:`, disconnectInfo);

      try {
        // 更新用户在线状态
        updateUserPresence(userId, false);

        // 清理用户信息
        connectedUsers.delete(userId);

        console.log(`🧹 [Cleanup] User ${userId} data cleaned up`);
      } catch (error) {
        console.error(`❌ [Disconnect] Error during cleanup:`, {
          userId,
          socketId: socket.id,
          error: error instanceof Error ? error.message : error
        });
      }
    });
  });

  // 更新用户在线状态的辅助函数
  async function updateUserPresence(userId: string, isOnline: boolean) {
    try {
      await prisma.user.update({
        where: { id: userId },
        data: {
          isOnline,
          lastSeenAt: new Date()
        }
      });

      // 广播用户状态变化给所有连接
      io.emit('user-presence-update', {
        userId,
        isOnline,
        lastSeenAt: new Date()
      });
    } catch (error) {
      console.error('Error updating user presence:', error);
    }
  }

  // 公共方法：广播新消息
  io.broadcastNewMessage = (message: any, channelId?: string, dmConversationId?: string) => {
    if (channelId) {
      io.to(`channel:${channelId}`).emit('new-message', message);
    } else if (dmConversationId) {
      io.to(`dm:${dmConversationId}`).emit('new-message', message);
    }
  };

  // 公共方法：广播消息更新
  io.broadcastMessageUpdate = (message: any, channelId?: string, dmConversationId?: string) => {
    if (channelId) {
      io.to(`channel:${channelId}`).emit('message-updated', message);
    } else if (dmConversationId) {
      io.to(`dm:${dmConversationId}`).emit('message-updated', message);
    }
  };

  // 公共方法：广播消息删除
  io.broadcastMessageDelete = (messageId: string, channelId?: string, dmConversationId?: string) => {
    if (channelId) {
      io.to(`channel:${channelId}`).emit('message-deleted', { messageId });
    } else if (dmConversationId) {
      io.to(`dm:${dmConversationId}`).emit('message-deleted', { messageId });
    }
  };

  // 公共方法：广播新通知
  io.broadcastNewNotification = (notification: any, userId: string) => {
    io.to(`user:${userId}`).emit('new-notification', notification);
  };

  console.log('✅ WebSocket server initialized');

  return io;
}
