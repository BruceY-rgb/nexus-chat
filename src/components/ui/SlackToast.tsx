// =====================================================
// Slack 风格自定义 Toast 组件
// 完全模拟 Slack 通知的视觉设计和交互
// =====================================================

'use client';

import { AtSign, MessageSquare } from 'lucide-react';
import { NewNotificationPayload } from '@/types/socket';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

interface SlackToastProps {
  notification: NewNotificationPayload;
  onDismiss: () => void;
}

export function SlackToast({ notification, onDismiss }: SlackToastProps) {
  const router = useRouter();

  // 根据通知类型选择图标和颜色
  const getTypeConfig = (type: string) => {
    switch (type) {
      case 'mention':
        return {
          icon: AtSign,
          color: '#E8912D', // 橘黄色
          buttonText: '查看',
        };
      case 'dm':
        return {
          icon: MessageSquare,
          color: '#1D9BD1', // 蓝色
          buttonText: '回复',
        };
      case 'channel_invite':
        return {
          icon: AtSign,
          color: '#E8912D',
          buttonText: '查看',
        };
      default:
        return {
          icon: MessageSquare,
          color: '#1D9BD1',
          buttonText: '查看',
        };
    }
  };

  const config = getTypeConfig(notification.type);
  const Icon = config.icon;

  // 处理点击查看按钮
  const handleView = (e?: React.MouseEvent) => {
    e?.stopPropagation(); // 阻止事件冒泡

    console.log('🔔 [SlackToast] handleView clicked:', {
      type: notification.type,
      relatedChannelId: notification.relatedChannelId,
      relatedDmConversationId: notification.relatedDmConversationId,
      userId: notification.user.id,
      relatedMessageId: notification.relatedMessageId
    });

    // 根据通知类型跳转到相应页面
    if (notification.type === 'mention' && notification.relatedChannelId) {
      // 跳转到频道
      console.log('➡️ 跳转到频道:', notification.relatedChannelId);
      const url = notification.relatedMessageId
        ? `/dashboard?channel=${notification.relatedChannelId}&messageId=${notification.relatedMessageId}`
        : `/dashboard?channel=${notification.relatedChannelId}`;
      router.push(url);
    } else if (notification.type === 'channel_invite' && notification.relatedChannelId) {
      // 跳转到频道邀请页面
      console.log('➡️ 跳转到频道邀请:', notification.relatedChannelId);
      router.push(`/dashboard?channel=${notification.relatedChannelId}`);
    } else if (notification.type === 'dm') {
      // 跳转到私聊 - 使用 relatedDmConversationId 或 user.id
      const dmId = notification.relatedDmConversationId || notification.user.id;
      console.log('➡️ 跳转到私聊:', dmId);
      const url = notification.relatedMessageId
        ? `/dm/${dmId}?messageId=${notification.relatedMessageId}`
        : `/dm/${dmId}`;
      router.push(url);
    }

    // 自动聚焦到应用窗口
    window.focus();

    // 关闭 toast
    onDismiss();
  };

  // 处理忽略按钮
  const handleDismiss = (e: React.MouseEvent) => {
    e?.stopPropagation(); // 阻止事件冒泡
    console.log('忽略通知:', notification.id);
    onDismiss();
  };

  // 处理容器点击（整个 toast 区域）
  const handleContainerClick = () => {
    handleView();
  };

  return (
    <div
      onClick={handleContainerClick}
      className="
        w-[350px] rounded-lg overflow-hidden shadow-2xl
        border border-[#303235]
        bg-[#1A1D21]
        cursor-pointer
      "
    >
      {/* 左侧彩色指示条 */}
      <div
        className="w-1 h-full absolute left-0"
        style={{ backgroundColor: config.color }}
      />

      <div className="flex items-start p-4 gap-3">
        {/* 图标区域 */}
        <div
          className="
            w-10 h-10 rounded-md flex items-center justify-center
            bg-[#25271C]
            flex-shrink-0
          "
        >
          <Icon size={20} color={config.color} />
        </div>

        {/* 内容区域 */}
        <div className="flex-1 min-w-0">
          {/* 标题 */}
          <h4 className="text-[#D1D2D3] font-semibold text-sm truncate">
            {notification.title}
          </h4>

          {/* 内容 */}
          {notification.content && (
            <p
              className="text-[#D1D2D3] text-sm mt-1"
              style={{
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {notification.content}
            </p>
          )}

          {/* 按钮区域 */}
          <div className="flex gap-3 mt-3">
            <button
              onClick={handleView}
              className="
                text-sm font-semibold
                text-[#1D9BD1]
                hover:underline
                transition-all
              "
            >
              {config.buttonText}
            </button>
            <button
              onClick={handleDismiss}
              className="
                text-sm
                text-[#9CA3AF]
                hover:text-[#D1D2D3]
                transition-all
              "
            >
              忽略
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// 创建 Slack 风格 toast 的辅助函数
export function showSlackToast(notification: NewNotificationPayload) {
  return toast.custom(
    (t) => (
      <SlackToast
        notification={notification}
        onDismiss={() => toast.dismiss(t)}
      />
    ),
    {
      duration: 5000,
    }
  );
}
