// =====================================================
// 通知监听 Hook
// 监听 WebSocket 新通知事件并显示 toast
// =====================================================

import { useEffect } from 'react';
import { toast } from 'sonner';
import { useSocket } from './useSocket';
import { NewNotificationPayload } from '@/types/socket';

interface UseNotificationsOptions {
  userId?: string;
}

export function useNotifications(options?: UseNotificationsOptions) {
  const { socket } = useSocket();
  const { userId } = options || {};

  useEffect(() => {
    if (!socket || !userId) {
      return;
    }

    console.log('🔔 Setting up notification listener for user:', userId);

    // 监听新通知事件
    const handleNewNotification = (notification: NewNotificationPayload) => {
      console.log('🔔 Received new notification:', notification);

      // 根据通知类型显示不同的 toast
      if (notification.type === 'mention') {
        toast(notification.title, {
          description: notification.content,
          duration: 4000,
          action: {
            label: '查看',
            onClick: () => {
              // 这里可以添加点击查看的逻辑
              // 例如跳转到相关消息或频道
              console.log('查看通知:', notification);
            },
          },
        });
      } else if (notification.type === 'dm') {
        toast(notification.title, {
          description: notification.content,
          duration: 4000,
          action: {
            label: '回复',
            onClick: () => {
              console.log('回复消息:', notification);
            },
          },
        });
      } else {
        // 其他类型的通知
        toast(notification.title, {
          description: notification.content,
          duration: 3000,
        });
      }
    };

    // 注册监听器
    socket.on('new-notification', handleNewNotification);

    // 清理函数
    return () => {
      console.log('🔔 Removing notification listener for user:', userId);
      socket.off('new-notification', handleNewNotification);
    };
  }, [socket, userId]);
}
