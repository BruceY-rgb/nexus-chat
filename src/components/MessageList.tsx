'use client';

import { useEffect, useRef, useState, forwardRef, useImperativeHandle, useCallback, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { Message } from '@/types/message';
import { format, formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import MessageItem from './MessageItem';
import { useReadProgress } from '@/hooks/useReadProgress';

interface MessageListProps {
  messages: Message[];
  currentUserId: string;
  isLoading?: boolean;
  className?: string;
  channelId?: string;
  dmConversationId?: string;
  onScrollPositionChange?: (isAtBottom: boolean) => void;
  onEditMessage?: (messageId: string, content: string) => Promise<void>;
  onDeleteMessage?: (messageId: string) => Promise<void>;
  onThreadReply?: (message: Message) => void;
  onQuote?: (message: Message) => void;
}

export interface MessageListRef {
  highlightMessage: (messageId: string) => void;
}

const MessageList = forwardRef<MessageListRef, MessageListProps>(({
  messages,
  currentUserId,
  isLoading = false,
  className = '',
  channelId,
  dmConversationId,
  onScrollPositionChange,
  onEditMessage,
  onDeleteMessage,
  onThreadReply,
  onQuote
}, ref) => {
  const searchParams = useSearchParams();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const messageRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});
  const [showReadIndicator] = useState<string | null>(null);
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);

  // 使用阅读进度 Hook - 移除onScrollToMessage回调，避免与组件内高亮逻辑冲突
  const { reportReadProgress } = useReadProgress({
    channelId,
    dmConversationId,
    messages,
    messageRefs
  });

  // 处理编辑消息 - 使用 useCallback 优化
  const handleEditMessage = useCallback(async (messageId: string, content: string) => {
    if (onEditMessage) {
      await onEditMessage(messageId, content);
      setEditingMessageId(null); // 退出编辑模式
    }
  }, [onEditMessage]);

  // 处理删除消息 - 使用 useCallback 优化
  const handleDeleteMessage = useCallback(async (messageId: string) => {
    if (onDeleteMessage) {
      await onDeleteMessage(messageId);
    }
  }, [onDeleteMessage]);

  // 开始编辑消息 - 使用 useCallback 优化
  const startEditing = useCallback((message: Message) => {
    setEditingMessageId(message.id);
  }, []);

  // 取消编辑 - 使用 useCallback 优化
  const cancelEditing = useCallback(() => {
    setEditingMessageId(null);
  }, []);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  const scrollToMessage = useCallback((messageId: string) => {
    const messageElement = messageRefs.current[messageId];
    if (messageElement) {
      messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // 滚动定位通过 highlightedMessageId 状态控制视觉效果，无需直接操作 classList
    }
  }, [messageRefs]);

  // 使用 useImperativeHandle 暴露 highlightMessage 方法
  useImperativeHandle(ref, () => ({
    highlightMessage: (messageId: string) => {
      setHighlightedMessageId(messageId);
      setTimeout(() => {
        scrollToMessage(messageId);
      }, 100);
      // 2秒后自动清除高亮
      setTimeout(() => {
        setHighlightedMessageId(null);
      }, 2000);
    }
  }));

  // 滚动位置检测 - 判断用户是否在消息列表底部
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    let isAtBottom = false;
    let timeoutId: NodeJS.Timeout;

    const checkScrollPosition = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      // 判断是否在底部（允许100px的误差）
      isAtBottom = scrollHeight - scrollTop - clientHeight < 100;

      // 通知父组件滚动位置变化
      if (onScrollPositionChange) {
        onScrollPositionChange(isAtBottom);
      }
    };

    // 滚动事件处理函数
    const handleScroll = () => {
      // 使用防抖，避免频繁触发
      clearTimeout(timeoutId);
      timeoutId = setTimeout(checkScrollPosition, 50);
    };

    // 初始检查
    checkScrollPosition();

    // 添加滚动监听
    container.addEventListener('scroll', handleScroll, { passive: true });

    // 监听消息变化（可能改变容器高度）
    const resizeObserver = new ResizeObserver(() => {
      checkScrollPosition();
    });

    resizeObserver.observe(container);

    return () => {
      container.removeEventListener('scroll', handleScroll);
      resizeObserver.disconnect();
      clearTimeout(timeoutId);
    };
  }, [onScrollPositionChange, messages]);

  // 监听滚动并自动上报阅读进度
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        // 找到最后一条可见的消息
        const visibleMessages = entries
          .filter(entry => entry.isIntersecting)
          .sort((a, b) => {
            // 按位置排序，获取最底部的消息
            const rectA = a.target.getBoundingClientRect();
            const rectB = b.target.getBoundingClientRect();
            return rectB.top - rectA.top;
          });

        if (visibleMessages.length > 0) {
          const lastVisibleMessage = visibleMessages[0];
          const messageId = lastVisibleMessage.target.getAttribute('data-message-id');
          if (messageId) {
            reportReadProgress(messageId);
          }
        }
      },
      {
        threshold: 0.3, // 消息 30% 可见时触发
        rootMargin: '100px' // 提前 100px 开始检测
      }
    );

    // 观察所有消息元素
    Object.entries(messageRefs.current).forEach(([messageId, element]) => {
      if (element) {
        element.setAttribute('data-message-id', messageId);
        observer.observe(element);
      }
    });

    return () => {
      observer.disconnect();
    };
  }, [messages, reportReadProgress]);

  useEffect(() => {
    // 检查 URL 中的 messageId 参数
    const messageId = searchParams.get('messageId');
    if (messageId && messages.length > 0) {
      // 设置高亮状态
      setHighlightedMessageId(messageId);
      // 延迟执行，确保消息已渲染
      setTimeout(() => {
        scrollToMessage(messageId);
      }, 100);
      // 2秒后自动清除高亮
      setTimeout(() => {
        setHighlightedMessageId(null);
      }, 2000);
    } else {
      // 没有指定消息时，滚动到底部并清除高亮
      setHighlightedMessageId(null);
      scrollToBottom();
    }
  }, [searchParams, messages]);

  // 监听点击事件，用户点击页面任意位置时清除高亮
  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      const messageId = searchParams.get('messageId');
      // 只有在有 messageId 参数时才需要手动清除高亮
      if (messageId) {
        // 检查点击是否来自 toast 外部（即用户主动与页面交互）
        const target = event.target as HTMLElement;
        const isFromToast = target.closest('[data-sonner-toast]');
        // 如果不是来自 toast 的点击，则清除高亮
        if (!isFromToast) {
          setHighlightedMessageId(null);
        }
      }
    };

    document.addEventListener('click', handleClick);
    return () => {
      document.removeEventListener('click', handleClick);
    };
  }, [searchParams]);

  // 格式化消息时间 - 使用 useCallback 优化
  const formatMessageTime = useCallback((dateString: string | null | undefined) => {
    // 容错处理：如果日期字符串无效，返回 '--'
    if (!dateString || typeof dateString !== 'string') {
      return '--';
    }

    const date = new Date(dateString);

    // 检查日期是否有效
    if (isNaN(date.getTime())) {
      return '--';
    }

    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 24) {
      return format(date, 'HH:mm', { locale: zhCN });
    } else if (diffInHours < 168) { // 7 days
      return format(date, 'MM/dd HH:mm', { locale: zhCN });
    } else {
      return format(date, 'yyyy/MM/dd HH:mm', { locale: zhCN });
    }
  }, []);

  // 格式化消息日期 - 使用 useCallback 优化
  const formatMessageDate = useCallback((dateString: string | null | undefined) => {
    // 容错处理：如果日期字符串无效，返回默认日期
    if (!dateString || typeof dateString !== 'string') {
      return '未知日期';
    }

    const date = new Date(dateString);

    // 检查日期是否有效
    if (isNaN(date.getTime())) {
      return '未知日期';
    }

    const now = new Date();
    const diffInDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffInDays === 0) {
      return 'Today';
    } else if (diffInDays === 1) {
      return 'Yesterday';
    } else if (diffInDays < 7) {
      return formatDistanceToNow(date, { addSuffix: true, locale: zhCN });
    } else {
      return format(date, 'yyyy年MM月dd日', { locale: zhCN });
    }
  }, []);

  // 按日期分组消息 - 使用 useMemo 优化，避免每次渲染都重新计算
  const messageGroups = useMemo(() => {
    const groups: { [key: string]: Message[] } = {};

    // 使用 Set 来跟踪已经警告过的无效消息，避免重复日志
    const warnedMessages = new Set<string>();

    messages.forEach(message => {
      // 容错处理：跳过无效的消息
      if (!message || !message.createdAt) {
        if (!warnedMessages.has(message.id)) {
          console.warn('Invalid message or missing createdAt:', message);
          warnedMessages.add(message.id);
        }
        return;
      }

      // 检查 createdAt 是否是字符串类型
      if (typeof message.createdAt !== 'string') {
        if (!warnedMessages.has(message.id)) {
          console.warn('Invalid createdAt type:', typeof message.createdAt, message.createdAt);
          warnedMessages.add(message.id);
        }
        return;
      }

      const date = new Date(message.createdAt);

      // 检查日期是否有效
      if (isNaN(date.getTime())) {
        if (!warnedMessages.has(message.id)) {
          console.warn('Invalid date value:', message.createdAt);
          warnedMessages.add(message.id);
        }
        return;
      }

      const dateKey = format(date, 'yyyy-MM-dd');

      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(message);
    });

    return groups;
  }, [messages]);

  if (isLoading) {
    return (
      <div className={`flex-1 min-h-0 overflow-y-auto message-scroll max-h-[calc(100vh-120px)] p-6 ${className}`} style={{ scrollbarGutter: 'stable' }}>
        <div className="max-w-4xl mx-auto">
          <div className="text-center py-12">
            <div className="inline-block w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            <p className="text-text-secondary mt-4">Loading messages...</p>
          </div>
        </div>
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className={`flex-1 min-h-0 overflow-y-auto message-scroll max-h-[calc(100vh-120px)] p-6 ${className}`} style={{ scrollbarGutter: 'stable' }}>
        <div className="max-w-4xl mx-auto">
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                className="w-8 h-8 text-primary"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-text-primary mb-1">
              There are no messages yet
            </h3>
            <p className="text-text-secondary">
              Start the conversation by sending the first message!
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={scrollContainerRef}
      className={`flex-1 min-h-0 overflow-y-auto message-scroll h-full p-6`}
      style={{ scrollbarGutter: 'stable' }}
      id="messages-scroll-container"
    >
      <div className="w-full">
        {Object.entries(messageGroups).map(([dateKey, dayMessages]) => (
          <div key={dateKey}>
            {/* 日期分割线 */}
            <div className="flex items-center justify-center my-6">
              <div className="bg-background-component px-4 py-1 rounded-full text-xs text-text-tertiary">
                {formatMessageDate(dayMessages[0].createdAt)}
              </div>
            </div>

            {/* 消息列表 */}
            <div className="space-y-4">
              {dayMessages.map((message, index) => {
                const isOwnMessage = message.userId === currentUserId;
                const showAvatar = index === 0 || dayMessages[index - 1].userId !== message.userId;
                const isHighlighted = message.id === highlightedMessageId;

                return (
                  <MessageItem
                    key={message.id}
                    message={message}
                    currentUserId={currentUserId}
                    isOwnMessage={isOwnMessage}
                    showAvatar={showAvatar}
                    isHighlighted={isHighlighted}
                    showReadIndicator={showReadIndicator}
                    editingMessageId={editingMessageId}
                    onStartEditing={startEditing}
                    onSaveEdit={handleEditMessage}
                    onCancelEdit={cancelEditing}
                    onDeleteMessage={handleDeleteMessage}
                    onThreadReply={onThreadReply || (() => {})}
                    onQuote={onQuote || (() => {})}
                    formatMessageTime={formatMessageTime}
                    messageRefs={messageRefs}
                    scrollContainerRef={scrollContainerRef}
                  />
                );
              })}
            </div>
          </div>
        ))}
        {/* 自动滚动锚点 - 确保新消息到达时能滚动到底部 */}
        <div ref={messagesEndRef} className="h-1" id="messages-end-ref" />
      </div>
    </div>
  );
});

MessageList.displayName = 'MessageList';

export default MessageList;
