import { useEffect, useState, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './useAuth';
import { ConnectionStatus } from '@/types/database';

// 获取 WebSocket 连接的 URL
const getWebSocketUrl = () => {
  // 优先使用环境变量 NEXT_PUBLIC_APP_URL
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  // 如果是 https 连接，WebSocket 也应该使用 wss
  const protocol = appUrl.startsWith('https') ? 'https' : 'http';
  const url = appUrl.startsWith('http') ? appUrl : `${protocol}://${appUrl}`;

  return url;
};

interface UseSocketReturn {
  socket: Socket | null;
  isConnected: boolean;
  connectionStatus: ConnectionStatus;
  connect: () => void;
  disconnect: () => void;
  forceReconnect: () => void;
  joinChannel: (channelId: string) => void;
  leaveChannel: (channelId: string) => void;
  joinDM: (conversationId: string) => void;
  leaveDM: (conversationId: string) => void;
  sendTypingStart: (data: { channelId?: string; dmConversationId?: string }) => void;
  sendTypingStop: (data: { channelId?: string; dmConversationId?: string }) => void;
  markMessagesAsRead: (data: {
    messageIds: string[];
    channelId?: string;
    dmConversationId?: string;
  }) => void;
}

export function useSocket(): UseSocketReturn {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const { user } = useAuth();
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;
  const reconnectInterval = useRef<NodeJS.Timeout | null>(null);
  const isConnecting = useRef(false);

  // 获取 token 从 cookie (ws_token 供 WebSocket 使用)
  const getToken = useCallback(() => {
    if (typeof document === 'undefined') return null;
    const cookies = document.cookie.split(';');
    for (let cookie of cookies) {
      const [name, value] = cookie.trim().split('=');
      if (name === 'ws_token') {
        return value;
      }
    }
    return null;
  }, []);

  const connect = useCallback(() => {
    // 防止重复连接
    if (isConnecting.current || socket?.connected) {
      console.log(`🔌 [connect] Already connected or connecting, skipping`);
      return;
    }

    const token = getToken();
    console.log(`🔌 [connect] Attempting to connect with ws_token:`, {
      hasToken: !!token,
      hasUser: !!user,
      userId: user?.id,
      existingSocket: !!socket,
      tokenLength: token ? token.length : 0
    });

    if (!token || !user) {
      console.log(`❌ [connect] Cannot connect: missing token or user`);
      return;
    }

    isConnecting.current = true;

    // 获取 WebSocket 连接 URL
    const wsUrl = getWebSocketUrl();
    console.log('🔌 [connect] Connecting to WebSocket server:', {
      wsUrl,
      environment: process.env.NODE_ENV,
      appUrl: process.env.NEXT_PUBLIC_APP_URL
    });

    const socketInstance = io(wsUrl, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: maxReconnectAttempts,
      // 添加超时配置
      timeout: 20000,
      // 强制使用 websocket 传输（可选）
      forceNew: true
    });

    // Connection successful
    socketInstance.on('connect', () => {
      console.log('✅ WebSocket connected');
      setIsConnected(true);
      setConnectionStatus('connected');
      reconnectAttempts.current = 0;
      isConnecting.current = false;

      if (reconnectInterval.current) {
        clearInterval(reconnectInterval.current);
        reconnectInterval.current = null;
      }
    });

    // 连接断开
    socketInstance.on('disconnect', (reason) => {
      console.log('❌ WebSocket disconnected:', reason);
      setIsConnected(false);
      setConnectionStatus('disconnected');
      isConnecting.current = false;

      // 如果是服务器主动断开，尝试重连
      if (reason === 'io server disconnect') {
        socketInstance.connect();
      }
    });

    // 重连尝试
    socketInstance.on('reconnect_attempt', (attemptNumber) => {
      console.log(`🔄 Reconnection attempt ${attemptNumber}`);
      setConnectionStatus('reconnecting');
      reconnectAttempts.current = attemptNumber;
    });

    // Reconnection successful
    socketInstance.on('reconnect', (attemptNumber) => {
      console.log(`✅ Reconnected after ${attemptNumber} attempts`);
      setIsConnected(true);
      setConnectionStatus('connected');
      isConnecting.current = false;
    });

    // Reconnection failed
    socketInstance.on('reconnect_failed', () => {
      console.log('❌ Failed to reconnect after maximum attempts');
      setConnectionStatus('error');
      setIsConnected(false);
      isConnecting.current = false;
    });

    // Error handling
    socketInstance.on('error', (error) => {
      console.error('WebSocket error:', error);
      setConnectionStatus('error');
      isConnecting.current = false;
    });

    setSocket(socketInstance);
    console.log(`✅ [connect] Socket instance created and set to state:`, {
      socketId: socketInstance.id,
      connected: socketInstance.connected
    });
  }, [user, getToken, socket]);

  const disconnect = useCallback(() => {
    if (socket) {
      console.log('🔌 Manually disconnecting WebSocket');
      isConnecting.current = false;
      socket.disconnect();
      setSocket(null);
      setIsConnected(false);
      setConnectionStatus('disconnected');
    }
  }, [socket]);

  // 强制重新连接
  const forceReconnect = useCallback(() => {
    console.log('🔌 Force reconnecting WebSocket');
    disconnect();
    setTimeout(() => {
      connect();
    }, 500);
  }, [disconnect, connect]);

  // 自动连接 - 修复循环依赖
  useEffect(() => {
    const token = getToken();
    console.log(`🔌 [useSocket] Auto-connect check:`, {
      hasToken: !!token,
      hasUser: !!user,
      isConnecting: isConnecting.current,
      hasSocket: !!socket,
      socketId: socket?.id,
      userId: user?.id
    });

    // 只有在有token和用户，且当前未连接且未在连接中时才连接
    if (token && user && !socket?.connected && !isConnecting.current) {
      console.log(`🔌 [useSocket] Starting connection...`);
      // 使用setTimeout避免在渲染阶段直接调用connect
      const timeoutId = setTimeout(() => {
        connect();
      }, 0);

      return () => clearTimeout(timeoutId);
    }

    return () => {
      if (reconnectInterval.current) {
        clearInterval(reconnectInterval.current);
      }
    };
  }, [user, socket?.connected, connect, getToken]); // 使用socket?.connected而不是整个socket

  // 清理
  useEffect(() => {
    return () => {
      if (socket) {
        socket.close();
      }
    };
  }, [socket]);

  // Channel operations
  const joinChannel = useCallback((channelId: string) => {
    if (socket && isConnected) {
      console.log(`📥 Joining channel: ${channelId}`);
      socket.emit('join-channel', channelId);
    }
  }, [socket, isConnected]);

  const leaveChannel = useCallback((channelId: string) => {
    if (socket && isConnected) {
      console.log(`📤 Leaving channel: ${channelId}`);
      socket.emit('leave-channel', channelId);
    }
  }, [socket, isConnected]);

  // 私聊操作
  const joinDM = useCallback((conversationId: string) => {
    if (socket && isConnected) {
      console.log(`📥 Joining DM: ${conversationId}`);
      socket.emit('join-dm', conversationId);
    }
  }, [socket, isConnected]);

  const leaveDM = useCallback((conversationId: string) => {
    if (socket && isConnected) {
      console.log(`📤 Leaving DM: ${conversationId}`);
      socket.emit('leave-dm', conversationId);
    }
  }, [socket, isConnected]);

  // 打字指示器
  const sendTypingStart = useCallback((data: { channelId?: string; dmConversationId?: string }) => {
    if (socket && isConnected) {
      socket.emit('typing-start', data);
    }
  }, [socket, isConnected]);

  const sendTypingStop = useCallback((data: { channelId?: string; dmConversationId?: string }) => {
    if (socket && isConnected) {
      socket.emit('typing-stop', data);
    }
  }, [socket, isConnected]);

  // Message read
  const markMessagesAsRead = useCallback((data: {
    messageIds: string[];
    channelId?: string;
    dmConversationId?: string;
  }) => {
    if (socket && isConnected) {
      socket.emit('message-read', data);
    }
  }, [socket, isConnected]);

  return {
    socket,
    isConnected,
    connectionStatus,
    connect,
    disconnect,
    forceReconnect,
    joinChannel,
    leaveChannel,
    joinDM,
    leaveDM,
    sendTypingStart,
    sendTypingStop,
    markMessagesAsRead
  };
}
