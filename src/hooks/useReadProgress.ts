'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';

interface ReadProgress {
  lastReadMessageId: string | null;
  lastReadAt: Date | null;
}

interface UseReadProgressProps {
  channelId?: string;
  dmConversationId?: string;
  messages: any[];
  messageRefs: React.MutableRefObject<{ [key: string]: HTMLDivElement | null }>;
  onScrollToMessage?: (messageId: string) => void;
}

export function useReadProgress({
  channelId,
  dmConversationId,
  messages,
  messageRefs,
  onScrollToMessage
}: UseReadProgressProps) {
  const router = useRouter();
  const [readPosition, setReadPosition] = useState<ReadProgress | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const hasScrolledToReadPosition = useRef(false);

  // 获取阅读位置
  const fetchReadPosition = useCallback(async (retryCount = 0) => {
    if (!channelId && !dmConversationId) {
      setIsLoading(false);
      return;
    }

    try {
      const params = new URLSearchParams();
      if (channelId) params.append('channelId', channelId);
      if (dmConversationId) params.append('dmConversationId', dmConversationId);

      const response = await fetch(`/api/conversations/read-position?${params.toString()}`, {
        method: 'GET',
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        setReadPosition({
          lastReadMessageId: data.lastReadMessageId,
          lastReadAt: data.lastReadAt ? new Date(data.lastReadAt) : null
        });
      } else if (response.status === 403) {
        // 权限错误：用户可能不是频道成员
        console.warn('⚠️ Permission denied when fetching read position, may not be a channel member');
        // 设置默认位置（未读）
        setReadPosition({
          lastReadMessageId: null,
          lastReadAt: null
        });
        // 延迟重试（最多3次）
        if (retryCount < 3) {
          setTimeout(() => {
            fetchReadPosition(retryCount + 1);
          }, 1000 * (retryCount + 1));
        }
      }
    } catch (error) {
      console.error('Failed to fetch read position:', error);
      // 网络错误也可以重试
      if (retryCount < 3) {
        setTimeout(() => {
          fetchReadPosition(retryCount + 1);
        }, 1000 * (retryCount + 1));
      }
    } finally {
      setIsLoading(false);
    }
  }, [channelId, dmConversationId]);

  // 上报阅读进度
  const reportReadProgress = useCallback(async (messageId: string) => {
    if (!channelId && !dmConversationId) return;

    // 清除之前的防抖定时器
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    // 设置新的防抖定时器（2秒后执行）
    debounceRef.current = setTimeout(async () => {
      try {
        await fetch('/api/messages/read', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          credentials: 'include',
          body: JSON.stringify({
            channelId,
            dmConversationId,
            lastReadMessageId: messageId
          })
        });
      } catch (error) {
        console.error('Failed to report read progress:', error);
      }
    }, 2000);
  }, [channelId, dmConversationId]);

  // 自动定位到上次阅读位置
  const scrollToReadPosition = useCallback(() => {
    if (
      !readPosition?.lastReadMessageId ||
      !messages.length ||
      hasScrolledToReadPosition.current
    ) {
      return;
    }

    const messageElement = messageRefs.current[readPosition.lastReadMessageId];
    if (messageElement) {
      // 延迟执行，确保 DOM 完全渲染
      setTimeout(() => {
        messageElement.scrollIntoView({ behavior: 'instant', block: 'start' });
        hasScrolledToReadPosition.current = true;
        if (onScrollToMessage) {
          onScrollToMessage(readPosition.lastReadMessageId!);
        }
      }, 100);
    }
  }, [readPosition, messages, messageRefs, onScrollToMessage]);

  // 监听消息加载，自动定位
  useEffect(() => {
    if (!isLoading && messages.length) {
      scrollToReadPosition();
    }
  }, [isLoading, messages, scrollToReadPosition]);

  // 初始化时获取阅读位置
  useEffect(() => {
    fetchReadPosition();
  }, [fetchReadPosition]);

  // 清理防抖定时器
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  return {
    readPosition,
    isLoading,
    reportReadProgress,
    scrollToReadPosition
  };
}
