'use client';

import React from 'react';
import { Message } from '@/types/message';
import MessageRenderer from './MessageRenderer';
import MessageActions from './MessageActions';
import MessageEditor from './MessageEditor';
import QuoteBlock from './QuoteBlock';
import ReactionBadges from './ReactionBadges';
import { useReactions } from '@/hooks/useReactions';

interface MessageItemProps {
  message: Message;
  currentUserId: string;
  isOwnMessage: boolean;
  showAvatar: boolean;
  isHighlighted: boolean;
  showReadIndicator?: string | null;
  editingMessageId: string | null;
  onStartEditing: (message: Message) => void;
  onSaveEdit: (messageId: string, content: string) => Promise<void>;
  onCancelEdit: () => void;
  onDeleteMessage: (messageId: string) => Promise<void>;
  onThreadReply: (message: Message) => void;
  onQuote: (message: Message) => void;
  formatMessageTime: (dateString: string | null | undefined) => string;
  messageRefs: React.MutableRefObject<{ [key: string]: HTMLDivElement | null }>;
  scrollContainerRef: React.RefObject<HTMLDivElement>;
}

/**
 * Memoized MessageItem component with custom comparison
 * Optimized to prevent unnecessary re-renders
 */
function MessageItemBase({
  message,
  currentUserId,
  isOwnMessage,
  showAvatar,
  isHighlighted,
  showReadIndicator,
  editingMessageId,
  onStartEditing,
  onSaveEdit,
  onCancelEdit,
  onDeleteMessage,
  onThreadReply,
  onQuote,
  formatMessageTime,
  messageRefs,
  scrollContainerRef
}: MessageItemProps) {
  // 在组件顶层调用 useReactions hook
  const { reactions, toggleReaction, pendingReactions } = useReactions(message.id, currentUserId);

  return (
    <div>
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
        className={`message-row w-full relative group transition-all duration-200 hover:bg-slate-800/50 hover:z-[50] ${
          isHighlighted ? 'bg-yellow-200/70 rounded-lg shadow-md animate-pulse' : ''
        }`}
      >
        {/* 🧠 智能对侧悬停工具栏 - 脱离内容容器，悬浮在行级别 */}
        <MessageActions
          message={message}
          currentUserId={currentUserId}
          isOwnMessage={isOwnMessage}
          onEdit={onStartEditing}
          onDelete={onDeleteMessage}
          onThreadReply={onThreadReply}
          onQuote={onQuote}
          containerRef={scrollContainerRef}
        />

        {/* 头像 + 消息内容容器 */}
        <div className={`flex w-full items-start gap-3 ${
          isOwnMessage ? 'flex-row-reverse' : ''
        }`}>
          {/* 头像 */}
          {showAvatar ? (
            <img
              src={message.user.avatarUrl || `https://api.dicebear.com/7.x/identicon/png?seed=${message.user.displayName || message.user.id}&size=40`}
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
                <span style={{ fontSize: '14px', color: 'var(--text-muted)' }}>
                  {formatMessageTime(message.createdAt)}
                </span>
                {/* Edited indicator */}
                {message.isEdited && !message.isDeleted && (
                  <span style={{ fontSize: '14px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                    (edited)
                  </span>
                )}
              </div>
            )}

            {/* Quote Block - 显示被引用的消息 */}
            {(message.quotedContent || message.quotedUserName) && !message.isDeleted && (
              <div className="mb-2">
                <QuoteBlock
                  content={message.quotedContent || ''}
                  userName={message.quotedUserName || 'Unknown'}
                  avatarUrl={message.quotedAvatarUrl}
                  createdAt={message.quotedAt || ''}
                  isDeleted={message.isQuotedDeleted}
                />
              </div>
            )}

            {/* 消息气泡 */}
            <div
              className={`relative inline-block max-w-[85%] px-4 py-2 rounded-lg ${
                isOwnMessage
                  ? 'bg-primary text-white'
                  : 'bg-background-component text-text-primary'
              } ${
                message.isDeleted ? 'opacity-50 italic' : ''
              }`}
            >
              {/* 消息内容 */}
              {editingMessageId === message.id ? (
                <MessageEditor
                  message={message}
                  onSave={onSaveEdit}
                  onCancel={onCancelEdit}
                  className="mt-1"
                />
              ) : message.isDeleted ? (
                <div className={`italic ${isOwnMessage ? 'text-white' : 'text-text-tertiary'}`}>
                  This message was deleted
                </div>
              ) : (
                <div className={isOwnMessage ? 'text-white' : 'text-text-primary'}>
                  <MessageRenderer
                    message={message}
                    currentUserId={currentUserId}
                  />
                </div>
              )}
            </div>

            {/* Reply indicator */}
            {message.parentMessageId && (
              <div className="mt-1 text-xs text-text-tertiary">
                Replied
              </div>
            )}

            {/* Reaction badges */}
            <ReactionBadges
              reactions={reactions}
              currentUserId={currentUserId}
              isOwnMessage={isOwnMessage}
              onToggleReaction={toggleReaction}
              pendingReactions={pendingReactions}
              className="mt-1"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Custom comparison function for React.memo
 * Only re-renders when props that affect the UI actually change
 */
const propsAreEqual = (
  prevProps: MessageItemProps,
  nextProps: MessageItemProps
): boolean => {
  // Deep comparison for message object (most important)
  const prevMessage = prevProps.message;
  const nextMessage = nextProps.message;

  // Check if message content has changed (shallow check for object identity)
  const messageChanged =
    prevMessage.id !== nextMessage.id ||
    prevMessage.content !== nextMessage.content ||
    prevMessage.isEdited !== nextMessage.isEdited ||
    prevMessage.isDeleted !== nextMessage.isDeleted ||
    prevMessage.updatedAt !== nextMessage.updatedAt ||
    prevMessage.user.id !== nextMessage.user.id ||
    prevMessage.user.displayName !== nextMessage.user.displayName ||
    prevMessage.user.avatarUrl !== nextMessage.user.avatarUrl;

  // Check primitive props
  const basicPropsChanged =
    prevProps.currentUserId !== nextProps.currentUserId ||
    prevProps.isOwnMessage !== nextProps.isOwnMessage ||
    prevProps.showAvatar !== nextProps.showAvatar ||
    prevProps.isHighlighted !== nextProps.isHighlighted ||
    prevProps.showReadIndicator !== nextProps.showReadIndicator ||
    prevProps.editingMessageId !== nextProps.editingMessageId;

  // Function props are typically memoized by parent components
  // We check reference equality for functions
  const functionsChanged =
    prevProps.onStartEditing !== nextProps.onStartEditing ||
    prevProps.onSaveEdit !== nextProps.onSaveEdit ||
    prevProps.onCancelEdit !== nextProps.onCancelEdit ||
    prevProps.onDeleteMessage !== nextProps.onDeleteMessage ||
    prevProps.onThreadReply !== nextProps.onThreadReply ||
    prevProps.formatMessageTime !== nextProps.formatMessageTime;

  // Refs are stable across renders, no need to compare

  // Only re-render if something actually changed
  const shouldRerender = messageChanged || basicPropsChanged || functionsChanged;

  // Debug logging in development
  if (process.env.NODE_ENV === 'development' && shouldRerender) {
    console.log('🔄 MessageItem re-rendering:', {
      messageId: nextMessage.id,
      messageChanged,
      basicPropsChanged,
      functionsChanged,
      prevMessageContent: prevMessage.content?.substring(0, 30),
      nextMessageContent: nextMessage.content?.substring(0, 30)
    });
  }

  return !shouldRerender;
};

// Export memoized component
export default React.memo(MessageItemBase, propsAreEqual);
