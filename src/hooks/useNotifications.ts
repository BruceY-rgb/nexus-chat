// =====================================================
// 通知监听 Hook
// 监听 WebSocket 新通知事件并显示 Slack 风格 toast
// 集成浏览器原生通知功能（仅在页面后台时触发）
// =====================================================

import { useEffect, useCallback } from 'react';
import { useSocket } from './useSocket';
import { NewNotificationPayload } from '@/types/socket';
import { showSlackToast } from '@/components/ui/SlackToast';

interface UseNotificationsOptions {
  userId?: string;
}

// 浏览器通知权限类型
type NotificationPermission = 'default' | 'granted' | 'denied';

// 检查浏览器通知支持
const isNotificationSupported = (): boolean => {
  return typeof window !== 'undefined' && 'Notification' in window;
};

// 获取通知权限
const getNotificationPermission = (): NotificationPermission => {
  if (!isNotificationSupported()) {
    return 'denied';
  }
  return Notification.permission;
};

// 请求通知权限
const requestNotificationPermission = async (): Promise<NotificationPermission> => {
  if (!isNotificationSupported()) {
    return 'denied';
  }

  try {
    const permission = await Notification.requestPermission();
    return permission;
  } catch (error) {
    console.error('Error requesting notification permission:', error);
    return 'denied';
  }
};

// 显示浏览器原生通知
const showBrowserNotification = (notification: NewNotificationPayload): void => {
  // 🔍 详细调试日志
  console.log('🔔 [DEBUG] showBrowserNotification called', {
    notificationId: notification.id,
    notificationType: notification.type,
    timestamp: new Date().toISOString()
  });

  // 环境检查
  if (!isNotificationSupported()) {
    console.warn('❌ [DEBUG] Browser notifications not supported');
    return;
  }
  console.log('✅ [DEBUG] Browser notifications are supported');

  // 权限检查
  const permission = getNotificationPermission();
  console.log('🔍 [DEBUG] Notification permission status:', permission);

  if (permission !== 'granted') {
    console.log('❌ [DEBUG] Notification permission not granted:', permission);
    console.log('💡 [TIP] To enable notifications:');
    console.log('  1. Click the address bar notification icon');
    console.log('  2. Or go to browser settings > Site Settings > Notifications');
    return;
  }
  console.log('✅ [DEBUG] Notification permission granted');

  // 页面可见性检查 - 仅在页面隐藏时显示原生通知
  if (typeof document !== 'undefined') {
    const visibilityState = document.visibilityState;
    console.log('🔍 [DEBUG] Page visibility state:', visibilityState);

    if (visibilityState !== 'hidden') {
      console.log('⚠️ [DEBUG] Page is visible, skipping browser notification (this is correct behavior)');
      console.log('💡 [TIP] Switch to another tab or minimize the window to test notifications');
      return;
    }
    console.log('✅ [DEBUG] Page is hidden, will show browser notification');
  }

  // 通知类型过滤 - 仅对 mention 和 dm 显示原生通知
  if (notification.type !== 'mention' && notification.type !== 'dm') {
    console.log('⚠️ [DEBUG] Skipping browser notification for type:', notification.type);
    return;
  }
  console.log('✅ [DEBUG] Notification type is valid:', notification.type);

  // 准备通知内容
  const title = notification.title || 'New Message';
  const messageContent = notification.content || '';
  const avatarUrl = notification.user?.avatarUrl || '/favicon.ico';
  const senderName = notification.user?.displayName || 'Unknown User';

  // 格式化消息内容（限制长度）
  const formattedContent = messageContent.length > 50
    ? `${messageContent.substring(0, 50)}...`
    : messageContent;

  // 构建通知标签，用于去重
  let notificationTag = '';
  if (notification.type === 'mention' && notification.relatedChannelId) {
    notificationTag = `channel-${notification.relatedChannelId}`;
  } else if (notification.type === 'dm' && notification.relatedDmConversationId) {
    notificationTag = `dm-${notification.relatedDmConversationId}`;
  } else if (notification.type === 'dm' && notification.user?.id) {
    notificationTag = `dm-user-${notification.user.id}`;
  }

  // 创建通知选项
  const notificationOptions: NotificationOptions = {
    body: `${senderName}: ${formattedContent}`,
    icon: avatarUrl,
    tag: notificationTag,
    badge: '/favicon.ico',
    requireInteraction: false,
    silent: false,
  };

  console.log('🔍 [DEBUG] Notification options:', notificationOptions);

  // 显示通知
  try {
    console.log('🚀 [DEBUG] Creating notification...');
    const browserNotification = new Notification(title, notificationOptions);

    // 点击通知时的行为：聚焦页面并跳转到对应聊天
    browserNotification.onclick = () => {
      console.log('🔔 [DEBUG] Notification clicked');
      // 聚焦到当前窗口
      window.focus();

      // 跳转到对应的聊天页面
      if (notification.type === 'mention' && notification.relatedChannelId) {
        // 跳转到频道
        window.location.href = `/dashboard?channel=${notification.relatedChannelId}`;
      } else if (notification.type === 'dm' && notification.user?.id) {
        // 跳转到 DM
        window.location.href = `/dm/${notification.user.id}`;
      }

      // 关闭通知
      browserNotification.close();
    };

    console.log('✅ [SUCCESS] Browser notification displayed:', {
      title,
      tag: notificationTag,
      type: notification.type,
      sender: senderName,
      content: formattedContent
    });

    // 如果所有条件都满足但仍不显示通知，添加额外提示
    setTimeout(() => {
      console.log('💡 [TIP] If you still don\'t see the notification:');
      console.log('  1. Check your browser\'s notification center');
      console.log('  2. Ensure notifications are not blocked for this site');
      console.log('  3. Try the test notification button in the diagnostics panel');
    }, 1000);
  } catch (error) {
    console.error('❌ [ERROR] Error displaying browser notification:', error);
  }
};

export function useNotifications(options?: UseNotificationsOptions) {
  const { socket } = useSocket();
  const { userId } = options || {};

  // 初始化时请求通知权限
  useEffect(() => {
    if (!userId) return;

    const initNotifications = async () => {
      const permission = getNotificationPermission();

      if (permission === 'default') {
        console.log('🔔 Requesting notification permission...');
        const newPermission = await requestNotificationPermission();
        console.log('🔔 Notification permission result:', newPermission);
      } else {
        console.log('🔔 Notification permission status:', permission);
      }
    };

    initNotifications();
  }, [userId]);

  useEffect(() => {
    if (!socket || !userId) {
      return;
    }

    console.log('🔔 Setting up notification listener for user:', userId);

    // 监听新通知事件
    const handleNewNotification = (notification: NewNotificationPayload) => {
      console.log('🔔 Received new notification:', notification);

      // 显示 Slack 风格的自定义 toast（始终显示）
      showSlackToast(notification);

      // 显示浏览器原生通知（仅在页面后台时）
      showBrowserNotification(notification);
    };

    // 注册监听器
    socket.on('new-notification', handleNewNotification);

    // 清理函数
    return () => {
      console.log('🔔 Removing notification listener for user:', userId);
      socket.off('new-notification', handleNewNotification);
    };
  }, [socket, userId]);

  // 暴露给组件的方法
  const requestPermission = useCallback(async (): Promise<NotificationPermission> => {
    return await requestNotificationPermission();
  }, []);

  const getPermission = useCallback((): NotificationPermission => {
    return getNotificationPermission();
  }, []);

  const isSupported = useCallback((): boolean => {
    return isNotificationSupported();
  }, []);

  return {
    requestPermission,
    getPermission,
    isSupported,
  };
}
