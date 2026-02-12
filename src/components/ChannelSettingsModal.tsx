'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui';
import { Channel } from '@/types/channel';
import { TeamMember } from '@/types';
import InviteMembersModal from './InviteMembersModal';
import { NotificationLevel } from '@/hooks/useNotificationPreferences';

type TabType = 'settings' | 'members' | 'notifications';

interface ChannelSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  channel: Channel;
  currentUserId: string;
  currentUserRole?: string;
  members: TeamMember[];
  onUpdateChannel?: (updatedChannel: Partial<Channel>) => void;
  onRemoveMember?: (userId: string) => void;
  onRefreshMembers?: () => void;
  onStartChat?: (memberId: string) => void;
}

export default function ChannelSettingsModal({
  isOpen,
  onClose,
  channel,
  currentUserId,
  currentUserRole = 'member',
  members = [],
  onUpdateChannel,
  onRemoveMember,
  onRefreshMembers,
  onStartChat
}: ChannelSettingsModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>('settings');
  const [name, setName] = useState(channel.name);
  const [description, setDescription] = useState(channel.description || '');
  const [isPrivate, setIsPrivate] = useState(channel.isPrivate);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [removingUserId, setRemovingUserId] = useState<string | null>(null);
  const [notificationLevel, setNotificationLevel] = useState<NotificationLevel>('all');
  const [isLoadingNotification, setIsLoadingNotification] = useState(false);

  // 判断当前用户是否是owner或admin
  const isOwnerOrAdmin = currentUserRole === 'owner' || currentUserRole === 'admin';

  // 当channel变化时更新本地状态
  useEffect(() => {
    if (channel) {
      setName(channel.name);
      setDescription(channel.description || '');
      setIsPrivate(channel.isPrivate);
    }
  }, [channel]);

  // 加载通知偏好设置
  useEffect(() => {
    if (isOpen && activeTab === 'notifications') {
      const fetchNotificationPreferences = async () => {
        try {
          const response = await fetch(`/api/channels/${channel.id}/notification-preferences`, {
            credentials: 'include'
          });
          if (response.ok) {
            const data = await response.json();
            setNotificationLevel(data.notificationLevel || 'all');
          }
        } catch (error) {
          console.error('Failed to load notification preferences:', error);
        }
      };
      fetchNotificationPreferences();
    }
  }, [isOpen, activeTab, channel.id]);

  // 保存通知偏好
  const handleSaveNotificationPreferences = async (level: NotificationLevel) => {
    setIsLoadingNotification(true);
    try {
      const response = await fetch(`/api/channels/${channel.id}/notification-preferences`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ notificationLevel: level })
      });

      const data = await response.json();
      console.log('Notification preferences response:', response.status, data);

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update notification preferences');
      }

      setNotificationLevel(level);
    } catch (error) {
      console.error('Failed to save notification preferences:', error);
      alert(error instanceof Error ? error.message : 'Failed to save notification preferences');
    } finally {
      setIsLoadingNotification(false);
    }
  };

  // 保存频道设置
  const handleSave = async () => {
    if (!name.trim()) {
      setError('Channel name cannot be empty');
      return;
    }

    setIsSaving(true);
    setError('');

    try {
      const response = await fetch(`/api/channels/${channel.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
          isPrivate
        })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update channel');
      }

      const data = await response.json();
      onUpdateChannel?.(data.channel);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to update channel');
    } finally {
      setIsSaving(false);
    }
  };

  // 移除成员
  const handleRemoveMember = async (userId: string) => {
    if (!window.confirm('Are you sure you want to remove this member from the channel?')) {
      return;
    }

    setRemovingUserId(userId);

    try {
      const response = await fetch(`/api/channels/${channel.id}/members/remove`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ userId })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to remove member');
      }

      onRemoveMember?.(userId);
    } catch (err: any) {
      alert(err.message || 'Failed to remove member');
    } finally {
      setRemovingUserId(null);
    }
  };

  // 邀请成功回调
  const handleInviteSuccess = () => {
    // 刷新成员列表
    onRefreshMembers?.();
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        {/* 背景遮罩 */}
        <div
          className="absolute inset-0 bg-black/50"
          onClick={onClose}
        />

        {/* 模态框 */}
        <div className="relative bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4 flex flex-col max-h-[80vh]">
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
            <h2 className="text-lg font-semibold text-gray-900">
              #{channel.name} settings
            </h2>
            <button
              onClick={onClose}
              className="p-1 hover:bg-gray-100 rounded transition-colors"
            >
              <svg
                className="w-5 h-5 text-gray-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* Tab 导航 */}
          <div className="px-6 border-b border-gray-200 flex-shrink-0">
            <nav className="flex gap-6">
              <button
                onClick={() => setActiveTab('settings')}
                className={`py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'settings'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Settings
              </button>
              <button
                onClick={() => setActiveTab('members')}
                className={`py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'members'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Members ({members.length})
              </button>
              <button
                onClick={() => setActiveTab('notifications')}
                className={`py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'notifications'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Notifications
              </button>
            </nav>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-6">
            {activeTab === 'settings' ? (
              <div className="space-y-6">
                {/* 频道名称 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Name
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm font-medium">
                      #
                    </span>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      disabled={!isOwnerOrAdmin}
                      className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm text-gray-900 disabled:bg-gray-100 disabled:text-gray-500"
                    />
                  </div>
                  {!isOwnerOrAdmin && (
                    <p className="mt-1 text-xs text-gray-500">
                      Only channel owner can edit name
                    </p>
                  )}
                </div>

                {/* 频道描述 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    disabled={!isOwnerOrAdmin}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm text-gray-900 disabled:bg-gray-100 disabled:text-gray-500 resize-none"
                    placeholder="What's this channel about?"
                  />
                  {!isOwnerOrAdmin && (
                    <p className="mt-1 text-xs text-gray-500">
                      Only channel owner can edit description
                    </p>
                  )}
                </div>

                {/* 私有频道设置 */}
                {isOwnerOrAdmin && (
                  <div>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isPrivate}
                        onChange={(e) => setIsPrivate(e.target.checked)}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <div>
                        <span className="text-sm font-medium text-gray-900">
                          Make this a private channel
                        </span>
                        <p className="text-xs text-gray-500">
                          Only invited members can see this channel
                        </p>
                      </div>
                    </label>
                  </div>
                )}

                {/* 错误提示 */}
                {error && (
                  <div className="p-3 bg-red-50 text-red-600 text-sm rounded">
                    {error}
                  </div>
                )}
              </div>
            ) : activeTab === 'members' ? (
              <div className="space-y-4">
                {/* 邀请成员按钮 */}
                {isOwnerOrAdmin && (
                  <div className="flex justify-end">
                    <Button
                      variant="primary"
                      onClick={() => setShowInviteModal(true)}
                      className="bg-[#2BAC76] hover:bg-[#239a63] text-white"
                    >
                      Invite members
                    </Button>
                  </div>
                )}

                {/* 成员列表 */}
                <div className="divide-y divide-gray-100">
                  {members.map((member) => (
                    <div
                      key={member.id}
                      className="flex items-center justify-between py-3"
                    >
                      <div
                        className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer"
                        onClick={() => onStartChat?.(member.id)}
                      >
                        <div className="relative flex-shrink-0">
                          {member.avatarUrl ? (
                            <img
                              src={member.avatarUrl}
                              alt={member.displayName}
                              className="w-10 h-10 rounded-sm"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-sm bg-gray-400 flex items-center justify-center text-white text-sm">
                              {member.displayName[0].toUpperCase()}
                            </div>
                          )}
                          {member.isOnline && (
                            <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {member.realName || member.displayName}
                          </p>
                          <p className="text-xs text-gray-500 truncate">
                            {member.displayName}
                            {member.role === 'owner' && (
                              <span className="ml-2 text-xs bg-yellow-100 text-yellow-800 px-1.5 py-0.5 rounded">
                                Owner
                              </span>
                            )}
                            {member.role === 'admin' && (
                              <span className="ml-2 text-xs bg-purple-100 text-purple-800 px-1.5 py-0.5 rounded">
                                Admin
                              </span>
                            )}
                          </p>
                        </div>
                      </div>

                      {/* 移除成员按钮 */}
                      {isOwnerOrAdmin && member.id !== currentUserId && member.role !== 'owner' && (
                        <button
                          onClick={() => handleRemoveMember(member.id)}
                          disabled={removingUserId === member.id}
                          className="ml-3 p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                          title="Remove member"
                        >
                          {removingUserId === member.id ? (
                            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                          ) : (
                            <svg
                              className="w-4 h-4"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                              />
                            </svg>
                          )}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : activeTab === 'notifications' ? (
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-medium text-gray-900 mb-2">
                    Notification Preferences
                  </h3>
                  <p className="text-xs text-gray-500 mb-4">
                    Choose what notifications you want to receive for this channel.
                  </p>

                  <div className="space-y-3">
                    {/* 全部通知 */}
                    <label
                      className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-colors ${
                        notificationLevel === 'all'
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <input
                        type="radio"
                        name="notificationLevel"
                        value="all"
                        checked={notificationLevel === 'all'}
                        onChange={() => handleSaveNotificationPreferences('all')}
                        disabled={isLoadingNotification}
                        className="mt-1"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">🔔</span>
                          <span className="text-sm font-medium text-gray-900">All messages</span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          Receive notifications for all messages in this channel.
                        </p>
                      </div>
                    </label>

                    {/* 仅提及 */}
                    <label
                      className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-colors ${
                        notificationLevel === 'mentions'
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <input
                        type="radio"
                        name="notificationLevel"
                        value="mentions"
                        checked={notificationLevel === 'mentions'}
                        onChange={() => handleSaveNotificationPreferences('mentions')}
                        disabled={isLoadingNotification}
                        className="mt-1"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">@</span>
                          <span className="text-sm font-medium text-gray-900">Mentions only</span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          Only receive notifications when someone mentions you or uses @channel.
                        </p>
                      </div>
                    </label>

                    {/* 静音 */}
                    <label
                      className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-colors ${
                        notificationLevel === 'nothing'
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <input
                        type="radio"
                        name="notificationLevel"
                        value="nothing"
                        checked={notificationLevel === 'nothing'}
                        onChange={() => handleSaveNotificationPreferences('nothing')}
                        disabled={isLoadingNotification}
                        className="mt-1"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">🔕</span>
                          <span className="text-sm font-medium text-gray-900">Nothing</span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          Mute this channel. No notifications will be sent.
                        </p>
                      </div>
                    </label>
                  </div>
                </div>

                {isLoadingNotification && (
                  <div className="flex items-center justify-center py-2">
                    <svg className="animate-spin h-5 w-5 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span className="ml-2 text-sm text-gray-500">Saving...</span>
                  </div>
                )}
              </div>
            ) : (
              null
            )}
          </div>

          {/* Footer */}
          {activeTab === 'settings' && isOwnerOrAdmin && (
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-2 flex-shrink-0">
              <Button
                type="button"
                variant="ghost"
                onClick={onClose}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="primary"
                onClick={handleSave}
                disabled={isSaving}
                className="bg-[#2BAC76] hover:bg-[#239a63] text-white"
              >
                {isSaving ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* 邀请成员弹窗 */}
      <InviteMembersModal
        isOpen={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        channelId={channel.id}
        channelName={channel.name}
        existingMemberIds={members.map(m => m.id)}
        onInviteSuccess={handleInviteSuccess}
      />
    </>
  );
}
