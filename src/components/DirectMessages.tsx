'use client';

import { useState, useEffect, useCallback } from 'react';
import { TeamMember } from '../types';
import { Badge } from './ui';
import { useUnreadStore } from '../store/unreadStore';
import { useSocket } from '../hooks/useSocket';
import { useUnreadCount } from '../hooks/useUnreadCount';

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
    isStarred?: boolean;
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
  members = [], // Not used, but kept for interface compatibility
  currentUserId,
  selectedDirectMessageId,
  onStartChat,
  onNewChat // Not used, but kept for interface compatibility
}: DirectMessagesProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<TeamMember[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [activeConversations, setActiveConversations] = useState<ActiveDMConversation[]>([]);
  const [starredUsers, setStarredUsers] = useState<TeamMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { getUnreadCount } = useUnreadStore();
  const { socket } = useSocket();
  const { markAsRead } = useUnreadCount();

  // Load active DM conversations and starred users
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

    const loadStarredUsers = async () => {
      try {
        const response = await fetch('/api/users/starred', {
          credentials: 'include'
        });

        if (response.ok) {
          const data = await response.json();
          setStarredUsers(data.users || []);
        }
      } catch (error) {
        console.error('Error loading starred users:', error);
      }
    };

    loadActiveConversations();
    loadStarredUsers();

    // Listen for WebSocket events to update active conversation list in real-time
    const handleActiveConversationsUpdate = () => {
      // Refresh active conversation list
      loadActiveConversations();
    };

    // Listen for starred users update events
    const handleStarredUsersUpdate = () => {
      loadStarredUsers();
    };

    // Listen to events via socket
    if (socket) {
      socket.on('active-conversations-update', handleActiveConversationsUpdate);
    }

    // Listen for custom events
    window.addEventListener('starred-users-updated', handleStarredUsersUpdate);

    // Cleanup function
    return () => {
      if (socket) {
        socket.off('active-conversations-update', handleActiveConversationsUpdate);
      }
      window.removeEventListener('starred-users-updated', handleStarredUsersUpdate);
    };
  }, [socket]);

  // Handle starting a chat (adds conversation to list immediately)
  const handleStartChat = useCallback(async (userId: string, dmConversationId?: string) => {
    // === Step 1: Clear search query, switching to active conversation list ===
    if (searchQuery.trim()) {
      setSearchQuery('');
      console.log('🔍 [DEBUG] Clear search query, switching to active conversation list');
    }

    // If dmConversationId already exists, use it directly
    if (dmConversationId) {
      // When clicking to enter conversation, automatically clear unread count
      try {
        await markAsRead(undefined, dmConversationId);
      } catch (error) {
        console.error('Failed to mark as read:', error);
      }
      onStartChat?.(userId, dmConversationId);
      return;
    }

    // Otherwise, create or get conversation
    try {
      const response = await fetch('/api/conversations/dm', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ userId })
      });

      if (response.ok) {
        const conversation = await response.json();
        const otherMember = conversation.members.find((m: any) => m.userId !== currentUserId);

        // Ensure otherMember exists
        if (!otherMember?.user?.id) {
          throw new Error('Failed to find other user');
        }

        const newConversation: ActiveDMConversation = {
          conversationId: conversation.id,
          lastMessageAt: '',
          createdAt: conversation.createdAt,
          otherUser: {
            id: otherMember.user.id,
            email: otherMember.user.email,
            displayName: otherMember.user.displayName,
            realName: otherMember.user.realName,
            avatarUrl: otherMember.user.avatarUrl,
            isOnline: otherMember.user.isOnline,
            lastSeenAt: otherMember.user.lastSeenAt
          },
          unreadCount: 0,
          lastReadAt: undefined,
          lastMessage: undefined,
          messageCount: 0
        };

        // Optimistic update: add new conversation to top of list
        setActiveConversations(prev => {
          // Check if already exists
          if (prev.some(conv => conv.conversationId === conversation.id)) {
            return prev;
          }
          return [newConversation, ...prev];
        });

        // Notify WebSocket to update
        if (socket) {
          socket.emit('active-conversations-update', { dmConversationId: conversation.id });
        }

        onStartChat?.(userId, conversation.id);
      } else {
        // Even if it fails, call the original callback
        onStartChat?.(userId);
      }
    } catch (error) {
      console.error('Error starting chat:', error);
      onStartChat?.(userId);
    }
  }, [socket, onStartChat, currentUserId, searchQuery]);

  // Search team members (searches all users, not just active ones)
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

  // Show search results or active conversations
  const displayConversations = searchQuery.trim() ? searchResults.map(user => ({
    conversationId: user.dmConversationId || '', // Search results don't have conversationId, leave empty for handleStartChat to create
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
  })) : activeConversations.filter(conv =>
    // Filter out users already in starred list to avoid duplicate display
    !starredUsers.some(starredUser => starredUser.id === conv.otherUser.id)
  );

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
          placeholder="Search members..."
          className="w-full px-3 py-1.5 bg-white/10 text-white text-sm rounded border-none outline-none placeholder-white/50"
          autoFocus
        />
      </div>

      {/* 星标用户分组 - 只在非搜索模式下显示 */}
      {!searchQuery && starredUsers.length > 0 && (
        <div className="mb-2">
          <div className="px-3 py-1.5">
            <h4 className="text-white/60 text-xs font-medium tracking-wide uppercase">
              STARRED
            </h4>
          </div>
          <div className="space-y-0.5">
            {starredUsers.map((user) => {
              const isSelected = selectedDirectMessageId === user.id;
              const conversationId = user.dmConversationId || user.id;
              const realUnreadCount = getUnreadCount(conversationId);
              const hasUnread = realUnreadCount > 0;

              // Defensive check: only show unread badge when unread count > 0 and last message was not sent by current user
              // Note: Starred list has no lastMessage info, but getUnreadCount already excludes the sender
              const shouldShowUnreadBadge = hasUnread;

              return (
                <div
                  key={conversationId}
                  className={`flex items-center px-3 py-1.5 mx-2 rounded cursor-pointer transition-colors group ${
                    isSelected
                      ? 'bg-[#1164A3] text-white'
                      : 'hover:bg-white/10'
                  }`}
                  onClick={() => handleStartChat(user.id, conversationId)}
                >
                  {/* Avatar with status indicator */}
                  <div className="relative flex-shrink-0">
                    <img
                      src={user.avatarUrl || `https://api.dicebear.com/7.x/identicon/png?seed=${user.displayName || user.id}&size=24`}
                      alt={user.displayName}
                      className="w-5 h-5 rounded-sm"
                      style={{ borderRadius: '4px' }}
                      onError={(e) => {
                        const img = e.target as HTMLImageElement;
                        if (!img.src.includes('api.dicebear.com')) {
                          img.src = `https://api.dicebear.com/7.x/identicon/png?seed=${user.displayName || user.id}&size=24`;
                        }
                      }}
                    />
                    {getStatusIndicator(user.isOnline)}
                  </div>

                  {/* Display Name with Star Icon */}
                  <span className={`ml-3 text-sm truncate transition-colors ${
                    isSelected
                      ? 'text-white'
                      : 'text-white/80 group-hover:text-white'
                  }`}>
                    {user.displayName}
                  </span>

                  {/* Yellow Star Icon */}
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="#FFD700"
                    viewBox="0 0 24 24"
                    className="w-4 h-4 ml-2 flex-shrink-0"
                  >
                    <path d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.659.446 1.004l-1.348 1.867a.562.562 0 00-.146.353l-.36 3.178a.563.563 0 01-.611.43l-2.612-.642a.563.563 0 00-.465.316l-1.82 2.165a.562.562 0 01-.857-.348l.109-3.181a.563.563 0 00-.19-.458l-1.867-1.348a.563.563 0 00-.353-.146l-3.178-.36a.563.563 0 01-.43-.611l.642-2.612a.563.563 0 00-.316-.465l-2.165-1.82a.562.562 0 01.348-.857l3.181.109a.563.563 0 00.458-.19l1.348-1.867z" />
                  </svg>

                  {/* Unread Count Badge */}
                  {shouldShowUnreadBadge && (
                    <Badge
                      count={realUnreadCount}
                      size="sm"
                      className="ml-auto"
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 所有用户分组 */}
      <div>
        <div className="px-3 py-1.5">
          <h4 className="text-white/60 text-xs font-medium tracking-wide uppercase">
            {searchQuery ? 'Search Results' : 'DIRECT MESSAGES'}
          </h4>
        </div>
        <div className="space-y-0.5">
          {displayConversations.map((conversation) => {
            const otherUser = conversation.otherUser;
            const isSelected = selectedDirectMessageId === otherUser.id;
            const isCurrentUser = otherUser.id === currentUserId;
            const conversationId = conversation.conversationId;
            const unreadCount = conversation.unreadCount || getUnreadCount(conversationId);
            const hasUnread = unreadCount > 0;

            // Defensive check: only show unread badge when unread count > 0 and last message was not sent by current user
            // This ensures user-sent messages don't trigger their own notification badge
            const shouldShowUnreadBadge = hasUnread && (!conversation.lastMessage || conversation.lastMessage.user.id !== currentUserId);

            return (
              <div
                key={conversationId}
                className={`flex items-center px-3 py-1.5 mx-2 rounded cursor-pointer transition-colors group ${
                  isSelected
                    ? 'bg-[#1164A3] text-white'
                    : 'hover:bg-white/10'
                }`}
                onClick={() => handleStartChat(otherUser.id, conversationId)}
              >
                {/* Avatar with status indicator */}
                <div className="relative flex-shrink-0">
                  <img
                    src={otherUser.avatarUrl || `https://api.dicebear.com/7.x/identicon/png?seed=${otherUser.displayName || otherUser.id}&size=24`}
                    alt={otherUser.displayName}
                    className="w-5 h-5 rounded-sm"
                    style={{ borderRadius: '4px' }}
                    onError={(e) => {
                      const img = e.target as HTMLImageElement;
                      if (!img.src.includes('api.dicebear.com')) {
                        img.src = `https://api.dicebear.com/7.x/identicon/png?seed=${otherUser.displayName || otherUser.id}&size=24`;
                      }
                    }}
                  />
                  {getStatusIndicator(otherUser.isOnline)}
                </div>

                {/* Display Name */}
                <span className={`ml-3 text-sm truncate transition-colors ${
                  isSelected
                    ? 'text-white'
                    : shouldShowUnreadBadge
                    ? 'text-white font-semibold'
                    : 'text-white/80 group-hover:text-white'
                }`}>
                  {otherUser.displayName}{isCurrentUser ? ' (you)' : ''}
                </span>

                {/* Unread Count Badge */}
                {shouldShowUnreadBadge && (
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
      </div>

      {/* Empty state */}
      {displayConversations.length === 0 && !isSearching && !searchQuery && !isLoading && (
        <div className="px-3 py-2 text-white/50 text-sm">
          No direct messages yet. 
        </div>
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="px-3 py-2 text-white/50 text-sm">
          Loading...
        </div>
      )}

      {/* Search no results */}
      {displayConversations.length === 0 && searchQuery && !isSearching && (
        <div className="px-3 py-2 text-white/50 text-sm">
          User "{searchQuery}" not found
        </div>
      )}

      {/* Searching state */}
      {isSearching && (
        <div className="px-3 py-2 text-white/50 text-sm">
          Searching...
        </div>
      )}
    </div>
  );
}
