import { useEffect, useState, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './useAuth';
import { ConnectionStatus } from '@/types/database';

// 获取 WebSocket 连接的 URL - 修复混合内容错误
const getWebSocketUrl = () => {
  // 优先使用环境变量 NEXT_PUBLIC_APP_URL
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  // 如果是 https 连接，WebSocket 也应该使用 wss
  // 确保返回正确的 WebSocket URL (ws:// 或 wss://)
  let wsUrl: string;

  if (appUrl.startsWith('https://')) {
    // HTTPS 页面必须使用 WSS
    wsUrl = appUrl.replace(/^https:/, 'wss:');
  } else if (appUrl.startsWith('http://')) {
    // HTTP 页面使用 WS
    wsUrl = appUrl.replace(/^http:/, 'ws:');
  } else {
    // 如果没有协议，根据环境判断
    const isProduction = process.env.NODE_ENV === 'production';
    const protocol = isProduction ? 'wss' : 'ws';
    wsUrl = `${protocol}://${appUrl}`;
  }

  // 添加 socket.io 路径
  if (!wsUrl.endsWith('/socket.io')) {
    wsUrl = `${wsUrl}/socket.io`;
  }

  console.log('🔌 [getWebSocketUrl] Generated WebSocket URL:', {
    originalUrl: appUrl,
    wsUrl,
    protocol: wsUrl.split('://')[0]
  });

  return wsUrl;
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

  // 使用 useRef 持久化 Socket 实例，防止重复创建
  const socketRef = useRef<Socket | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;
  const reconnectInterval = useRef<NodeJS.Timeout | null>(null);
  const isConnecting = useRef(false);
  const shouldCleanup = useRef(false);

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
    // 防止重复连接 - 使用 socketRef 检查
    if (isConnecting.current || socketRef.current?.connected) {
      console.log(`🔌 [connect] Already connected or connecting, skipping`);
      return;
    }

    const token = getToken();
    console.log(`🔌 [connect] Attempting to connect with ws_token:`, {
      hasToken: !!token,
      hasUser: !!user,
      userId: user?.id,
      existingSocket: !!socketRef.current,
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
      forceNew: true,
      // 强制安全连接（HTTPS 环境下自动使用 WSS）
      secure: true,
      // 如果使用自签名证书，允许不验证证书
      rejectUnauthorized: false,
      // 启用自动连接
      autoConnect: false,
      // 增强的连接参数
      upgrade: true,
      rememberUpgrade: true,
      // 强制使用 HTTP/1.1 如果需要
      // 注意：生产环境下建议配置正确的 SSL 证书
      // 而不是使用 rejectUnauthorized: false
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

    // 同时更新 state 和 ref
    socketRef.current = socketInstance;
    setSocket(socketInstance);
    console.log(`✅ [connect] Socket instance created and set to state:`, {
      socketId: socketInstance.id,
      connected: socketInstance.connected
    });
  }, [user?.id, getToken]); // 修复依赖：只依赖 user?.id，避免循环

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      console.log('🔌 Manually disconnecting WebSocket');
      isConnecting.current = false;
      shouldCleanup.current = true; // 标记需要清理
      socketRef.current.disconnect();
      socketRef.current = null;
      setSocket(null);
      setIsConnected(false);
      setConnectionStatus('disconnected');
    }
  }, []); // 修复依赖：空依赖数组

  // 强制重新连接
  const forceReconnect = useCallback(() => {
    console.log('🔌 Force reconnecting WebSocket');
    disconnect();
    setTimeout(() => {
      connect();
    }, 500);
  }, [disconnect, connect]);

  // 自动连接 - 修复循环依赖和死循环问题
  useEffect(() => {
    const token = getToken();
    console.log(`🔌 [useSocket] Auto-connect check:`, {
      hasToken: !!token,
      hasUser: !!user,
      isConnecting: isConnecting.current,
      hasSocketRef: !!socketRef.current,
      socketId: socketRef.current?.id,
      isSocketConnected: socketRef.current?.connected,
      userId: user?.id
    });

    // 只有在有token和用户，且当前未连接且未在连接中时才连接
    // 关键修复：使用 socketRef.current?.connected 状态
    if (token && user && !socketRef.current?.connected && !isConnecting.current) {
      console.log(`🔌 [useSocket] Starting connection...`);
      // 使用setTimeout避免在渲染阶段直接调用connect
      const timeoutId = setTimeout(() => {
        connect();
      }, 100); // 增加延迟避免立即重连

      return () => clearTimeout(timeoutId);
    }

    return () => {
      if (reconnectInterval.current) {
        clearInterval(reconnectInterval.current);
        reconnectInterval.current = null;
      }
    };
  }, [user?.id, getToken, connect]); // 依赖：user?.id, getToken, connect

  // 清理 - 改进的清理逻辑，防止内存泄漏
  useEffect(() => {
    return () => {
      console.log('🔌 [useSocket] Cleaning up socket connection', {
        hasSocket: !!socketRef.current,
        shouldCleanup: shouldCleanup.current
      });

      // 只有在明确标记需要清理时才清理
      if (shouldCleanup.current && socketRef.current) {
        console.log('🔌 [useSocket] Performing full cleanup');
        // 移除所有事件监听器
        socketRef.current.removeAllListeners();
        // 断开连接
        socketRef.current.disconnect();
        // 清理引用
        socketRef.current = null;
        // 设置为 null
        setSocket(null);
        // 重置状态
        setIsConnected(false);
        setConnectionStatus('disconnected');
        isConnecting.current = false;
        // 清理重连定时器
        if (reconnectInterval.current) {
          clearInterval(reconnectInterval.current);
          reconnectInterval.current = null;
        }
        // 重置清理标记
        shouldCleanup.current = false;
      } else {
        console.log('🔌 [useSocket] Skipping cleanup (socketRef.current:', socketRef.current, ')');
      }
    };
  }, []); // 空依赖数组，只在组件卸载时执行一次

  // Channel operations - 使用 socketRef 避免依赖 socket state
  const joinChannel = useCallback((channelId: string) => {
    if (socketRef.current && isConnected) {
      console.log(`📥 Joining channel: ${channelId}`);
      socketRef.current.emit('join-channel', channelId);
    }
  }, [isConnected]); // 只依赖 isConnected

  const leaveChannel = useCallback((channelId: string) => {
    if (socketRef.current && isConnected) {
      console.log(`📤 Leaving channel: ${channelId}`);
      socketRef.current.emit('leave-channel', channelId);
    }
  }, [isConnected]); // 只依赖 isConnected

  // 私聊操作
  const joinDM = useCallback((conversationId: string) => {
    if (socketRef.current && isConnected) {
      console.log(`📥 Joining DM: ${conversationId}`);
      socketRef.current.emit('join-dm', conversationId);
    }
  }, [isConnected]); // 只依赖 isConnected

  const leaveDM = useCallback((conversationId: string) => {
    if (socketRef.current && isConnected) {
      console.log(`📤 Leaving DM: ${conversationId}`);
      socketRef.current.emit('leave-dm', conversationId);
    }
  }, [isConnected]); // 只依赖 isConnected

  // 打字指示器
  const sendTypingStart = useCallback((data: { channelId?: string; dmConversationId?: string }) => {
    if (socketRef.current && isConnected) {
      socketRef.current.emit('typing-start', data);
    }
  }, [isConnected]); // 只依赖 isConnected

  const sendTypingStop = useCallback((data: { channelId?: string; dmConversationId?: string }) => {
    if (socketRef.current && isConnected) {
      socketRef.current.emit('typing-stop', data);
    }
  }, [isConnected]); // 只依赖 isConnected

  // Message read
  const markMessagesAsRead = useCallback((data: {
    messageIds: string[];
    channelId?: string;
    dmConversationId?: string;
  }) => {
    if (socketRef.current && isConnected) {
      socketRef.current.emit('message-read', data);
    }
  }, [isConnected]); // 只依赖 isConnected

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
