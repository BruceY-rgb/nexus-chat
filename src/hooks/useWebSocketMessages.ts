import { useEffect, useRef, useCallback, useState } from 'react';
import { useSocket } from './useSocket';
import { Message } from '@/types/message';

interface UseWebSocketMessagesProps {
  dmConversationId?: string;
  channelId?: string;
  currentUserId: string;
  onNewMessage?: (message: Message) => void;
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
  isAtBottom = true,
  shouldAutoScroll = true
}: UseWebSocketMessagesProps) {
  const { socket, isConnected } = useSocket();
  const hasJoinedRoom = useRef(false);
  const previousMessageIds = useRef<Set<string>>(new Set());

  // 调试信息
  const [debugInfo] = useState<WebSocketDebugInfo>({
    isConnected: false,
    messagesReceived: 0,
    connectionErrors: []
  });

  // 调试日志函数
  const log = useCallback((level: 'info' | 'warn' | 'error', message: string, data?: any) => {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [WebSocket] ${message}`;
    console[level](logMessage, data);
  }, []);

  // 防止重复初始化的保护机制
  const [isInitialized, setIsInitialized] = useState(false);

  // 加入房间
  const joinRoom = useCallback(() => {
    const roomId = dmConversationId || channelId;
    if (!roomId) {
      log('info', 'No room ID provided, skipping join');
      return;
    }

    if (!socket || !isConnected) {
      log('info', `Socket not ready for joining room ${roomId}: socket=${!!socket}, isConnected=${isConnected}`);
      return;
    }

    log('info', `Attempting to join room: ${dmConversationId ? 'DM' : 'Channel'} ${roomId}`);

    if (dmConversationId) {
      socket.emit('join-dm', dmConversationId);
      log('info', `✅ Successfully emitted join-dm event for room: ${dmConversationId}`);
    } else if (channelId) {
      socket.emit('join-channel', channelId);
      log('info', `✅ Successfully emitted join-channel event for room: ${channelId}`);
    }
    hasJoinedRoom.current = true;
  }, [socket, isConnected, dmConversationId, channelId, log]);

  // 离开房间
  const leaveRoom = useCallback(() => {
    if (!socket || !hasJoinedRoom.current) {
      return;
    }

    if (dmConversationId) {
      console.log(`📤 [WebSocket] Leaving DM room: ${dmConversationId}`);
      socket.emit('leave-dm', dmConversationId);
    } else if (channelId) {
      console.log(`📤 [WebSocket] Leaving channel room: ${channelId}`);
      socket.emit('leave-channel', channelId);
    }

    hasJoinedRoom.current = false;
  }, [socket, dmConversationId, channelId]);

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
        previousMessageIds.current.delete(firstId);
      }

      log('info', `✅ Message accepted and will be processed:`, {
        messageId: message.id,
        content: message.content?.substring(0, 50),
        fromUser: message.userId
      });

      // 调用回调函数
      if (onNewMessage) {
        log('info', `Calling onNewMessage callback`);
        onNewMessage(message);
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

      if (onNewMessage) {
        onNewMessage({ ...updatedMessage, _isUpdate: true } as Message & { _isUpdate: true });
      }
    };

    // 监听消息删除
    const handleMessageDeleted = (data: { messageId: string }) => {
      const { messageId } = data;
      log('info', `🗑️ Message deleted:`, messageId);
    };

    // 注册事件监听器
    log('info', 'Registering socket event listeners...');
    socket.on('new-message', handleNewMessage);
    socket.on('message-updated', handleMessageUpdated);
    socket.on('message-deleted', handleMessageDeleted);
    log('info', '✅ Socket event listeners registered successfully');

    // 清理函数
    return () => {
      log('info', 'Cleaning up socket event listeners...');
      socket.off('new-message', handleNewMessage);
      socket.off('message-updated', handleMessageUpdated);
      socket.off('message-deleted', handleMessageDeleted);
      log('info', '✅ Socket event listeners cleaned up');
    };
  }, [socket, isConnected, dmConversationId, channelId, onNewMessage, log]);

  // 当房间ID变化时，重新加入房间
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

    // 重置房间状态
    hasJoinedRoom.current = false;

    // 延迟一点再加入，确保组件完全挂载
    const timer = setTimeout(() => {
      log('info', `⏰ Delayed join room triggered for: ${roomId}`);
      // 直接在这里执行加入逻辑，不依赖 joinRoom 函数
      if (socket && isConnected) {
        if (dmConversationId) {
          socket.emit('join-dm', dmConversationId);
          log('info', `✅ Successfully emitted join-dm event for room: ${dmConversationId}`);
        } else if (channelId) {
          socket.emit('join-channel', channelId);
          log('info', `✅ Successfully emitted join-channel event for room: ${channelId}`);
        }
        hasJoinedRoom.current = true;
      } else {
        log('warn', `Socket not ready when trying to join room ${roomId}`);
      }
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
    };
  }, [dmConversationId, channelId, socket, isConnected, log]);

  // 组件卸载时清理
  useEffect(() => {
    return () => {
      leaveRoom();
      previousMessageIds.current.clear();
    };
  }, [leaveRoom]);

  return {
    joinRoom,
    leaveRoom,
    isConnected
  };
}
