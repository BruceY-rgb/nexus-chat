'use client';

import { useState, useEffect } from 'react';
import { TeamMember } from '../types';
import { Badge } from './ui';
import { useUnreadStore } from '../store/unreadStore';

interface DirectMessagesProps {
  members?: TeamMember[];
  currentUserId?: string;
  selectedDirectMessageId?: string;
  onStartChat?: (memberId: string, dmConversationId?: string) => void;
  onNewChat?: () => void;
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
  const { getUnreadCount } = useUnreadStore();

  // 搜索团队成员
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

  // 显示搜索结果或所有成员
  const displayMembers = searchQuery.trim() ? searchResults : members;

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
        {displayMembers.map((member) => {
          const isSelected = selectedDirectMessageId === member.id;
          const isCurrentUser = member.id === currentUserId;
          // Use dmConversationId if available, otherwise use member.id as conversation identifier
          const conversationId = member.dmConversationId || member.id;
          const unreadCount = getUnreadCount(conversationId);
          const hasUnread = unreadCount > 0;

          return (
            <div
              key={member.id}
              className={`flex items-center px-3 py-1.5 mx-2 rounded cursor-pointer transition-colors group ${
                isSelected
                  ? 'bg-[#1164A3] text-white'
                  : 'hover:bg-white/10'
              }`}
              onClick={() => onStartChat?.(member.id, conversationId)}
            >
              {/* Avatar with status indicator */}
              <div className="relative flex-shrink-0">
                <img
                  src={member.avatarUrl || '/default-avatar.png'}
                  alt={member.displayName}
                  className="w-5 h-5 rounded-sm"
                  style={{ borderRadius: '4px' }}
                  onError={(e) => {
                    const img = e.target as HTMLImageElement;
                    if (img.src !== '/default-avatar.png') {
                      img.src = '/default-avatar.png';
                    }
                  }}
                />
                {getStatusIndicator(member.isOnline)}
              </div>

              {/* Display Name */}
              <span className={`ml-3 text-sm truncate transition-colors ${
                isSelected
                  ? 'text-white'
                  : hasUnread
                  ? 'text-white font-semibold'
                  : 'text-white/80 group-hover:text-white'
              }`}>
                {member.displayName}{isCurrentUser ? ' (you)' : ''}
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
      {displayMembers.length === 0 && !isSearching && !searchQuery && (
        <div className="px-3 py-2 text-white/50 text-sm">
          No team members available
        </div>
      )}

      {/* Search no results */}
      {displayMembers.length === 0 && searchQuery && !isSearching && (
        <div className="px-3 py-2 text-white/50 text-sm">
          No members found for "{searchQuery}"
        </div>
      )}

      {/* Loading state */}
      {isSearching && (
        <div className="px-3 py-2 text-white/50 text-sm">
          Searching...
        </div>
      )}
    </div>
  );
}
