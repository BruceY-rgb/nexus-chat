'use client';

import { useState } from 'react';
import { TeamMember } from '../types';
import SearchMessagesModal from './SearchMessagesModal';

interface DMHeaderProps {
  member: TeamMember;
  currentUserId: string;
  onBack?: () => void;
}

export default function DMHeader({
  member,
  currentUserId
}: DMHeaderProps) {
  const isOwnSpace = member.id === currentUserId;
  const displayName = isOwnSpace ? 'My Space' : member.displayName;
  const subtitle = isOwnSpace
    ? 'Direct message'
    : `${member.displayName} • ${member.email}`;

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isStarred, setIsStarred] = useState(member.isStarred || false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);

  // 切换星标状态
  const handleToggleStar = async () => {
    if (isLoading) return;

    setIsLoading(true);
    try {
      const response = await fetch('/api/users/starred', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ starredUserId: member.id })
      });

      if (response.ok) {
        const data = await response.json();
        setIsStarred(data.isStarred);
        setIsSettingsOpen(false);

        // 触发自定义事件，通知 DirectMessages 组件刷新
        window.dispatchEvent(new CustomEvent('starred-users-updated'));
      }
    } catch (error) {
      console.error('Error toggling star:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // 清空聊天记录
  const handleClearMessages = async () => {
    if (!window.confirm('确定要清空所有聊天记录吗？此操作不可撤销。')) {
      return;
    }

    try {
      setIsLoading(true);
      const response = await fetch('/api/messages/clear', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ dmConversationId: member.dmConversationId })
      });

      if (response.ok) {
        alert('聊天记录已清空');
        setIsSettingsOpen(false);
        // 刷新页面或触发消息列表刷新
        window.location.reload();
      } else {
        alert('清空消息失败，请重试');
      }
    } catch (error) {
      console.error('清空消息错误:', error);
      alert('清空消息失败，请重试');
    } finally {
      setIsLoading(false);
    }
  };

  // 搜索聊天记录
  const handleSearchMessages = () => {
    setIsSearchModalOpen(true);
    setIsSettingsOpen(false);
  };

  return (
    <div className="flex-shrink-0 bg-background-secondary border-b border-border">
      {/* 主标题栏 */}
      <div className="flex items-center justify-between px-4 py-3">
        {/* 左侧 - 头像和名称 */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <img
              src={member.avatarUrl || '/default-avatar.png'}
              alt={displayName}
              className="w-9 h-9 rounded-sm"
              style={{ borderRadius: '4px' }}
              onError={(e) => {
                const img = e.target as HTMLImageElement;
                if (img.src !== '/default-avatar.png') {
                  img.src = '/default-avatar.png';
                }
              }}
            />
            {/* 在线状态指示器 */}
            {!isOwnSpace && (
              <span
                className={`absolute bottom-0 right-0 block h-2.5 w-2.5 rounded-full border-2 border-white ${
                  member.isOnline
                    ? 'bg-status-success'
                    : 'bg-text-muted'
                }`}
              />
            )}
          </div>
          <div>
            <h1 className="text-lg font-semibold text-text-primary">
              {displayName}
            </h1>
            <p className="text-sm text-text-secondary">
              {subtitle}
            </p>
          </div>
        </div>

        {/* 右侧 - 搜索和设置按钮 */}
        <div className="flex items-center gap-2">
          {/* 搜索按钮 */}
          <button
            onClick={() => setIsSearchModalOpen(true)}
            className="p-2 hover:bg-background-tertiary rounded-full transition-colors"
            title="搜索消息"
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
              onClick={() => setIsSettingsOpen(!isSettingsOpen)}
              className="p-2 hover:bg-background-tertiary rounded-full transition-colors"
              title="Settings"
              disabled={isLoading}
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
                  d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
            </button>

            {/* 设置下拉菜单 */}
            {isSettingsOpen && (
              <>
                {/* 背景遮罩 */}
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setIsSettingsOpen(false)}
                />
                {/* 菜单内容 */}
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-xl border border-gray-200 py-1 z-20">
                  <div className="px-4 py-2 border-b border-gray-100">
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                      Direct Message
                    </p>
                    <p className="text-sm text-gray-900 font-medium mt-1">
                      {displayName}
                    </p>
                  </div>

                  <button
                    onClick={handleToggleStar}
                    disabled={isLoading}
                    className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2 disabled:opacity-50"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={1.5}
                      stroke="currentColor"
                      className={`w-5 h-5 ${isStarred ? 'text-yellow-500' : ''}`}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.659.446 1.004l-1.348 1.867a.562.562 0 00-.146.353l-.36 3.178a.563.563 0 01-.611.43l-2.612-.642a.563.563 0 00-.465.316l-1.82 2.165a.562.562 0 01-.857-.348l.109-3.181a.563.563 0 00-.19-.458l-1.867-1.348a.563.563 0 00-.353-.146l-3.178-.36a.563.563 0 01-.43-.611l.642-2.612a.563.563 0 00-.316-.465l-2.165-1.82a.562.562 0 01.348-.857l3.181.109a.563.563 0 00.458-.19l1.348-1.867z"
                      />
                    </svg>
                    {isStarred ? '取消标星' : '标星'}
                  </button>

                  <button
                    onClick={handleSearchMessages}
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
                        d="M21 21l-4.35-4.35m0 0A7.5 7.5 0 1010.5 18a7.5 7.5 0 006.15-3.35z"
                      />
                    </svg>
                    搜索聊天记录
                  </button>

                  <button
                    onClick={handleClearMessages}
                    disabled={isLoading}
                    className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 transition-colors flex items-center gap-2 disabled:opacity-50"
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
                    清空聊天记录
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* 搜索消息弹窗 */}
      <SearchMessagesModal
        isOpen={isSearchModalOpen}
        onClose={() => setIsSearchModalOpen(false)}
        dmConversationId={member.dmConversationId}
        contextName={isOwnSpace ? 'My Space' : member.displayName}
      />
    </div>
  );
}
