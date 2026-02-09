'use client';

import React, { memo, useState } from 'react';
import { Message } from '@/types/message';
import MessageRenderer from './MessageRenderer';
import ReactionBadges from './ReactionBadges';
import { useReactions } from '@/hooks/useReactions';
import { format } from 'date-fns';
import { MoreHorizontal, Reply, Smile } from 'lucide-react';

interface ThreadMessageItemProps {
  message: Message;
  currentUserId: string;
  isOwnMessage: boolean;
  isThreadRoot: boolean;
  showThreadActions: boolean;
}

function ThreadMessageItemBase({
  message,
  currentUserId,
  isOwnMessage,
  isThreadRoot,
  showThreadActions
}: ThreadMessageItemProps) {
  const [showActions, setShowActions] = useState(false);
  const { reactions, toggleReaction } = useReactions(message.id, currentUserId);

  const formatTime = (dateString: string | null | undefined) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 24) {
      return format(date, 'HH:mm');
    } else if (diffInHours < 24 * 7) {
      return format(date, 'EEE HH:mm');
    } else {
      return format(date, 'yyyy/MM/dd HH:mm');
    }
  };

  return (
    <div
      className="group relative"
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      <div className="flex gap-3">
        {/* Avatar */}
        {message.user?.avatarUrl ? (
          <img
            src={message.user.avatarUrl}
            alt={message.user.displayName}
            className="w-8 h-8 rounded-full flex-shrink-0"
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center flex-shrink-0">
            <span className="text-xs font-medium text-gray-600">
              {message.user?.displayName?.charAt(0).toUpperCase()}
            </span>
          </div>
        )}

        {/* Message Content */}
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-baseline gap-2 mb-1">
            <span className="font-semibold text-sm text-gray-900">
              {message.user?.displayName}
            </span>
            {isThreadRoot && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                Original
              </span>
            )}
            <span className="text-xs text-gray-500">
              {formatTime(message.createdAt)}
            </span>
          </div>

          {/* Message Content */}
          <div className="text-gray-900">
            <MessageRenderer message={message} currentUserId={currentUserId} />
          </div>

          {/* Attachments */}
          {message.attachments && message.attachments.length > 0 && (
            <div className="mt-2 space-y-2">
              {message.attachments.map((attachment) => (
                <div
                  key={attachment.id}
                  className="border border-gray-200 rounded-lg p-3 bg-gray-50"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 bg-gray-200 rounded flex items-center justify-center">
                      <span className="text-xs text-gray-600">
                        {attachment.mimeType?.split('/')[0] || 'file'}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {attachment.fileName}
                      </p>
                      <p className="text-xs text-gray-500">
                        {attachment.fileSize} bytes
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Reactions */}
          {reactions && reactions.length > 0 && (
            <div className="mt-2">
              <ReactionBadges
                reactions={reactions}
                currentUserId={currentUserId}
                isOwnMessage={isOwnMessage}
                onToggleReaction={toggleReaction}
              />
            </div>
          )}
        </div>

        {/* Actions Menu */}
        {showActions && showThreadActions && (
          <div className="absolute top-0 right-0 flex items-center gap-1 bg-white rounded shadow-md border border-gray-200 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              className="p-1.5 hover:bg-gray-100 rounded"
              title="Add reaction"
            >
              <Smile className="w-4 h-4 text-gray-600" />
            </button>
            <button
              className="p-1.5 hover:bg-gray-100 rounded"
              title="Reply"
            >
              <Reply className="w-4 h-4 text-gray-600" />
            </button>
            {isOwnMessage && (
              <button
                className="p-1.5 hover:bg-gray-100 rounded"
                title="More actions"
              >
                <MoreHorizontal className="w-4 h-4 text-gray-600" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default memo(ThreadMessageItemBase);
