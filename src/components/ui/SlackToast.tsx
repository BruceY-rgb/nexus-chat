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
          buttonText: 'Reply',
        };
      case 'dm':
        return {
          icon: MessageSquare,
          color: '#1D9BD1', // 蓝色
          buttonText: 'Reply',
        };
      case 'channel_invite':
        return {
          icon: AtSign,
          color: '#E8912D',
          buttonText: 'View',
        };
      default:
        return {
          icon: MessageSquare,
          color: '#1D9BD1',
          buttonText: 'View',
        };
    }
  };

  const config = getTypeConfig(notification.type);
  const Icon = config.icon;

  // 处理点击查看按钮
  const handleView = () => {
    // 根据通知类型跳转到相应页面
    if (notification.type === 'mention' && notification.relatedChannelId) {
      // 跳转到频道
      console.log('jump to channel:', notification.relatedChannelId);
      const url = notification.relatedMessageId
        ? `/dashboard?channel=${notification.relatedChannelId}&messageId=${notification.relatedMessageId}`
        : `/dashboard?channel=${notification.relatedChannelId}`;
      router.push(url);
    } else if (notification.type === 'dm' && notification.relatedDmConversationId) {
      // 跳转到私聊
      console.log('jump to dm:', notification.relatedDmConversationId);
      const url = notification.relatedMessageId
        ? `/dm/${notification.relatedDmConversationId}?messageId=${notification.relatedMessageId}`
        : `/dm/${notification.relatedDmConversationId}`;
      router.push(url);
    }

    // 关闭 toast
    onDismiss();
  };

  // 处理忽略按钮
  const handleDismiss = () => {
    console.log('忽略通知:', notification.id);
    onDismiss();
  };

  return (
    <div
      className="
        w-[350px] rounded-lg overflow-hidden shadow-2xl
        border border-[#303235]
        bg-[#1A1D21]
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
              Ignore
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
