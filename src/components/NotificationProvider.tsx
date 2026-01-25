'use client';

// =====================================================
// 通知 Provider 组件
// 自动监听 WebSocket 通知事件并显示 toast
// =====================================================

import { useNotifications } from '@/hooks/useNotifications';
import { useAuth } from '@/contexts/AuthContext';

export default function NotificationProvider() {
  const { user } = useAuth();

  // 设置通知监听，传入当前用户ID
  useNotifications({ userId: user?.id });

  // 这个组件不渲染任何内容
  return null;
}
