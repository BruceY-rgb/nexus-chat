'use client';

import { useState, useRef, useEffect } from 'react';
import { Search, X, Check } from 'lucide-react';

interface User {
  id: string;
  displayName: string;
  avatarUrl?: string;
}

interface UserSelectProps {
  users: User[];
  selectedUserId: string | null;
  onSelect: (userId: string | null) => void;
  placeholder?: string;
}

export default function UserSelect({
  users,
  selectedUserId,
  onSelect,
  placeholder = 'Select user...'
}: UserSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchText, setSearchText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // 获取选中的用户
  const selectedUser = users.find(u => u.id === selectedUserId);

  // 过滤用户列表
  const filteredUsers = users.filter(user =>
    user.displayName.toLowerCase().includes(searchText.toLowerCase())
  );

  // 点击外部关闭下拉框
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchText('');
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // 打开时聚焦输入框
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const handleSelect = (userId: string) => {
    onSelect(userId === selectedUserId ? null : userId);
    setIsOpen(false);
    setSearchText('');
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect(null);
    setIsOpen(false);
    setSearchText('');
  };

  return (
    <div ref={containerRef} className="relative">
      {/* 选择按钮 */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white hover:border-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
      >
        {selectedUser ? (
          <div className="flex items-center gap-2">
            {selectedUser.avatarUrl ? (
              <img
                src={selectedUser.avatarUrl}
                alt={selectedUser.displayName}
                className="w-5 h-5 rounded-sm"
              />
            ) : (
              <div className="w-5 h-5 rounded-sm bg-gray-300 flex items-center justify-center text-white text-xs">
                {selectedUser.displayName[0].toUpperCase()}
              </div>
            )}
            <span className="text-gray-900">{selectedUser.displayName}</span>
          </div>
        ) : (
          <span className="text-gray-500">{placeholder}</span>
        )}
        {selectedUser ? (
          <X
            size={14}
            className="text-gray-400 hover:text-gray-600"
            onClick={handleClear}
          />
        ) : (
          <Search size={14} className="text-gray-400" />
        )}
      </button>

      {/* 下拉框 */}
      {isOpen && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-hidden">
          {/* 搜索输入框 */}
          <div className="p-2 border-b border-gray-100">
            <div className="relative">
              <Search
                size={14}
                className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400"
              />
              <input
                ref={inputRef}
                type="text"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="Search..."
                className="w-full pl-7 pr-3 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 text-gray-900"
              />
            </div>
          </div>

          {/* 用户列表 */}
          <div className="max-h-44 overflow-y-auto">
            {filteredUsers.length > 0 ? (
              filteredUsers.map(user => (
                <button
                  key={user.id}
                  type="button"
                  onClick={() => handleSelect(user.id)}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-gray-50 ${
                    user.id === selectedUserId ? 'bg-blue-50' : ''
                  }`}
                >
                  {user.avatarUrl ? (
                    <img
                      src={user.avatarUrl}
                      alt={user.displayName}
                      className="w-5 h-5 rounded-sm"
                    />
                  ) : (
                    <div className="w-5 h-5 rounded-sm bg-gray-300 flex items-center justify-center text-white text-xs">
                      {user.displayName[0].toUpperCase()}
                    </div>
                  )}
                  <span className="flex-1 text-gray-900">{user.displayName}</span>
                  {user.id === selectedUserId && (
                    <Check size={14} className="text-blue-500" />
                  )}
                </button>
              ))
            ) : (
              <div className="px-3 py-4 text-sm text-gray-500 text-center">
                No users found
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
