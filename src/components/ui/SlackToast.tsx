// =====================================================
// Slack-style custom Toast component
// Fully simulates Slack notification visual design and interaction
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

  // Select icon and color based on notification type
  const getTypeConfig = (type: string) => {
    switch (type) {
      case 'mention':
        return {
          icon: AtSign,
          color: '#E8912D', // Orange
          buttonText: 'Reply',
        };
      case 'dm':
        return {
          icon: MessageSquare,
          color: '#1D9BD1', // Blue
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

  // Handle view button click
  const handleView = () => {
    // Navigate to corresponding page based on notification type
    if (notification.type === 'mention' && notification.relatedChannelId) {
      // Jump to channel
      console.log('jump to channel:', notification.relatedChannelId);
      const url = notification.relatedMessageId
        ? `/dashboard?channel=${notification.relatedChannelId}&messageId=${notification.relatedMessageId}`
        : `/dashboard?channel=${notification.relatedChannelId}`;
      router.push(url);
    } else if (notification.type === 'dm' && notification.relatedDmConversationId) {
      // Jump to direct message
      console.log('jump to dm:', notification.relatedDmConversationId);
      const url = notification.relatedMessageId
        ? `/dm/${notification.relatedDmConversationId}?messageId=${notification.relatedMessageId}`
        : `/dm/${notification.relatedDmConversationId}`;
      router.push(url);
    }

    // Close toast
    onDismiss();
  };

  // Handle ignore button
  const handleDismiss = () => {
    console.log('Dismiss notification:', notification.id);
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
      {/* Left color indicator strip */}
      <div
        className="w-1 h-full absolute left-0"
        style={{ backgroundColor: config.color }}
      />

      <div className="flex items-start p-4 gap-3">
        {/* Icon area */}
        <div
          className="
            w-10 h-10 rounded-md flex items-center justify-center
            bg-[#25271C]
            flex-shrink-0
          "
        >
          <Icon size={20} color={config.color} />
        </div>

        {/* Content area */}
        <div className="flex-1 min-w-0">
          {/* Title */}
          <h4 className="text-[#D1D2D3] font-semibold text-sm truncate">
            {notification.title}
          </h4>

          {/* Content */}
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

          {/* Button area */}
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

// Helper function to create Slack-style toast
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
