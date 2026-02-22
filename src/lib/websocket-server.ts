import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HTTPServer } from 'http';
import { verifyToken } from './auth';
import { prisma } from './prisma';

// Extend SocketIOServer type to support custom methods
interface ExtendedSocketIOServer extends SocketIOServer {
  broadcastNewMessage: (message: any, channelId?: string, dmConversationId?: string) => void;
  broadcastMessageUpdate: (message: any, channelId?: string, dmConversationId?: string) => void;
  broadcastMessageDelete: (messageId: string, channelId?: string, dmConversationId?: string) => void;
  broadcastNewNotification: (notification: any, userId: string) => void;
  broadcastThreadReply: (reply: any, threadId: string, channelId?: string, dmConversationId?: string) => void;
  broadcastThreadReplyUpdate: (reply: any, threadId: string, channelId?: string, dmConversationId?: string) => void;
  broadcastThreadReplyDelete: (replyId: string, threadId: string, channelId?: string, dmConversationId?: string) => void;
}

// User connection information - supports multiple sockets per user (multi-tab)
interface ConnectedUser {
  userId: string;
  socketIds: Set<string>;
  channels: Set<string>;
  dmConversations: Set<string>;
}

export function setupWebSocket(httpServer: HTTPServer): ExtendedSocketIOServer {
  // Dynamically get allowed origins
  const getAllowedOrigins = () => {
    const origins = [
      "http://127.0.0.1:3000",
      "http://localhost:3000",
      "http://localhost:3001",
    ];

    // Add production environment domain
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    if (appUrl) {
      // Add full URL
      origins.push(appUrl);

      // Extract domain from URL and add
      try {
        const url = new URL(appUrl.startsWith('http') ? appUrl : `http://${appUrl}`);
        origins.push(url.origin);

        // If https, also allow http version (reverse proxy scenario)
        if (url.protocol === 'https:') {
          origins.push(`http://${url.host}`);
        }
      } catch (e) {
        console.warn('Invalid NEXT_PUBLIC_APP_URL:', appUrl);
      }
    }

    // Add Slack-related production domains (supporting Nginx reverse proxy)
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

    // Add other common production domains (if environment variables not set)
    const prodDomains = [
      "https://instagram.rlenv.data4o.ai",
      "http://instagram.rlenv.data4o.ai"
    ];

    prodDomains.forEach(domain => {
      if (!origins.includes(domain)) {
        origins.push(domain);
      }
    });

    console.log('[CORS] Allowed origins:', origins);
    return origins;
  };

  const io = new SocketIOServer(httpServer, {
    cors: {
      // Use function to dynamically validate Origin, supporting reverse proxy
      origin: function (origin, callback) {
        // Allow requests without Origin (mobile apps, etc.)
        if (!origin) return callback(null, true);

        const allowedOrigins = getAllowedOrigins();

        // Check if Origin is in allowed list
        if (allowedOrigins.includes(origin)) {
          console.log('[CORS] Origin allowed:', origin);
          return callback(null, true);
        }

        // For Nginx reverse proxy scenario, check if it's a subdomain of known domains
        try {
          const originUrl = new URL(origin);
          const originHostname = originUrl.hostname;

          // Check if it's a subdomain of *.rlenv.data4o.ai
          if (originHostname.endsWith('.rlenv.data4o.ai') || originHostname === 'rlenv.data4o.ai') {
            console.log('[CORS] Subdomain allowed:', origin);
            return callback(null, true);
          }

          // Check if it's localhost (development environment)
          if (originHostname === 'localhost' || originHostname === '127.0.0.1') {
            console.log('[CORS] Localhost allowed:', origin);
            return callback(null, true);
          }
        } catch (e) {
          console.warn('[CORS] Invalid origin format:', origin);
        }

        // Reject unknown origins
        console.error('[CORS] Origin not allowed:', origin);
        return callback(new Error('Not allowed by CORS'), false);
      },
      credentials: true,
      methods: ["GET", "POST"],
      allowedHeaders: ["Content-Type", "Authorization", "Cookie", "X-Requested-With"]
    },
    transports: ['websocket', 'polling'],
    // Explicitly specify Socket.io path (avoid conflicts with other apps)
    // Default is /socket.io, explicitly specified here for readability
    path: '/socket.io',

    // Add ping timeout configuration (suitable for reverse proxy environment)
    pingTimeout: 60000,      // Disconnect after 60 seconds of inactivity
    pingInterval: 25000,     // Send ping every 25 seconds

    // Production environment optimization configuration
    allowUpgrades: true,     // Allow upgrading from polling to WebSocket
    upgradeTimeout: 10000,   // 10 second upgrade timeout
    connectTimeout: 20000,   // 20 second connection timeout

    // Additional configuration for reverse proxy
    // Allow more headers
    allowEIO3: true,         // Compatible with Engine.IO v3 clients
  }) as ExtendedSocketIOServer;

  // Store online user information
  const connectedUsers = new Map<string, ConnectedUser>();

  // Authentication middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      const clientInfo = {
        id: socket.id,
        ip: socket.handshake.address,
        userAgent: socket.handshake.headers['user-agent']
      };

      console.log(`[Auth] New connection attempt:`, clientInfo);

      if (!token) {
        console.error(`[Auth] Authentication failed - No token provided:`, clientInfo);
        return next(new Error('Authentication error: No token provided'));
      }

      const decoded = verifyToken(token);

      if (!decoded) {
        console.error(`[Auth] Authentication failed - Invalid token:`, {
          ...clientInfo,
          tokenPreview: token.substring(0, 20) + '...',
          tokenLength: token.length
        });
        return next(new Error('Authentication error: Invalid token'));
      }

      // Attach user information to socket
      socket.data.userId = decoded.userId;

      console.log(`[Auth] Authentication successful:`, {
        ...clientInfo,
        userId: decoded.userId
      });

      next();
    } catch (error) {
      console.error(`[Auth] Authentication error:`, {
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

    console.log(`[Connection] User connected:`, connectionInfo);

    // Error event listener
    socket.on('error', (error) => {
      console.error(`[Socket Error] Socket error:`, {
        socketId: socket.id,
        userId,
        error: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined
      });
    });

    // Initialize or update user connection information (multi-tab support)
    if (!connectedUsers.has(userId)) {
      connectedUsers.set(userId, {
        userId,
        socketIds: new Set([socket.id]),
        channels: new Set(),
        dmConversations: new Set()
      });
    } else {
      connectedUsers.get(userId)!.socketIds.add(socket.id);
    }

    // Join user's own notification room
    socket.join(`user:${userId}`);

    // Update user online status
    updateUserPresence(userId, true);

    // Join channel room
    socket.on('join-channel', async (channelId: string) => {
      try {
        console.log(`Attempting to join channel:`, { socketId: socket.id, userId, channelId });

        // Verify if user has permission to join the channel
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
          console.log(`Channel membership not found:`, { userId, channelId });
          socket.emit('error', { message: `Not authorized to join channel ${channelId}` });
          return;
        }

        socket.join(`channel:${channelId}`);
        connectedUsers.get(userId)?.channels.add(channelId);

        console.log(`User joined channel successfully:`, { userId, channelId: channelMember.channel.name, role: channelMember.role });
      } catch (error) {
        console.error('Error joining channel:', { userId, channelId, error });
        socket.emit('error', { message: 'Failed to join channel' });
      }
    });

    // Leave channel room
    socket.on('leave-channel', (channelId: string) => {
      socket.leave(`channel:${channelId}`);
      connectedUsers.get(userId)?.channels.delete(channelId);
      console.log(`User ${userId} left channel ${channelId}`);
    });

    // Join DM room
    socket.on('join-dm', async (conversationId: string) => {
      try {
        console.log(`Attempting to join DM:`, { socketId: socket.id, userId, conversationId });

        // Verify if user has permission to join the DM
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
            console.log(`DM membership not found:`, { userId, conversationId });
            socket.emit('error', { message: `Not authorized to join conversation ${conversationId}` });
            return;
          }

          console.log(`User joined DM successfully:`, { userId, conversationId });
        } else {
          // Verify own message space
          const selfId = conversationId.replace('self-', '');
          if (selfId !== userId) {
            console.log(`Unauthorized access to other user's space:`, { userId, selfId });
            socket.emit('error', { message: 'Not authorized to access this space' });
            return;
          }
          console.log(`User accessing own space:`, { userId });
        }

        socket.join(`dm:${conversationId}`);
        connectedUsers.get(userId)?.dmConversations.add(conversationId);

        console.log(`User joined DM:`, { userId, conversationId });
      } catch (error) {
        console.error('Error joining DM:', { userId, conversationId, error });
        socket.emit('error', { message: 'Failed to join DM conversation' });
      }
    });

    // Leave DM room
    socket.on('leave-dm', (conversationId: string) => {
      socket.leave(`dm:${conversationId}`);
      connectedUsers.get(userId)?.dmConversations.delete(conversationId);
      console.log(`User ${userId} left DM ${conversationId}`);
    });

    // Typing indicator
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

    // Message read marker
    socket.on('message-read', (data: {
      messageIds: string[];
      channelId?: string;
      dmConversationId?: string;
    }) => {
      const { messageIds, channelId, dmConversationId } = data;

      // Broadcast to other users in the room
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

    // Get online user list
    socket.on('get-online-users', () => {
      const onlineUsers = Array.from(connectedUsers.values()).map(user => ({
        userId: user.userId,
        connectionCount: user.socketIds.size,
        channels: Array.from(user.channels),
        dmConversations: Array.from(user.dmConversations)
      }));

      socket.emit('online-users', onlineUsers);
    });

    // Disconnect
    socket.on('disconnect', (reason) => {
      const disconnectInfo = {
        socketId: socket.id,
        userId,
        reason,
        timestamp: new Date().toISOString()
      };

      console.log(`[Disconnect] User disconnected:`, disconnectInfo);

      try {
        const userInfo = connectedUsers.get(userId);
        if (userInfo) {
          userInfo.socketIds.delete(socket.id);

          // Only mark offline when the last socket for this user disconnects
          if (userInfo.socketIds.size === 0) {
            updateUserPresence(userId, false);
            connectedUsers.delete(userId);
            console.log(`[Cleanup] User ${userId} fully disconnected, data cleaned up`);
          } else {
            console.log(`[Cleanup] User ${userId} still has ${userInfo.socketIds.size} active connection(s)`);
          }
        }
      } catch (error) {
        console.error(`[Disconnect] Error during cleanup:`, {
          userId,
          socketId: socket.id,
          error: error instanceof Error ? error.message : error
        });
      }
    });
  });

  // Helper function to update user online status
  async function updateUserPresence(userId: string, isOnline: boolean) {
    try {
      await prisma.user.update({
        where: { id: userId },
        data: {
          isOnline,
          lastSeenAt: new Date()
        }
      });

      // Broadcast user status change to all connections
      io.emit('user-presence-update', {
        userId,
        isOnline,
        lastSeenAt: new Date()
      });
    } catch (error) {
      console.error('Error updating user presence:', error);
    }
  }

  // Public method: Broadcast new message
  io.broadcastNewMessage = (message: any, channelId?: string, dmConversationId?: string) => {
    if (channelId) {
      io.to(`channel:${channelId}`).emit('new-message', message);
    } else if (dmConversationId) {
      io.to(`dm:${dmConversationId}`).emit('new-message', message);
    }
  };

  // Public method: Broadcast message update
  io.broadcastMessageUpdate = (message: any, channelId?: string, dmConversationId?: string) => {
    if (channelId) {
      io.to(`channel:${channelId}`).emit('message-updated', message);
    } else if (dmConversationId) {
      io.to(`dm:${dmConversationId}`).emit('message-updated', message);
    }
  };

  // Public method: Broadcast message deletion
  io.broadcastMessageDelete = (messageId: string, channelId?: string, dmConversationId?: string) => {
    if (channelId) {
      io.to(`channel:${channelId}`).emit('message-deleted', { messageId });
    } else if (dmConversationId) {
      io.to(`dm:${dmConversationId}`).emit('message-deleted', { messageId });
    }
  };

  // Public method: Broadcast new notification
  io.broadcastNewNotification = (notification: any, userId: string) => {
    io.to(`user:${userId}`).emit('new-notification', notification);
  };

  // Public method: Broadcast thread reply
  io.broadcastThreadReply = (reply: any, threadId: string, channelId?: string, dmConversationId?: string) => {
    if (channelId) {
      io.to(`channel:${channelId}`).emit('thread-reply-created', {
        threadId,
        message: reply,
        replyCount: reply.threadReplyCount || 0
      });
    } else if (dmConversationId) {
      io.to(`dm:${dmConversationId}`).emit('thread-reply-created', {
        threadId,
        message: reply,
        replyCount: reply.threadReplyCount || 0
      });
    }
  };

  // Public method: Broadcast thread reply update
  io.broadcastThreadReplyUpdate = (reply: any, threadId: string, channelId?: string, dmConversationId?: string) => {
    if (channelId) {
      io.to(`channel:${channelId}`).emit('thread-reply-updated', {
        threadId,
        message: reply
      });
    } else if (dmConversationId) {
      io.to(`dm:${dmConversationId}`).emit('thread-reply-updated', {
        threadId,
        message: reply
      });
    }
  };

  // Public method: Broadcast thread reply deletion
  io.broadcastThreadReplyDelete = (replyId: string, threadId: string, channelId?: string, dmConversationId?: string) => {
    if (channelId) {
      io.to(`channel:${channelId}`).emit('thread-reply-deleted', {
        threadId,
        replyId
      });
    } else if (dmConversationId) {
      io.to(`dm:${dmConversationId}`).emit('thread-reply-deleted', {
        threadId,
        replyId
      });
    }
  };

  console.log('WebSocket server initialized');

  return io;
}
