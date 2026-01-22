'use client';

import { useEffect, useRef } from 'react';
import { Message } from '@/types/message';
import { format, formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';

interface MessageListProps {
  messages: Message[];
  currentUserId: string;
  isLoading?: boolean;
  className?: string;
}

export default function MessageList({
  messages,
  currentUserId,
  isLoading = false,
  className = ''
}: MessageListProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const formatMessageTime = (dateString: string) => {
    const date = new Date(dateString);
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

  const formatMessageDate = (dateString: string) => {
    const date = new Date(dateString);
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

    messages.forEach(message => {
      const date = new Date(message.createdAt);
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
    <div className={`flex-1 min-h-0 overflow-y-auto message-scroll h-full p-6`} style={{ scrollbarGutter: 'stable' }}>
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

                return (
                  <div
                    key={message.id}
                    className={`flex items-start gap-3 ${
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
                        <p className="text-sm whitespace-pre-wrap break-words">
                          {message.content}
                        </p>
                      </div>

                      {/* 回复指示器 */}
                      {message.parentMessageId && (
                        <div className="mt-1 text-xs text-text-tertiary">
                          已回复
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        {/* 自动滚动锚点 - 确保新消息到达时能滚动到底部 */}
        <div ref={messagesEndRef} className="h-1" />
      </div>
    </div>
  );
}
