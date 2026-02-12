'use client';

import { useState, useEffect } from 'react';
import { useNotificationPreferences, NotificationLevel } from '../hooks/useNotificationPreferences';

interface DMNotificationSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  dmConversationId: string;
  memberName: string;
}

export default function DMNotificationSettingsModal({
  isOpen,
  onClose,
  dmConversationId,
  memberName,
}: DMNotificationSettingsModalProps) {
  const { setNotificationLevel, getNotificationLevel, isLoading } = useNotificationPreferences();
  const [notificationLevel, setNotificationLevelState] = useState<NotificationLevel>('all');
  const [isSaving, setIsSaving] = useState(false);

  // 加载当前通知级别
  useEffect(() => {
    if (isOpen && dmConversationId) {
      const currentLevel = getNotificationLevel(dmConversationId);
      // 同时也从 API 获取最新值
      fetchNotificationLevel();
    }
  }, [isOpen, dmConversationId]);

  const fetchNotificationLevel = async () => {
    try {
      const response = await fetch(
        `/api/dm-conversations/${dmConversationId}/notification-preferences`,
        { credentials: 'include' }
      );
      if (response.ok) {
        const data = await response.json();
        setNotificationLevelState(data.notificationLevel || 'all');
      }
    } catch (error) {
      console.error('Error fetching notification level:', error);
    }
  };

  const handleSaveNotificationPreferences = async (level: NotificationLevel) => {
    setIsSaving(true);
    try {
      await setNotificationLevel(dmConversationId, level, 'dm');
      setNotificationLevelState(level);
    } catch (error) {
      console.error('Error saving notification preferences:', error);
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  const getLevelLabel = (level: NotificationLevel): string => {
    switch (level) {
      case 'all':
        return 'All messages';
      case 'mentions':
        return 'Mentions only';
      case 'nothing':
        return 'Nothing';
    }
  };

  const getLevelDescription = (level: NotificationLevel): string => {
    switch (level) {
      case 'all':
        return 'Receive notifications for all messages in this conversation.';
      case 'mentions':
        return 'Only receive notifications when someone mentions you.';
      case 'nothing':
        return 'Mute this conversation. No notifications will be sent.';
    }
  };

  const getLevelEmoji = (level: NotificationLevel): string => {
    switch (level) {
      case 'all':
        return '🔔';
      case 'mentions':
        return '@';
      case 'nothing':
        return '🔕';
    }
  };

  return (
    <>
      {/* 背景遮罩 */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-40"
        onClick={onClose}
      />

      {/* 弹窗内容 */}
      <div className="fixed inset-0 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 overflow-hidden">
          {/* 头部 */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Notification Settings
              </h2>
              <p className="text-sm text-gray-500 mt-0.5">
                {memberName}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-1 hover:bg-gray-100 rounded-full transition-colors"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="w-5 h-5 text-gray-500"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* 内容 */}
          <div className="px-6 py-4 space-y-4">
            <div>
              <h3 className="text-sm font-medium text-gray-900 mb-2">
                Notification Preferences
              </h3>
              <p className="text-xs text-gray-500 mb-4">
                Choose what notifications you want to receive for this conversation.
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
                    disabled={isSaving}
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{getLevelEmoji('all')}</span>
                      <span className="text-sm font-medium text-gray-900">
                        {getLevelLabel('all')}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {getLevelDescription('all')}
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
                    disabled={isSaving}
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{getLevelEmoji('mentions')}</span>
                      <span className="text-sm font-medium text-gray-900">
                        {getLevelLabel('mentions')}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {getLevelDescription('mentions')}
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
                    disabled={isSaving}
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{getLevelEmoji('nothing')}</span>
                      <span className="text-sm font-medium text-gray-900">
                        {getLevelLabel('nothing')}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {getLevelDescription('nothing')}
                    </p>
                  </div>
                </label>
              </div>
            </div>

            {(isSaving || isLoading) && (
              <div className="flex items-center justify-center py-2">
                <svg
                  className="animate-spin h-5 w-5 text-blue-500"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                <span className="ml-2 text-sm text-gray-500">Saving...</span>
              </div>
            )}
          </div>

          {/* 底部按钮 */}
          <div className="px-6 py-4 border-t border-gray-200 flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm font-medium"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
