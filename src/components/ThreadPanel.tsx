'use client';

import React, { useEffect, useRef, useState } from 'react';
import { X, MessageSquare } from 'lucide-react';
import { Message } from '@/types/message';
import ThreadMessageItem from './ThreadMessageItem';
import DMMessageInput from './DMMessageInput';
import { useThreadReplies } from '@/hooks/useThreadReplies';

interface ThreadPanelProps {
  isOpen: boolean;
  onClose: () => void;
  threadMessage: Message | null;
  currentUserId: string;
}

export default function ThreadPanel({
  isOpen,
  onClose,
  threadMessage,
  currentUserId
}: ThreadPanelProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [panelWidth, setPanelWidth] = useState(384); // Default width 384px (w-96)
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, width: 0 });

  // Get thread replies
  const { replies, isLoading, error, hasMore, loadMore, refetch } = useThreadReplies(
    threadMessage?.id || null
  );

  // Drag handling
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX,
      width: panelWidth
    };
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging) return;

    // 左边缘拖动：向右拖动时面板变宽，向左拖动时面板变窄
    const deltaX = dragStartRef.current.x - e.clientX;
    const newWidth = Math.max(320, Math.min(600, dragStartRef.current.width + deltaX));
    setPanelWidth(newWidth);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Listen for mouse move events
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';

      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };
    }
  }, [isDragging]);

  // Auto scroll to bottom
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [replies, isOpen]);

  // ESC key to close panel
  useEffect(() => {
    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscKey);
    }

    return () => {
      document.removeEventListener('keydown', handleEscKey);
    };
  }, [isOpen, onClose]);

  if (!isOpen || !threadMessage) {
    return null;
  }

  return (
    <div
      className="fixed inset-y-0 right-0 bg-white shadow-lg z-[70] flex flex-col"
      style={{ width: `${panelWidth}px` }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* 左侧拖拽区域 */}
      <div
        className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-400 transition-colors"
        onMouseDown={handleMouseDown}
        style={{ cursor: isDragging ? 'col-resize' : 'col-resize' }}
      />

      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-gray-600" />
          <h2 className="text-lg font-semibold text-gray-900">Thread</h2>
        </div>
        <button
          onClick={onClose}
          className="p-1 hover:bg-gray-100 rounded-full transition-colors"
          aria-label="Close thread panel"
        >
          <X className="w-5 h-5 text-gray-600" />
        </button>
      </div>

      {/* Thread Root Message */}
      <div className="p-4 border-b border-gray-200 bg-gray-50">
        <ThreadMessageItem
          message={threadMessage}
          currentUserId={currentUserId}
          isOwnMessage={threadMessage.userId === currentUserId}
          isThreadRoot={true}
          showThreadActions={false}
        />
      </div>

      {/* Replies Section */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center p-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          </div>
        ) : error ? (
          <div className="p-4 text-center text-red-500">
            Failed to load thread replies: {error.message}
          </div>
        ) : replies.length > 0 ? (
          <div className="space-y-1">
            {replies.map((reply) => (
              <div key={reply.id} className="px-4 py-3 hover:bg-gray-50">
                <ThreadMessageItem
                  message={reply}
                  currentUserId={currentUserId}
                  isOwnMessage={reply.userId === currentUserId}
                  isThreadRoot={false}
                  showThreadActions={true}
                />
              </div>
            ))}
            {hasMore && (
              <div className="p-4 text-center">
                <button
                  onClick={loadMore}
                  className="text-blue-500 hover:text-blue-600 text-sm font-medium"
                >
                  Load more replies
                </button>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        ) : (
          <div className="p-8 text-center text-gray-500">
            No replies yet. Be the first to reply!
          </div>
        )}
      </div>

      {/* Reply Input */}
      <div className="border-t border-gray-200">
        <div className="pb-safe">
          <DMMessageInput
            compact={true}
            placeholder="Reply in thread..."
            channelId={threadMessage.channelId || undefined}
            dmConversationId={threadMessage.dmConversationId || undefined}
            members={[]}
            currentUserId={currentUserId}
            parentMessageId={threadMessage.id}
            onMessageSent={() => {
              // Refresh replies list after sending message
              refetch();
            }}
          />
        </div>
      </div>
    </div>
  );
}
