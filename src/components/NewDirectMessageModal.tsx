'use client';

import { useState, useMemo, useEffect } from 'react';
import { TeamMember } from '../types';
import { Button } from '@/components/ui';

interface NewDirectMessageModalProps {
  isOpen: boolean;
  onClose: () => void;
  members: TeamMember[];
  currentUserId: string;
  onSelectMember: (memberId: string) => void;
}

export default function NewDirectMessageModal({
  isOpen,
  onClose,
  members,
  currentUserId,
  onSelectMember
}: NewDirectMessageModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<TeamMember[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // 搜索用户
  useEffect(() => {
    const searchUsers = async () => {
      if (!searchQuery.trim() || searchQuery.length < 2) {
        setSearchResults([]);
        return;
      }

      setIsSearching(true);
      try {
        const response = await fetch(`/api/users/search?q=${encodeURIComponent(searchQuery)}`, {
          credentials: 'include'
        });

        if (response.ok) {
          const data = await response.json();
          // 将API返回的User格式转换为TeamMember格式
          const formattedUsers: TeamMember[] = data.users.map((user: any) => ({
            id: user.id,
            name: user.realName || user.displayName,
            displayName: user.displayName,
            avatarUrl: user.avatarUrl || '',
            status: user.isOnline ? 'online' : 'offline',
            role: 'member',
            email: user.email
          }));
          setSearchResults(formattedUsers);
        }
      } catch (error) {
        console.error('Failed to search users:', error);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    };

    const debounceTimer = setTimeout(searchUsers, 300);
    return () => clearTimeout(debounceTimer);
  }, [searchQuery]);

  // 确定显示的成员列表
  const displayMembers = useMemo(() => {
    if (searchQuery.trim() && searchQuery.length >= 2) {
      return searchResults.filter(member => member.id !== currentUserId);
    }
    return members.filter(member => member.id !== currentUserId);
  }, [members, searchResults, searchQuery, currentUserId]);

  // 高亮匹配文本
  const highlightMatch = (text: string, query: string) => {
    if (!query.trim()) return text;

    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);

    return parts.map((part, index) =>
      regex.test(part) ? (
        <span key={index} className="bg-blue-100 text-blue-600 font-medium">
          {part}
        </span>
      ) : (
        <span key={index}>{part}</span>
      )
    );
  };

  const handleSelectMember = (memberId: string) => {
    onSelectMember(memberId);
    handleClose();
  };

  const handleClose = () => {
    setSearchQuery('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh]">
      {/* 背景遮罩 */}
      <div
        className="absolute inset-0 bg-black/20"
        onClick={handleClose}
      />

      {/* 模态框 - 严格参考 Slack，纯白背景无阴影 */}
      <div className="relative bg-white w-full max-w-lg mx-4 rounded-lg border border-gray-200">
        {/* Header */}
        <div className="px-4 py-3 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            New Direct Message
          </h2>
        </div>

        {/* Search Input */}
        <div className="px-4 py-3 border-b border-gray-200">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">
              To:
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm"
              placeholder="@somebody"
              autoFocus
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                  className="w-4 h-4"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Members List */}
        <div className="max-h-96 overflow-y-auto py-2">
          {isSearching ? (
            <div className="px-4 py-8 text-center text-sm text-gray-500">
              搜索中...
            </div>
          ) : displayMembers.length > 0 ? (
            <div className="space-y-0.5">
              {displayMembers.map((member: TeamMember) => (
                <div
                  key={member.id}
                  className="flex items-center px-4 py-2 hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => handleSelectMember(member.id)}
                >
                  {/* Avatar */}
                  <div className="relative flex-shrink-0">
                    <img
                      src={member.avatarUrl || '/default-avatar.png'}
                      alt={member.displayName}
                      className="w-8 h-8 rounded-sm"
                      style={{ borderRadius: '4px' }}
                    />
                    {/* Status indicator */}
                    <span
                      className={`absolute bottom-0 right-0 block w-2.5 h-2.5 rounded-full border-2 border-white ${
                        member.isOnline
                          ? 'bg-green-500'
                          : 'bg-gray-400'
                      }`}
                    />
                  </div>

                  {/* Member Info */}
                  <div className="ml-3 flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900">
                      {highlightMatch(member.displayName, searchQuery)}
                    </div>
                    <div className="text-xs text-gray-500 truncate">
                      {member.email}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="px-4 py-8 text-center text-sm text-gray-500">
              {searchQuery.trim() ? (
                <>
                  No results for <span className="font-medium">"{searchQuery}"</span>
                </>
              ) : (
                'No members available'
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-gray-200 flex justify-end">
          <Button
            variant="ghost"
            onClick={handleClose}
            className="text-sm"
          >
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
