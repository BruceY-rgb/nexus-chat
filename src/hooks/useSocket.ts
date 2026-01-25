import { useEffect, useState, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './useAuth';
import { ConnectionStatus } from '@/types/database';

interface UseSocketReturn {
  socket: Socket | null;
  isConnected: boolean;
  connectionStatus: ConnectionStatus;
  connect: () => void;
  disconnect: () => void;
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

  // 获取 token 从 cookie (ws_token 供 WebSocket 使用)
  const getToken = useCallback(() => {
    if (typeof document === 'undefined') return null;
    const cookies = document.cookie.split(';');
    for (let cookie of cookies) {
      const [name, value] = cookie.trim().split('=');
      if (name === 'ws_token') {
        console.log(`🔑 [getToken] Found ws_token`);
        return value;
      }
    }
    console.log(`⚠️ [getToken] ws_token not found in cookies`);
    return null;
  }, []);

  const connect = useCallback(() => {
    const token = getToken();
    console.log(`🔌 [connect] Attempting to connect with ws_token:`, {
      hasToken: !!token,
      hasUser: !!user,
      userId: user?.id,
      existingSocket: !!socket,
      tokenLength: token ? token.length : 0
    });

    if (!token || !user) {
      console.log(`❌ [connect] Cannot connect: missing token or user:`, {
        noToken: !token,
        noUser: !user
      });
      return;
    }

    console.log('🔌 [connect] Connecting to WebSocket server...');

    const socketInstance = io('http://127.0.0.1:3000', {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: maxReconnectAttempts
    });

    // 连接成功
    socketInstance.on('connect', () => {
      console.log('✅ WebSocket connected');
      setIsConnected(true);
      setConnectionStatus('connected');
      reconnectAttempts.current = 0;

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

    // 重连成功
    socketInstance.on('reconnect', (attemptNumber) => {
      console.log(`✅ Reconnected after ${attemptNumber} attempts`);
      setIsConnected(true);
      setConnectionStatus('connected');
    });

    // 重连失败
    socketInstance.on('reconnect_failed', () => {
      console.log('❌ Failed to reconnect after maximum attempts');
      setConnectionStatus('error');
      setIsConnected(false);
    });

    // 错误处理
    socketInstance.on('error', (error) => {
      console.error('WebSocket error:', error);
      setConnectionStatus('error');
    });

    setSocket(socketInstance);
    console.log(`✅ [connect] Socket instance created and set to state:`, {
      socketId: socketInstance.id,
      connected: socketInstance.connected
    });
  }, [user, getToken]);

  const disconnect = useCallback(() => {
    if (socket) {
      console.log('🔌 Manually disconnecting WebSocket');
      socket.disconnect();
      setSocket(null);
      setIsConnected(false);
      setConnectionStatus('disconnected');
    }
  }, [socket]);

  // 自动连接 - 修复循环依赖
  useEffect(() => {
    const token = getToken();
    console.log(`🔌 [useSocket] Auto-connect check with ws_token:`, {
      hasToken: !!token,
      hasUser: !!user,
      hasSocket: !!socket,
      socketId: socket?.id,
      userId: user?.id,
      tokenPreview: token ? `${token.substring(0, 10)}...` : null
    });

    // 移除 socket 依赖，避免循环
    if (token && user) {
      console.log(`🔌 [useSocket] IMMEDIATELY connecting with ws_token (forcing)...`);
      connect();
    } else {
      console.log(`🔌 [useSocket] Missing requirements:`, {
        noToken: !token,
        noUser: !user
      });
    }

    return () => {
      if (reconnectInterval.current) {
        clearInterval(reconnectInterval.current);
      }
    };
  }, [user, connect, getToken]); // 移除 socket 依赖

  // 清理
  useEffect(() => {
    return () => {
      if (socket) {
        socket.close();
      }
    };
  }, [socket]);

  // 频道操作
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

  // 消息已读
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
    joinChannel,
    leaveChannel,
    joinDM,
    leaveDM,
    sendTypingStart,
    sendTypingStop,
    markMessagesAsRead
  };
}
