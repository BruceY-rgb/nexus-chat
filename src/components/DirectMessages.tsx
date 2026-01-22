'use client';

import { useState, useEffect } from 'react';
import { TeamMember } from '../types';
import { Badge } from './ui';
import { useUnreadStore } from '../store/unreadStore';
import { useSocket } from '@/hooks/useSocket';

interface DirectMessagesProps {
  members?: TeamMember[];
  currentUserId?: string;
  selectedDirectMessageId?: string;
  onStartChat?: (memberId: string, dmConversationId?: string) => void;
  onNewChat?: () => void;
}

interface ActiveDMConversation {
  conversationId: string;
  lastMessageAt: string;
  createdAt: string;
  otherUser: {
    id: string;
    email: string;
    displayName: string;
    realName?: string;
    avatarUrl?: string;
    isOnline: boolean;
    lastSeenAt?: string;
  };
  unreadCount: number;
  lastReadAt?: string;
  lastMessage?: {
    id: string;
    content: string;
    createdAt: string;
    user: {
      id: string;
      displayName: string;
      avatarUrl?: string;
    };
  };
  messageCount: number;
}

export default function DirectMessages({
  members = [],
  currentUserId,
  selectedDirectMessageId,
  onStartChat,
  onNewChat
}: DirectMessagesProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<TeamMember[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [activeConversations, setActiveConversations] = useState<ActiveDMConversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { getUnreadCount } = useUnreadStore();
  const { socket } = useSocket();

  // 加载活跃的DM会话
  useEffect(() => {
    const loadActiveConversations = async () => {
      setIsLoading(true);
      try {
        const response = await fetch('/api/conversations/dm/active', {
          credentials: 'include'
        });

        if (response.ok) {
          const data = await response.json();
          setActiveConversations(data.conversations || []);
        }
      } catch (error) {
        console.error('Error loading active conversations:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadActiveConversations();

    // 监听WebSocket事件以实时更新活跃对话列表
    const handleActiveConversationsUpdate = () => {
      // 刷新活跃对话列表
      loadActiveConversations();
    };

    // 通过socket监听事件
    if (socket) {
      socket.on('active-conversations-update', handleActiveConversationsUpdate);
    }

    // 清理函数
    return () => {
      if (socket) {
        socket.off('active-conversations-update', handleActiveConversationsUpdate);
      }
    };
  }, [socket]);

  // 搜索团队成员（搜索所有用户，不仅仅是活跃的）
  useEffect(() => {
    const searchMembers = async () => {
      if (!searchQuery.trim()) {
        setSearchResults([]);
        setIsSearching(false);
        return;
      }

      setIsSearching(true);
      try {
        const response = await fetch(`/api/users?search=${encodeURIComponent(searchQuery)}`, {
          credentials: 'include'
        });

        if (response.ok) {
          const data = await response.json();
          setSearchResults(data.users || []);
        }
      } catch (error) {
        console.error('Error searching members:', error);
      } finally {
        setIsSearching(false);
      }
    };

    const timeoutId = setTimeout(searchMembers, 300);
    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  // 显示搜索结果或活跃对话
  const displayConversations = searchQuery.trim() ? searchResults.map(user => ({
    conversationId: user.dmConversationId || user.id,
    lastMessageAt: '',
    createdAt: '',
    otherUser: {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      realName: user.realName,
      avatarUrl: user.avatarUrl,
      isOnline: user.isOnline,
      lastSeenAt: user.lastSeenAt
    },
    unreadCount: user.unreadCount || 0,
    lastReadAt: user.lastReadAt,
    lastMessage: null,
    messageCount: 0
  })) : activeConversations;

  const getStatusIndicator = (isOnline: boolean) => {
    if (isOnline) {
      return (
        <span className="absolute bottom-0 right-0 block h-2 w-2 rounded-full bg-green-500" />
      );
    }
    return (
      <span className="absolute bottom-0 right-0 block h-2 w-2 rounded-full border border-gray-400 bg-transparent" />
    );
  };

  return (
    <div className="mb-4">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 hover:bg-white/10 cursor-pointer" onClick={() => setSearchQuery('')}>
        <h3 className="text-white/80 text-sm font-medium tracking-wide uppercase">
          DIRECT MESSAGES
        </h3>
        <button
          className="text-white/60 hover:text-white transition-colors"
          aria-label="Search members"
          title="Search members"
          onClick={(e) => {
            e.stopPropagation();
            setSearchQuery('');
          }}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2.5}
            stroke="currentColor"
            className="w-5 h-5"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 21l-4.35-4.35m0 0A7.5 7.5 0 1010.5 18a7.5 7.5 0 006.15-3.35z"
            />
          </svg>
        </button>
      </div>

      {/* 搜索框 */}
      <div className="px-3 py-2">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="搜索团队成员..."
          className="w-full px-3 py-1.5 bg-white/10 text-white text-sm rounded border-none outline-none placeholder-white/50"
          autoFocus
        />
      </div>

      {/* Members List */}
      <div className="space-y-0.5">
        {displayConversations.map((conversation) => {
          const otherUser = conversation.otherUser;
          const isSelected = selectedDirectMessageId === otherUser.id;
          const isCurrentUser = otherUser.id === currentUserId;
          const conversationId = conversation.conversationId;
          const unreadCount = conversation.unreadCount || getUnreadCount(conversationId);
          const hasUnread = unreadCount > 0;

          return (
            <div
              key={conversationId}
              className={`flex items-center px-3 py-1.5 mx-2 rounded cursor-pointer transition-colors group ${
                isSelected
                  ? 'bg-[#1164A3] text-white'
                  : 'hover:bg-white/10'
              }`}
              onClick={() => onStartChat?.(otherUser.id, conversationId)}
            >
              {/* Avatar with status indicator */}
              <div className="relative flex-shrink-0">
                <img
                  src={otherUser.avatarUrl || '/default-avatar.png'}
                  alt={otherUser.displayName}
                  className="w-5 h-5 rounded-sm"
                  style={{ borderRadius: '4px' }}
                  onError={(e) => {
                    const img = e.target as HTMLImageElement;
                    if (img.src !== '/default-avatar.png') {
                      img.src = '/default-avatar.png';
                    }
                  }}
                />
                {getStatusIndicator(otherUser.isOnline)}
              </div>

              {/* Display Name */}
              <span className={`ml-3 text-sm truncate transition-colors ${
                isSelected
                  ? 'text-white'
                  : hasUnread
                  ? 'text-white font-semibold'
                  : 'text-white/80 group-hover:text-white'
              }`}>
                {otherUser.displayName}{isCurrentUser ? ' (you)' : ''}
              </span>

              {/* Unread Count Badge */}
              {hasUnread && (
                <Badge
                  count={unreadCount}
                  size="sm"
                  className="ml-auto"
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Empty state */}
      {displayConversations.length === 0 && !isSearching && !searchQuery && !isLoading && (
        <div className="px-3 py-2 text-white/50 text-sm">
          暂无私聊
        </div>
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="px-3 py-2 text-white/50 text-sm">
          加载中...
        </div>
      )}

      {/* Search no results */}
      {displayConversations.length === 0 && searchQuery && !isSearching && (
        <div className="px-3 py-2 text-white/50 text-sm">
          未找到用户 "{searchQuery}"
        </div>
      )}

      {/* Searching state */}
      {isSearching && (
        <div className="px-3 py-2 text-white/50 text-sm">
          搜索中...
        </div>
      )}
    </div>
  );
}
