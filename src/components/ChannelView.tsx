'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Channel } from '../types/channel';
import { Message } from '@/types/message';
import { Button } from '@/components/ui';
import { TeamMember } from '@/types';
import MessageList, { MessageListRef } from './MessageList';
import DMMessageInput from './DMMessageInput';
import SearchMessagesModal from './SearchMessagesModal';
import { useWebSocketMessages } from '@/hooks/useWebSocketMessages';

interface ChannelViewProps {
  channel: Channel;
  isJoined: boolean;
  onJoinChannel: (channelId: string) => Promise<void>;
  onLeaveChannel: (channelId: string) => Promise<void>;
  onStartChat?: (memberId: string) => void;
  onShowMembers?: () => void;
  onClearMessages?: () => void;
}

export default function ChannelView({
  channel,
  isJoined,
  onJoinChannel,
  onLeaveChannel,
  onStartChat,
  onShowMembers,
  onClearMessages
}: ChannelViewProps) {
  const messageListRef = useRef<MessageListRef>(null);
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [showMembersList, setShowMembersList] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);

  // 用于跟踪是否在消息列表底部
  const isAtBottomRef = useRef(true);

  // 处理滚动位置变化
  const handleScrollPositionChange = (isAtBottom: boolean) => {
    isAtBottomRef.current = isAtBottom;
  };

  // WebSocket 消息监听
  const handleNewMessage = (newMessage: Message) => {

    // 立即尝试更新 UI
    setMessages(prev => {
      // 防止重复消息
      if (prev.some(msg => msg.id === newMessage.id)) {
        return prev;
      }

      const updated = [...prev, newMessage];

      // 自动滚动到底部（仅当用户已在底部时）
      if (isAtBottomRef.current) {
        setTimeout(() => {
          const messagesEndElement = document.querySelector('#messages-end-ref');
          if (messagesEndElement) {
            messagesEndElement.scrollIntoView({ behavior: 'smooth' });
          }
        }, 100);
      }

      return updated;
    });
  };

  // 监听 URL 中的 messageId 参数，实现深度联动
  useEffect(() => {
    if (!channel?.id || !messageListRef.current) return;

    const urlParams = new URLSearchParams(window.location.search);
    const messageId = urlParams.get('messageId');

    if (messageId) {
      messageListRef.current.highlightMessage(messageId);

      // 清除 URL 中的 messageId 参数，避免刷新时重复高亮
      const newUrl = window.location.pathname + window.location.search.replace(/[?&]messageId=[^&]*/, '');
      window.history.replaceState({}, '', newUrl);
    }
  }, [channel?.id]);

  // 获取频道成员
  useEffect(() => {
    if (!channel?.id) return;

    const fetchMembers = async () => {
      try {
        const response = await fetch(`/api/channels/${channel.id}/members`);
        if (response.ok) {
          const data = await response.json();
          setMembers(data.members || []);
        }
      } catch (error) {
        console.error('Error fetching channel members:', error);
      }
    };

    if (isJoined) {
      fetchMembers();
    }
  }, [channel?.id, isJoined]);

  const handleToggleMembership = async () => {
    if (!channel?.id) return;
    if (isJoined) {
      await onLeaveChannel(channel.id);
    } else {
      await onJoinChannel(channel.id);
    }
  };

  const handleClearMessages = async () => {
    if (!channel?.id) return;
    if (!window.confirm('Are you sure you want to clear all chat history? This action cannot be undone.')) {
      return;
    }

    try {
      setIsClearing(true);
      const response = await fetch('/api/messages/clear', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ channelId: channel.id })
      });

      if (response.ok) {
        setMessages([]);
        onClearMessages?.();
      } else {
        alert('Clear messages failed, please try again');
      }
    } catch (error) {
      console.error('Error clearing messages:', error);
      alert('Clear messages failed, please try again');
    } finally {
      setIsClearing(false);
      setIsDropdownOpen(false);
    }
  };

  // 获取频道消息
  const fetchMessages = async () => {
    if (!channel?.id || !isJoined) {
      setMessages([]);
      return;
    }

    try {
      setIsLoading(true);
      const response = await fetch(`/api/messages?channelId=${channel.id}`);

      if (!response.ok) {
        setMessages([]);
        setIsLoading(false);
        return;
      }

      const data = await response.json();
      setMessages(data.reverse());
      setIsLoading(false);
    } catch (err) {
      console.error('Error fetching messages:', err);
      setMessages([]);
      setIsLoading(false);
    }
  };

  // 当加入状态改变时获取消息
  useEffect(() => {
    if (!channel?.id) return;
    fetchMessages();
  }, [isJoined, channel?.id]);

  // 处理消息编辑
  const handleEditMessage = async (messageId: string, content: string) => {
    try {
      const response = await fetch(`/api/messages/${messageId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content }),
      });

      if (!response.ok) {
        throw new Error('Failed to edit message');
      }

      const updatedMessage = await response.json();

      // 乐观更新本地消息列表
      setMessages(prev => prev.map(msg =>
        msg.id === messageId ? updatedMessage : msg
      ));

      console.log('✅ Channel message edited successfully:', messageId);
    } catch (error) {
      console.error('❌ Failed to edit channel message:', error);
      throw error;
    }
  };

  // 处理消息删除
  const handleDeleteMessage = async (messageId: string) => {
    try {
      const response = await fetch(`/api/messages/${messageId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete message');
      }

      const result = await response.json();

      // 乐观更新本地消息列表（标记为已删除）
      setMessages(prev => prev.map(msg =>
        msg.id === messageId
          ? { ...msg, isDeleted: true, deletedAt: result.data.deletedAt }
          : msg
      ));

      console.log('✅ Channel message deleted successfully:', messageId);
    } catch (error) {
      console.error('❌ Failed to delete channel message:', error);
      throw error;
    }
  };

  // 处理消息更新（来自WebSocket）
  const handleMessageUpdated = (updatedMessage: Message) => {
    setMessages(prev => prev.map(msg =>
      msg.id === updatedMessage.id ? updatedMessage : msg
    ));
  };

  // 处理消息删除（来自WebSocket）
  const handleMessageDeleted = (deleteData: { id: string; channelId?: string; dmConversationId?: string; isDeleted: boolean; deletedAt?: string }) => {
    setMessages(prev => prev.map(msg =>
      msg.id === deleteData.id
        ? { ...msg, isDeleted: true, deletedAt: deleteData.deletedAt }
        : msg
    ));
  };

  // WebSocket 消息监听 - 修复版本：减少依赖变化
  useWebSocketMessages({
    channelId: channel?.id,
    currentUserId: user?.id || '',
    onNewMessage: useCallback((message: Message) => {
      handleNewMessage(message);
    }, [handleNewMessage]),
    onMessageUpdated: handleMessageUpdated,
    onMessageDeleted: handleMessageDeleted
  });

  const handleMessageSent = useCallback((message?: Message) => {
    // 如果收到了消息对象，进行乐观更新
    if (message) {
      setMessages(prev => {
        // 防止重复
        if (prev.some(msg => msg.id === message.id)) {
          return prev;
        }
        return [...prev, message];
      });
    }
  }, []);

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden">
      {/* 1. 顶部 Header - 固定 */}
      <div className="flex-shrink-0 bg-background-secondary border-b border-border">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-sm bg-[#1164A3] flex items-center justify-center flex-shrink-0">
              <span className="text-white font-semibold text-sm">
                #{channel?.name?.charAt(0).toUpperCase() || 'C'}
              </span>
            </div>
            <div>
              <h1 className="text-lg font-semibold text-text-primary">
                #{channel?.name || 'Channel'}
              </h1>
              <p className="text-sm text-text-secondary">
                {members.length} members
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* 搜索按钮 */}
            <button
              onClick={() => setIsSearchModalOpen(true)}
              className="p-2 hover:bg-background-tertiary rounded-md transition-colors"
              aria-label="Search messages"
              title="Search messages"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="w-5 h-5 text-text-secondary"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M21 21l-4.35-4.35m0 0A7.5 7.5 0 1010.5 18a7.5 7.5 0 006.15-3.35z"
                />
              </svg>
            </button>

            <div className="relative">
              <button
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="p-2 hover:bg-background-tertiary rounded-md transition-colors"
                aria-label="Channel settings"
                disabled={isClearing}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                  className="w-5 h-5 text-text-secondary"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 6.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 12.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 18.75a.75.75 0 110-1.5.75.75 0 010 1.5z"
                  />
                </svg>
              </button>

              {/* 下拉菜单 */}
              {isDropdownOpen && (
                <>
                  {/* 背景遮罩 */}
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setIsDropdownOpen(false)}
                  />

                  {/* 菜单内容 */}
                  <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-xl border border-gray-200 py-1 z-20">
                    <div className="px-4 py-2 border-b border-gray-100">
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                        Channel
                      </p>
                      <p className="text-sm text-gray-900 font-medium mt-1">
                        #{channel?.name || 'Channel'}
                      </p>
                    </div>

                    <button
                      onClick={() => {
                        setShowMembersList(true);
                        setIsDropdownOpen(false);
                        onShowMembers?.();
                      }}
                      className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={1.5}
                        stroke="currentColor"
                        className="w-5 h-5"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z"
                        />
                      </svg>
                      View Channel Members
                    </button>

                    <button
                      onClick={handleClearMessages}
                      disabled={isClearing}
                      className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2 disabled:opacity-50"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={1.5}
                        stroke="currentColor"
                        className="w-5 h-5"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
                        />
                      </svg>
                      {isClearing ? 'Clearing...' : 'Clear Chat History'}
                    </button>

                    <button
                      onClick={handleToggleMembership}
                      className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 transition-colors flex items-center gap-2"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={1.5}
                        stroke="currentColor"
                        className="w-5 h-5"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75"
                        />
                      </svg>
                      Leave Channel
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 2. 核心内容区：确保它占据所有剩余高度 */}
      <div className="flex-1 flex flex-col min-h-0">
        {isJoined ? (
          showMembersList ? (
            /* 成员列表视图 */
            <div className="flex-1 overflow-y-auto p-6">
              <div className="max-w-4xl mx-auto">
                {/* 返回按钮 */}
                <div className="flex items-center gap-2 mb-6">
                  <button
                    onClick={() => setShowMembersList(false)}
                    className="p-1 hover:bg-background-tertiary rounded transition-colors"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={2}
                      stroke="currentColor"
                      className="w-5 h-5 text-text-secondary"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M15.75 19.5L8.25 12l7.5-7.5"
                      />
                    </svg>
                  </button>
                  <h2 className="text-xl font-semibold text-text-primary">
                    #{channel?.name || 'Channel'} Members
                  </h2>
                </div>

                {/* 成员列表 */}
                <div className="bg-background-elevated rounded-lg p-6">
                  <div className="space-y-3">
                    {members.map((member) => (
                      <div
                        key={member.id}
                        className="flex items-center gap-3 p-2 hover:bg-background-component rounded-md transition-colors cursor-pointer"
                        onClick={() => onStartChat?.(member.id)}
                        title={`点击与 ${member.displayName} 私聊`}
                      >
                        {member.avatarUrl ? (
                          <img
                            src={member.avatarUrl}
                            alt={member.displayName}
                            className="w-10 h-10 rounded-sm"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-sm bg-gray-400 flex items-center justify-center text-sm text-white">
                            {member.displayName[0].toUpperCase()}
                          </div>
                        )}
                        <div className="flex-1">
                          <p className="text-sm font-medium text-text-primary">
                            {member.realName || member.displayName}
                          </p>
                          <p className="text-xs text-text-tertiary">
                            {member.displayName}
                          </p>
                        </div>
                        {member.isOnline && (
                          <span className="w-2 h-2 bg-green-500 rounded-full" />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* 消息列表：必须设置 flex-1 和 min-h-0 以强制占满空间并支持内部滚动 */}
              <div className="flex-1 min-h-0 relative">
                <MessageList
                  ref={messageListRef}
                  messages={messages}
                  currentUserId={user?.id || ''}
                  isLoading={isLoading}
                  className="h-full w-full"
                  channelId={channel?.id}
                  onScrollPositionChange={handleScrollPositionChange}
                  onEditMessage={handleEditMessage}
                  onDeleteMessage={handleDeleteMessage}
                />
              </div>

              {/* 3. 输入框：使用 flex-shrink-0 确保它被推到最底部，永不上移 */}
              <div className="flex-shrink-0 p-4 bg-background border-t">
                <DMMessageInput
                  placeholder={`Message #${channel?.name || ''}`}
                  disabled={false}
                  channelId={channel?.id}
                  currentUserId={user?.id || ''}
                  members={members}
                  onMessageSent={handleMessageSent}
                />
              </div>
            </>
          )
        ) : (
        /* 未加入频道时的提示 - 独立滚动 */
        <div className="flex-1 overflow-y-auto min-h-0 p-6">
          <div className="max-w-4xl mx-auto">
            {/* 频道介绍卡片 */}
            <div className="bg-background-elevated rounded-lg p-6 mb-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-2xl font-bold text-text-primary flex items-center gap-2 mb-2">
                    <span className="text-[#1164A3] text-3xl">#</span>
                    {channel?.name || 'Channel'}
                  </h2>
                  {channel?.description && (
                    <p className="text-text-secondary">{channel?.description}</p>
                  )}
                </div>
                <Button
                  variant="primary"
                  onClick={handleToggleMembership}
                >
                  Join Channel
                </Button>
              </div>

              {/* Channel statistics */}
              <div className="flex items-center gap-6 text-sm text-text-tertiary">
                <div className="flex items-center gap-2">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                    className="w-5 h-5"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z"
                    />
                  </svg>
                  <span>{members.length} members</span>
                </div>
                <div className="flex items-center gap-2">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                    className="w-5 h-5"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z"
                    />
                  </svg>
                  <span>Active now</span>
                </div>
              </div>
            </div>

            {/* 加入提示 */}
            <div className="bg-background-elevated rounded-lg p-8 text-center">
              <div className="w-16 h-16 bg-yellow-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg
                  className="w-8 h-8 text-yellow-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M16.5 10.5V6.75M4 19h8a2 2 0 002-2V7a2 2 0 00-2-2H4a2 2 0 00-2 2v10a2 2 0 002 2z"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-text-primary mb-2">
                Join to start chatting
              </h3>
              <p className="text-text-secondary mb-4">
                Join this channel to read and send messages
              </p>
              <Button
                variant="primary"
                onClick={() => channel?.id && onJoinChannel(channel.id)}
              >
                Join Channel
              </Button>
            </div>

            {/* 成员列表 */}
            <div className="mt-6 bg-background-elevated rounded-lg p-6">
              <h3 className="text-sm font-semibold text-text-primary mb-4 uppercase tracking-wide">
                Members ({members.length})
              </h3>
              <div className="space-y-3">
                {members.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center gap-3 p-2 hover:bg-background-component rounded-md transition-colors cursor-pointer"
                    onClick={() => onStartChat?.(member.id)}
                    title={`点击与 ${member.displayName} 私聊`}
                  >
                    {member.avatarUrl ? (
                      <img
                        src={member.avatarUrl}
                        alt={member.displayName}
                        className="w-8 h-8 rounded-sm"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-sm bg-gray-400 flex items-center justify-center text-sm text-white">
                        {member.displayName[0].toUpperCase()}
                      </div>
                    )}
                    <div className="flex-1">
                      <p className="text-sm font-medium text-text-primary">
                        {member.realName || member.displayName}
                      </p>
                      <p className="text-xs text-text-tertiary">
                        {member.displayName}
                      </p>
                    </div>
                    {member.isOnline && (
                      <span className="w-2 h-2 bg-green-500 rounded-full" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
        )}
      </div>

      {/* 搜索消息弹窗 */}
      <SearchMessagesModal
        isOpen={isSearchModalOpen}
        onClose={() => setIsSearchModalOpen(false)}
        channelId={channel?.id}
        contextName={`#${channel?.name || ''}`}
      />
    </div>
  );
}
