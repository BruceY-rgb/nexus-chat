'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui';

interface User {
  id: string;
  displayName: string;
  realName?: string;
  avatarUrl?: string;
  email?: string;
  isOnline?: boolean;
}

interface InviteMembersModalProps {
  isOpen: boolean;
  onClose: () => void;
  channelId: string;
  channelName: string;
  existingMemberIds: string[];
  onInviteSuccess?: (invitedUsers: User[]) => void;
}

export default function InviteMembersModal({
  isOpen,
  onClose,
  channelId,
  channelName,
  existingMemberIds = [],
  onInviteSuccess
}: InviteMembersModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<User[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isInviting, setIsInviting] = useState(false);
  const [error, setError] = useState('');

  // 搜索用户
  const searchUsers = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    setError('');

    try {
      const response = await fetch(`/api/users/search?q=${encodeURIComponent(query)}`);
      if (response.ok) {
        const data = await response.json();
        // 过滤掉已经是频道成员的用户
        const availableUsers = (data.users || []).filter(
          (user: User) => !existingMemberIds.includes(user.id)
        );
        setSearchResults(availableUsers);
      }
    } catch (err) {
      console.error('Error searching users:', err);
      setError('Failed to search users');
    } finally {
      setIsSearching(false);
    }
  }, [existingMemberIds]);

  // 防抖搜索
  useEffect(() => {
    const timer = setTimeout(() => {
      searchUsers(searchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, searchUsers]);

  // 选择/取消选择用户
  const toggleUserSelection = (user: User) => {
    setSelectedUsers(prev => {
      const isSelected = prev.some(u => u.id === user.id);
      if (isSelected) {
        return prev.filter(u => u.id !== user.id);
      } else {
        return [...prev, user];
      }
    });
  };

  // 邀请用户
  const handleInvite = async () => {
    if (selectedUsers.length === 0) return;

    setIsInviting(true);
    setError('');

    try {
      const response = await fetch(`/api/channels/${channelId}/invite`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          userIds: selectedUsers.map(u => u.id)
        })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to invite members');
      }

      const data = await response.json();
      onInviteSuccess?.(selectedUsers);
      handleClose();
    } catch (err: any) {
      setError(err.message || 'Failed to invite members');
    } finally {
      setIsInviting(false);
    }
  };

  // 关闭并重置
  const handleClose = () => {
    setSearchQuery('');
    setSearchResults([]);
    setSelectedUsers([]);
    setError('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* 背景遮罩 */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={handleClose}
      />

      {/* 模态框 */}
      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md mx-4 flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex-shrink-0">
          <h2 className="text-lg font-semibold text-gray-900">
            Invite members to #{channelName}
          </h2>
        </div>

        {/* Body */}
        <div className="px-6 py-4 flex-1 overflow-hidden flex flex-col">
          {/* 搜索框 */}
          <div className="mb-4">
            <div className="relative">
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-4.35-4.35m0 0A7.5 7.5 0 1010.5 18a7.5 7.5 0 006.15-3.35z"
                />
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name or email"
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm text-gray-900 placeholder:text-gray-400"
                autoFocus
              />
            </div>
          </div>

          {/* 搜索结果或已选用户列表 */}
          <div className="flex-1 overflow-y-auto min-h-0">
            {/* 已选用户 */}
            {selectedUsers.length > 0 && (
              <div className="mb-4">
                <p className="text-xs text-gray-500 mb-2">Selected:</p>
                <div className="flex flex-wrap gap-2">
                  {selectedUsers.map(user => (
                    <div
                      key={user.id}
                      className="flex items-center gap-1 bg-blue-100 text-blue-800 rounded-full px-3 py-1 text-sm"
                    >
                      <span>{user.displayName}</span>
                      <button
                        onClick={() => toggleUserSelection(user)}
                        className="hover:text-blue-600"
                      >
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path
                            fillRule="evenodd"
                            d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 搜索结果 */}
            {isSearching ? (
              <div className="text-center py-4 text-gray-500 text-sm">
                Searching...
              </div>
            ) : searchResults.length > 0 ? (
              <div className="space-y-1">
                <p className="text-xs text-gray-500 mb-2">Search results:</p>
                {searchResults.map(user => (
                  <div
                    key={user.id}
                    onClick={() => toggleUserSelection(user)}
                    className={`flex items-center gap-3 p-2 rounded-md cursor-pointer transition-colors ${
                      selectedUsers.some(u => u.id === user.id)
                        ? 'bg-blue-50'
                        : 'hover:bg-gray-100'
                    }`}
                  >
                    <div className="relative">
                      {user.avatarUrl ? (
                        <img
                          src={user.avatarUrl}
                          alt={user.displayName}
                          className="w-8 h-8 rounded-sm"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-sm bg-gray-400 flex items-center justify-center text-white text-sm">
                          {user.displayName[0].toUpperCase()}
                        </div>
                      )}
                      {user.isOnline && (
                        <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-white rounded-full" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {user.realName || user.displayName}
                      </p>
                      <p className="text-xs text-gray-500 truncate">
                        {user.email}
                      </p>
                    </div>
                    {selectedUsers.some(u => u.id === user.id) && (
                      <svg
                        className="w-5 h-5 text-blue-500 flex-shrink-0"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    )}
                  </div>
                ))}
              </div>
            ) : searchQuery ? (
              <div className="text-center py-4 text-gray-500 text-sm">
                No users found
              </div>
            ) : (
              <div className="text-center py-4 text-gray-500 text-sm">
                Search for users to invite
              </div>
            )}
          </div>

          {/* 错误提示 */}
          {error && (
            <div className="mt-3 p-2 bg-red-50 text-red-600 text-sm rounded">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-2 flex-shrink-0">
          <Button
            type="button"
            variant="ghost"
            onClick={handleClose}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={handleInvite}
            disabled={selectedUsers.length === 0 || isInviting}
            className={`${
              selectedUsers.length > 0 && !isInviting
                ? 'bg-[#2BAC76] hover:bg-[#239a63] text-white'
                : ''
            }`}
          >
            {isInviting ? 'Inviting...' : `Invite ${selectedUsers.length > 0 ? selectedUsers.length : ''}`}
          </Button>
        </div>
      </div>
    </div>
  );
}
