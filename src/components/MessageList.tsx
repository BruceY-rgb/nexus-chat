'use client';

import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import { useSearchParams } from 'next/navigation';
import { Message } from '@/types/message';
import { format, formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import MessageRenderer from './MessageRenderer';
import { useReadProgress } from '@/hooks/useReadProgress';

interface MessageListProps {
  messages: Message[];
  currentUserId: string;
  isLoading?: boolean;
  className?: string;
  channelId?: string;
  dmConversationId?: string;
  onScrollPositionChange?: (isAtBottom: boolean) => void;
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
  onScrollPositionChange
}, ref) => {
  const searchParams = useSearchParams();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const messageRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});
  const [showReadIndicator, setShowReadIndicator] = useState<string | null>(null);
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);

  // 使用阅读进度 Hook - 移除onScrollToMessage回调，避免与组件内高亮逻辑冲突
  const { readPosition, isLoading: isLoadingReadPosition, reportReadProgress } = useReadProgress({
    channelId,
    dmConversationId,
    messages,
    messageRefs
  });

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const scrollToMessage = (messageId: string) => {
    const messageElement = messageRefs.current[messageId];
    if (messageElement) {
      messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // 滚动定位通过 highlightedMessageId 状态控制视觉效果，无需直接操作 classList
    }
  };

  // 使用 useImperativeHandle 暴露 highlightMessage 方法
  useImperativeHandle(ref, () => ({
    highlightMessage: (messageId: string) => {
      setHighlightedMessageId(messageId);
      setTimeout(() => {
        scrollToMessage(messageId);
      }, 100);
      // 3秒后自动清除高亮
      setTimeout(() => {
        setHighlightedMessageId(null);
      }, 3000);
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
      // 3秒后自动清除高亮
      setTimeout(() => {
        setHighlightedMessageId(null);
      }, 3000);
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

  const formatMessageTime = (dateString: string | null | undefined) => {
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
  };

  const formatMessageDate = (dateString: string | null | undefined) => {
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
      return '今天';
    } else if (diffInDays === 1) {
      return '昨天';
    } else if (diffInDays < 7) {
      return formatDistanceToNow(date, { addSuffix: true, locale: zhCN });
    } else {
      return format(date, 'yyyy年MM月dd日', { locale: zhCN });
    }
  };

  const groupMessagesByDate = (messages: Message[]) => {
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
  };

  if (isLoading) {
    return (
      <div className={`flex-1 min-h-0 overflow-y-auto message-scroll max-h-[calc(100vh-120px)] p-6 ${className}`} style={{ scrollbarGutter: 'stable' }}>
        <div className="max-w-4xl mx-auto">
          <div className="text-center py-12">
            <div className="inline-block w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            <p className="text-text-secondary mt-4">加载消息中...</p>
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
              还没有消息
            </h3>
            <p className="text-text-secondary">
              发送第一条消息开始对话吧！
            </p>
          </div>
        </div>
      </div>
    );
  }

  const messageGroups = groupMessagesByDate(messages);

  return (
    <div
      ref={scrollContainerRef}
      className={`flex-1 min-h-0 overflow-y-auto message-scroll h-full p-6`}
      style={{ scrollbarGutter: 'stable' }}
      id="messages-scroll-container"
    >
      <div className="max-w-4xl mx-auto">
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
                  <div key={message.id}>
                    {/* 阅读指示器 */}
                    {showReadIndicator === message.id && (
                      <div className="flex items-center justify-center my-4 animate-fade-in">
                        <div className="bg-blue-500/90 text-white px-4 py-1 rounded-full text-xs font-medium shadow-lg">
                          上次阅读到这里
                        </div>
                      </div>
                    )}

                    <div
                      ref={(el) => {
                        messageRefs.current[message.id] = el;
                      }}
                      className={`flex items-start gap-3 transition-all duration-200 ${
                        isHighlighted ? 'bg-yellow-200/70 rounded-lg shadow-md animate-pulse' : ''
                      } ${
                        isOwnMessage ? 'flex-row-reverse' : ''
                      }`}
                    >
                      {/* 头像 */}
                      {showAvatar ? (
                        <img
                          src={message.user.avatarUrl || '/default-avatar.png'}
                          alt={message.user.displayName}
                          className="w-10 h-10 rounded-sm flex-shrink-0"
                        />
                      ) : (
                        <div className="w-10 flex-shrink-0" />
                      )}

                      {/* 消息内容 */}
                      <div className={`flex-1 ${isOwnMessage ? 'text-right' : ''}`}>
                        {/* 用户名和时间（仅在需要时显示） */}
                        {showAvatar && (
                          <div className={`flex items-baseline gap-2 mb-1 ${
                            isOwnMessage ? 'justify-end' : ''
                          }`}>
                            <span className="font-semibold text-text-primary text-sm">
                              {message.user.displayName}
                            </span>
                            <span className="text-xs text-text-tertiary">
                              {formatMessageTime(message.createdAt)}
                            </span>
                          </div>
                        )}

                        {/* 消息气泡 */}
                        <div
                          className={`inline-block max-w-[85%] px-4 py-2 rounded-lg ${
                            isOwnMessage
                              ? 'bg-primary text-white'
                              : 'bg-background-component text-text-primary'
                          }`}
                        >
                          <div className={isOwnMessage ? 'text-white' : 'text-text-primary'}>
                            <MessageRenderer
                              message={message}
                              currentUserId={currentUserId}
                            />
                          </div>
                        </div>

                        {/* 回复指示器 */}
                        {message.parentMessageId && (
                          <div className="mt-1 text-xs text-text-tertiary">
                            已回复
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
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
