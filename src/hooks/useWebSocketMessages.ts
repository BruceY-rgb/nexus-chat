import { useEffect, useRef, useCallback, useState } from 'react';
import { useSocket } from './useSocket';
import { Message } from '@/types/message';

interface UseWebSocketMessagesProps {
  dmConversationId?: string;
  channelId?: string;
  currentUserId: string;
  onNewMessage?: (message: Message) => void;
  onMessageUpdated?: (message: Message) => void;
  onMessageDeleted?: (data: { id: string; channelId?: string; dmConversationId?: string; isDeleted: boolean; deletedAt?: string }) => void;
  isAtBottom?: boolean;
  shouldAutoScroll?: boolean;
}

interface WebSocketDebugInfo {
  isConnected: boolean;
  socketId?: string;
  currentRoom?: string;
  messagesReceived: number;
  lastMessageAt?: Date;
  connectionErrors: string[];
}

export function useWebSocketMessages({
  dmConversationId,
  channelId,
  currentUserId,
  onNewMessage,
  onMessageUpdated,
  onMessageDeleted,
  isAtBottom = true,
  shouldAutoScroll = true
}: UseWebSocketMessagesProps) {
  const { socket, isConnected } = useSocket();
  const hasJoinedRoom = useRef(false);
  const previousMessageIds = useRef<Set<string>>(new Set());
  const joinAttempts = useRef(0);
  const maxJoinAttempts = 3;
  const joinRetryTimeout = useRef<NodeJS.Timeout | null>(null);

  // 使用 useRef 存储回调函数，避免依赖数组变化
  const onNewMessageRef = useRef(onNewMessage);
  const onMessageUpdatedRef = useRef(onMessageUpdated);
  const onMessageDeletedRef = useRef(onMessageDeleted);

  // 安全的更新回调函数引用
  useEffect(() => {
    onNewMessageRef.current = onNewMessage;
  }, [onNewMessage]);

  useEffect(() => {
    onMessageUpdatedRef.current = onMessageUpdated;
  }, [onMessageUpdated]);

  useEffect(() => {
    onMessageDeletedRef.current = onMessageDeleted;
  }, [onMessageDeleted]);

  // 调试信息
  const [debugInfo] = useState<WebSocketDebugInfo>({
    isConnected: false,
    messagesReceived: 0,
    connectionErrors: []
  });

  // 调试日志函数 - 优化版本：减少依赖变化
  const log = useCallback((level: 'info' | 'warn' | 'error', message: string, data?: any) => {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [WebSocket] ${message}`;
    console[level](logMessage, data);
  }, []); // 空依赖数组，确保函数引用稳定

  // 防止重复初始化的保护机制
  const [isInitialized, setIsInitialized] = useState(false);

  // 加入房间（带重试机制）- 优化版本：减少依赖变化
  const joinRoom = useCallback((attempt = 1) => {
    const roomId = dmConversationId || channelId;
    if (!roomId) {
      log('info', 'No room ID provided, skipping join');
      return;
    }

    // 检查socket是否准备好
    if (!socket) {
      log('warn', `Socket not available for joining room ${roomId} (attempt ${attempt}/${maxJoinAttempts})`);
      if (attempt < maxJoinAttempts) {
        joinRetryTimeout.current = setTimeout(() => {
          joinRoom(attempt + 1);
        }, 200);
      }
      return;
    }

    // 使用socket.connected而不是isConnected状态
    if (!socket.connected) {
      log('warn', `Socket not connected for joining room ${roomId} (attempt ${attempt}/${maxJoinAttempts})`);
      if (attempt < maxJoinAttempts) {
        joinRetryTimeout.current = setTimeout(() => {
          joinRoom(attempt + 1);
        }, 200);
      }
      return;
    }

    log('info', `Attempting to join room: ${dmConversationId ? 'DM' : 'Channel'} ${roomId} (attempt ${attempt}/${maxJoinAttempts})`);

    if (dmConversationId) {
      socket.emit('join-dm', dmConversationId);
      log('info', `✅ Successfully emitted join-dm event for room: ${dmConversationId}`);
    } else if (channelId) {
      socket.emit('join-channel', channelId);
      log('info', `✅ Successfully emitted join-channel event for room: ${channelId}`);
    }
    hasJoinedRoom.current = true;
    joinAttempts.current = 0;
  }, [dmConversationId, channelId, log]); // 移除 socket 依赖，使用 useRef 访问

  // 离开房间 - 优化版本：减少依赖变化
  const leaveRoom = useCallback(() => {
    if (!socket || !hasJoinedRoom.current) {
      return;
    }

    // 清理重试定时器
    if (joinRetryTimeout.current) {
      clearTimeout(joinRetryTimeout.current);
      joinRetryTimeout.current = null;
    }

    if (dmConversationId) {
      console.log(`📤 [WebSocket] Leaving DM room: ${dmConversationId}`);
      socket.emit('leave-dm', dmConversationId);
    } else if (channelId) {
      console.log(`📤 [WebSocket] Leaving channel room: ${channelId}`);
      socket.emit('leave-channel', channelId);
    }

    hasJoinedRoom.current = false;
    joinAttempts.current = 0;
  }, [dmConversationId, channelId]); // 移除 socket 依赖

  // 监听新消息
  useEffect(() => {
    log('info', `Setting up message listeners. Socket: ${!!socket}, Connected: ${isConnected}`);

    if (!socket || !isConnected) {
      log('warn', 'Socket not ready, message listeners not set up');
      return;
    }

    const handleNewMessage = (message: Message) => {
      log('info', `📨 Raw new-message event received:`, message);

      // 验证消息属于当前房间
      const isForCurrentRoom =
        (dmConversationId && message.dmConversationId === dmConversationId) ||
        (channelId && message.channelId === channelId);

      log('info', `Message room validation:`, {
        messageDM: message.dmConversationId,
        expectedDM: dmConversationId,
        messageChannel: message.channelId,
        expectedChannel: channelId,
        isForCurrentRoom
      });

      if (!isForCurrentRoom) {
        log('info', `Message ignored - not for current room`);
        return;
      }

      // 防止重复消息（通过消息ID检查）
      if (previousMessageIds.current.has(message.id)) {
        log('info', `⚠️ Duplicate message ignored: ${message.id}`);
        return;
      }

      // 记录消息ID
      previousMessageIds.current.add(message.id);

      // 限制历史记录大小（最多保留100个消息ID）
      if (previousMessageIds.current.size > 100) {
        const firstId = previousMessageIds.current.values().next().value;
        if (firstId) {
          previousMessageIds.current.delete(firstId);
        }
      }

      log('info', `✅ Message accepted and will be processed:`, {
        messageId: message.id,
        content: message.content?.substring(0, 50),
        fromUser: message.userId
      });

      // 调用回调函数 - 使用 ref 避免依赖变化
      if (onNewMessageRef.current) {
        log('info', `Calling onNewMessage callback`);
        onNewMessageRef.current(message);
      } else {
        log('warn', 'No onNewMessage callback provided');
      }
    };

    // 监听消息更新
    const handleMessageUpdated = (updatedMessage: Message) => {
      const isForCurrentRoom =
        (dmConversationId && updatedMessage.dmConversationId === dmConversationId) ||
        (channelId && updatedMessage.channelId === channelId);

      if (!isForCurrentRoom) {
        return;
      }

      log('info', `📝 Message updated:`, updatedMessage);

      if (onMessageUpdatedRef.current) {
        onMessageUpdatedRef.current(updatedMessage);
      }
    };

    // 监听消息删除
    const handleMessageDeleted = (deleteData: { id: string; channelId?: string; dmConversationId?: string; isDeleted: boolean; deletedAt?: string }) => {
      const { id } = deleteData;
      log('info', `🗑️ Message deleted:`, deleteData);

      if (onMessageDeletedRef.current) {
        onMessageDeletedRef.current(deleteData);
      }
    };

    // 注册事件监听器
    log('info', 'Registering socket event listeners...');
    socket.on('new-message', handleNewMessage);
    socket.on('message-updated', handleMessageUpdated);
    socket.on('message-deleted', handleMessageDeleted);
    log('info', '✅ Socket event listeners registered successfully');

    // Cleanup function
    return () => {
      log('info', 'Cleaning up socket event listeners...');
      socket.off('new-message', handleNewMessage);
      socket.off('message-updated', handleMessageUpdated);
      socket.off('message-deleted', handleMessageDeleted);
      log('info', '✅ Socket event listeners cleaned up');
    };
  }, [socket, isConnected, dmConversationId, channelId]); // 移除 onNewMessage 和 log 依赖

  // 当房间ID变化时，重新加入房间 - 优化版本：减少依赖变化
  useEffect(() => {
    const roomId = dmConversationId || channelId;
    log('info', `🔄 Room ID changed, preparing to join:`, {
      dmConversationId,
      channelId,
      roomId,
      previousRoomJoined: hasJoinedRoom.current
    });

    if (!roomId) {
      log('info', 'No room ID provided, skipping room join');
      return;
    }

    // 重置房间状态和重试计数器
    hasJoinedRoom.current = false;
    joinAttempts.current = 0;

    // 清理之前的重试定时器
    if (joinRetryTimeout.current) {
      clearTimeout(joinRetryTimeout.current);
      joinRetryTimeout.current = null;
    }

    // 延迟一点再加入，确保组件完全挂载
    const timer = setTimeout(() => {
      log('info', `⏰ Delayed join room triggered for: ${roomId}`);
      joinRoom(1); // 使用带重试的joinRoom函数
    }, 100);

    return () => {
      clearTimeout(timer);
      log('info', `🏠 Cleaning up room: ${roomId}`);
      if (socket && hasJoinedRoom.current) {
        if (dmConversationId) {
          socket.emit('leave-dm', dmConversationId);
        } else if (channelId) {
          socket.emit('leave-channel', channelId);
        }
        hasJoinedRoom.current = false;
      }
      // 清理重试定时器
      if (joinRetryTimeout.current) {
        clearTimeout(joinRetryTimeout.current);
        joinRetryTimeout.current = null;
      }
    };
  }, [dmConversationId, channelId]); // 只依赖房间ID，大幅减少重新挂载

  // 组件卸载时清理
  useEffect(() => {
    return () => {
      leaveRoom();
      previousMessageIds.current.clear();
      // 清理重试定时器
      if (joinRetryTimeout.current) {
        clearTimeout(joinRetryTimeout.current);
        joinRetryTimeout.current = null;
      }
    };
  }, [leaveRoom]);

  return {
    joinRoom,
    leaveRoom,
    isConnected
  };
}
