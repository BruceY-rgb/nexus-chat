'use client';

import React from 'react';
import { Message } from '@/types/message';
import { useUnreadThreads } from '@/hooks/useUnreadThreads';
import { format } from 'date-fns';
import { MessageSquare } from 'lucide-react';

interface ThreadListProps {
  onThreadSelect: (message: Message) => void;
}

export default function ThreadList({ onThreadSelect }: ThreadListProps) {
  const { threads, isLoading, error } = useUnreadThreads();

  const formatTime = (dateString: string | null | undefined) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 1) {
      return 'just now';
    } else if (diffInHours < 24) {
      return `${Math.floor(diffInHours)}h ago`;
    } else if (diffInHours < 24 * 7) {
      return `${Math.floor(diffInHours / 24)}d ago`;
    } else {
      return format(date, 'MM/dd');
    }
  };

  if (isLoading) {
    return (
      <div className="p-4">
        <div className="animate-pulse space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-gray-100 rounded-lg p-3 h-20"></div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-center text-red-500">
        Failed to load thread list: {error.message}
      </div>
    );
  }

  if (threads.length === 0) {
    return (
      <div className="p-8 text-center text-gray-500">
        <MessageSquare className="w-12 h-12 mx-auto mb-3 text-gray-300" />
        <p className="text-sm">No unread threads</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {threads.map((thread) => (
        <button
          key={thread.id}
          onClick={() => onThreadSelect(thread)}
          className="w-full text-left p-3 hover:bg-gray-50 rounded-lg transition-colors"
        >
          <div className="flex items-start gap-3">
            {/* Avatar */}
            {thread.user?.avatarUrl ? (
              <img
                src={thread.user.avatarUrl}
                alt={thread.user.displayName}
                className="w-8 h-8 rounded-full flex-shrink-0"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-medium text-gray-600">
                  {thread.user?.displayName?.charAt(0).toUpperCase()}
                </span>
              </div>
            )}

            {/* Thread Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2 mb-1">
                <span className="font-medium text-sm text-gray-900 truncate">
                  {thread.user?.displayName}
                </span>
                <span className="text-xs text-gray-500 flex-shrink-0">
                  {formatTime(thread.lastReplyAt)}
                </span>
              </div>

              {/* Thread Preview */}
              <p className="text-sm text-gray-600 truncate mb-1">
                {thread.content}
              </p>

              {/* Thread Meta */}
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <span>
                  {thread.replies?.[0]?.user?.displayName}
                  {thread.replies?.[0]?.content && (
                    <span className="ml-1">
                      {thread.replies[0].content.substring(0, 30)}
                      {thread.replies[0].content.length > 30 ? '...' : ''}
                    </span>
                  )}
                </span>
                <span className="flex items-center gap-1">
                  <MessageSquare className="w-3 h-3" />
                  {thread._count?.replies || 0} replies
                </span>
              </div>
            </div>

            {/* Unread Badge */}
            {thread.unreadCount > 0 && (
              <div className="flex-shrink-0">
                <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-medium text-white bg-red-500 rounded-full">
                  {thread.unreadCount > 99 ? '99+' : thread.unreadCount}
                </span>
              </div>
            )}
          </div>
        </button>
      ))}
    </div>
  );
}
