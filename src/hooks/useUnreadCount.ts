import { useEffect } from 'react';
import { useUnreadStore } from '../store/unreadStore';
import { useSocket } from './useSocket';
import { useAuth } from './useAuth';

export function useUnreadCount() {
  const {
    incrementUnread,
    decrementUnread,
    setUnread,
    clearUnread,
    setUnreadFromDB
  } = useUnreadStore();
  const { socket, isConnected } = useSocket();
  const { user } = useAuth();

  // 从数据库加载未读计数
  const loadUnreadCounts = async (retryCount = 0) => {
    try {
      console.log('📊 Loading unread counts from API...');
      const response = await fetch('/api/users/unread-counts', {
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Loaded unread counts:', data);
        setUnreadFromDB(data);
      } else if (response.status === 403) {
        // 权限错误：用户可能不是频道成员
        console.warn('⚠️ Permission denied for unread counts, may not be a channel member');
        // 不显示错误，而是延迟重试（最多3次）
        if (retryCount < 3) {
          setTimeout(() => {
            loadUnreadCounts(retryCount + 1);
          }, 1000 * (retryCount + 1)); // 递增延迟
        }
      } else {
        console.error('❌ Failed to load unread counts:', response.status);
      }
    } catch (error) {
      console.error('❌ Failed to load unread counts:', error);
      // 网络错误也可以重试
      if (retryCount < 3) {
        setTimeout(() => {
          loadUnreadCounts(retryCount + 1);
        }, 1000 * (retryCount + 1));
      }
    }
  };

  // 标记消息为已读
  const markAsRead = async (channelId?: string, dmConversationId?: string) => {
    try {
      const response = await fetch('/api/messages/read', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          channelId,
          dmConversationId
        })
      });

      if (response.ok) {
        const data = await response.json();

        // 清除本地状态
        if (channelId) {
          clearUnread(channelId);
        } else if (dmConversationId) {
          clearUnread(dmConversationId);
        }

        return data;
      } else if (response.status === 403) {
        // 权限错误：用户可能不是频道成员
        console.warn('⚠️ Permission denied when marking as read, may not be a channel member');
        // 不抛出错误，静默处理
        return null;
      }
    } catch (error) {
      console.error('Failed to mark as read:', error);
      // 网络错误不抛出，静默处理
      return null;
    }
  };

  // 在组件挂载时立即加载未读计数（不依赖 WebSocket）
  useEffect(() => {
    if (user?.id) {
      loadUnreadCounts();
    }
  }, [user?.id]);

  // 设置 WebSocket 监听器
  useEffect(() => {
    if (!socket || !isConnected) {
      return;
    }

    // 监听未读计数更新
    const handleUnreadUpdate = (data: {
      channelId?: string;
      dmConversationId?: string;
      unreadCount: number;
    }) => {
      const { channelId, dmConversationId, unreadCount } = data;

      // 设置未读计数（后端已经排除了发送者，这里直接设置即可）
      if (channelId) {
        setUnread(channelId, unreadCount);
      } else if (dmConversationId) {
        setUnread(dmConversationId, unreadCount);
      }
    };

    // 监听新消息
    const handleNewMessage = (message: any) => {
      const { channelId, dmConversationId, userId } = message;

      // 如果不是当前用户发送的消息，增加未读计数
      if (channelId && userId !== user?.id) {
        incrementUnread(channelId);
      } else if (dmConversationId && userId !== user?.id) {
        incrementUnread(dmConversationId);
      }
    };

    socket.on('unread-count-update', handleUnreadUpdate);
    socket.on('new-message', handleNewMessage);

    // 清理函数
    return () => {
      socket.off('unread-count-update', handleUnreadUpdate);
      socket.off('new-message', handleNewMessage);
    };
  }, [socket, isConnected, user?.id, incrementUnread, setUnread]);

  return {
    loadUnreadCounts,
    markAsRead,
    incrementUnread,
    setUnread,
    clearUnread
  };
}
