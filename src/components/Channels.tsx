'use client';

import { useState } from 'react';
import { Channel } from '../types/channel';
import { Badge } from './ui';
import { useUnreadStore } from '../store/unreadStore';
import CreateChannelModal from './CreateChannelModal';

interface ChannelsProps {
  channels?: Channel[];
  selectedChannelId?: string;
  joinedChannels?: string[];
  onSelectChannel?: (channelId: string) => void;
  onCreateChannel?: (channel: Channel) => void;
  onBrowseChannels?: () => void;
}

export default function Channels({
  channels = [],
  selectedChannelId,
  joinedChannels = [],
  onSelectChannel,
  onCreateChannel,
  onBrowseChannels
}: ChannelsProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { getUnreadCount } = useUnreadStore();

  const handleCreateChannel = () => {
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  const handleCreateChannelSubmit = async (channelName: string, description?: string) => {
    try {
      // 调用实际 API 创建频道
      const response = await fetch('/api/channels', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          name: channelName,
          description,
          isPrivate: false
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || '创建频道失败');
      }

      const data = await response.json();
      const newChannel = data.channel;

      // 通知父组件
      onCreateChannel?.(newChannel);

      // 关闭模态框
      setIsModalOpen(false);

      // 自动选中新建的频道（使用真实ID）
      onSelectChannel?.(newChannel.id);

      console.log('创建新频道成功:', newChannel);
    } catch (error) {
      console.error('创建频道错误:', error);
      // 可以添加用户友好的错误提示
      alert(`创建频道失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  };

  // 只显示已加入的频道
  const joinedChannelsList = channels.filter(channel => joinedChannels.includes(channel.id));

  return (
    <div className="mb-4">
      {/* Header */}
      <div
        className="flex items-center justify-between px-3 py-2 hover:bg-white/10 cursor-pointer"
        onClick={handleCreateChannel}
      >
        <h3 className="text-white/80 text-sm font-medium tracking-wide uppercase">
          Channels
        </h3>
        <div className="flex items-center gap-1">
          <button
            className="text-white/60 hover:text-white transition-colors p-1"
            aria-label="Browse channels"
            title="Browse channels"
            onClick={(e) => {
              e.stopPropagation();
              onBrowseChannels?.();
            }}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="w-4 h-4"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3.75 5.25h16.5m-16.5 4.5h16.5m-16.5 4.5h16.5m-16.5 4.5h16.5"
              />
            </svg>
          </button>
          <button
            className="text-white/60 hover:text-white transition-colors"
            aria-label="Create new channel"
            title="Create new channel"
            onClick={(e) => {
              e.stopPropagation();
              handleCreateChannel();
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
                d="M12 4.5v15m7.5-7.5h-15"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Channels List */}
      <div className="space-y-0.5">
        {joinedChannelsList.map((channel) => {
          const unreadCount = getUnreadCount(channel.id);
          const hasUnread = unreadCount > 0;
          const isSelected = selectedChannelId === channel.id;

          return (
            <div
              key={channel.id}
              className={`flex items-center px-3 py-1.5 mx-2 rounded cursor-pointer transition-colors group ${
                isSelected
                  ? 'bg-slack-blue text-white'
                  : 'hover:bg-white/10'
              }`}
              onClick={() => onSelectChannel?.(channel.id)}
            >
              {/* Channel Icon */}
              <span
                className={`text-base font-medium ${
                  isSelected
                    ? 'text-white'
                    : 'text-white/70 group-hover:text-white'
                } transition-colors`}
              >
                #
              </span>

              {/* Channel Name */}
              <span
                className={`ml-3 text-sm truncate transition-colors ${
                  isSelected
                    ? 'text-white'
                    : hasUnread
                    ? 'text-white font-semibold'
                    : 'text-white/70 group-hover:text-white'
                }`}
              >
                {channel.name}
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
      {joinedChannelsList.length === 0 && (
        <div className="px-3 py-2 text-white/50 text-sm">
          No joined channels
        </div>
      )}

      {/* 创建频道模态框 */}
      <CreateChannelModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onCreate={handleCreateChannelSubmit}
      />
    </div>
  );
}
