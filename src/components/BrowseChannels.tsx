'use client';

import { useState } from 'react';
import { Channel } from '../types/channel';
import { Button } from '@/components/ui';
import { isUserJoined } from '../types/channel';

interface BrowseChannelsProps {
  channels: Channel[];
  userId: string;
  onJoinChannel: (channelId: string) => Promise<void>;
  onLeaveChannel: (channelId: string) => Promise<void>;
  onSelectChannel: (channelId: string) => void;
  onBack?: () => void;
  isJoiningChannel?: string;
}

export default function BrowseChannels({
  channels,
  userId,
  onJoinChannel,
  onLeaveChannel,
  onSelectChannel,
  onBack,
  isJoiningChannel
}: BrowseChannelsProps) {
  const [searchQuery, setSearchQuery] = useState('');

  // 筛选频道
  const filteredChannels = channels.filter(channel =>
    channel.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (channel.description && channel.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // 分离已加入和未加入的频道
  const joinedChannels = filteredChannels.filter(channel => isUserJoined(channel, userId));
  const availableChannels = filteredChannels.filter(channel => !isUserJoined(channel, userId));

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Sticky 头部 */}
      <div className="sticky top-0 z-10 bg-background border-b border-border">
        <div className="max-w-4xl mx-auto p-6">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="p-2 hover:bg-background-elevated rounded-md transition-colors"
              aria-label="Back to channel"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="w-6 h-6 text-text-secondary"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15.75 19.5L8.25 12l7.5-7.5"
                />
              </svg>
            </button>
            <div>
              <h2 className="text-2xl font-bold text-text-primary mb-2">Browse channels</h2>
              <p className="text-text-secondary">
                Discover and join channels that interest you
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 可滚动内容 */}
      <div className="max-w-4xl mx-auto p-6">
        {/* 搜索框 */}
        <div className="mb-6">
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search channels..."
              className="w-full px-4 py-2 pl-10 bg-background-elevated border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary text-text-primary"
            />
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-tertiary"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
              />
            </svg>
          </div>
        </div>

        {/* 已加入的频道 */}
        {joinedChannels.length > 0 && (
          <div className="mb-8">
            <h3 className="text-sm font-semibold text-text-primary mb-3 uppercase tracking-wide">
              Your channels ({joinedChannels.length})
            </h3>
            <div className="space-y-2">
              {joinedChannels.map((channel) => (
                <div
                  key={channel.id}
                  className="flex items-center justify-between p-4 bg-background-elevated hover:bg-background-component rounded-lg transition-colors group"
                >
                  <div className="flex items-center gap-3 flex-1 cursor-pointer" onClick={() => onSelectChannel(channel.id)}>
                    <span className="text-[#1164A3] text-xl font-medium">#</span>
                    <div>
                      <p className="text-sm font-medium text-text-primary group-hover:text-primary transition-colors">
                        {channel.name}
                      </p>
                      {channel.description && (
                        <p className="text-xs text-text-tertiary">
                          {channel.description}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-text-tertiary">
                          {channel.memberCount || 0} members
                        </span>
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={isJoiningChannel === channel.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      onLeaveChannel(channel.id);
                    }}
                  >
                    {isJoiningChannel === channel.id ? 'Leaving...' : 'Leave'}
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 可加入的频道 */}
        {availableChannels.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-text-primary mb-3 uppercase tracking-wide">
              Available channels ({availableChannels.length})
            </h3>
            <div className="space-y-2">
              {availableChannels.map((channel) => (
                <div
                  key={channel.id}
                  className="flex items-center justify-between p-4 bg-background-elevated hover:bg-background-component rounded-lg transition-colors group"
                >
                  <div className="flex items-center gap-3 flex-1 cursor-pointer" onClick={() => onSelectChannel(channel.id)}>
                    <span className="text-text-tertiary text-xl font-medium">#</span>
                    <div>
                      <p className="text-sm font-medium text-text-primary group-hover:text-primary transition-colors">
                        {channel.name}
                      </p>
                      {channel.description && (
                        <p className="text-xs text-text-tertiary">
                          {channel.description}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-text-tertiary">
                          {channel.memberCount || 0} members
                        </span>
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="primary"
                    size="sm"
                    disabled={isJoiningChannel === channel.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      onJoinChannel(channel.id);
                    }}
                  >
                    {isJoiningChannel === channel.id ? 'Joining...' : 'Join'}
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 空状态 */}
        {filteredChannels.length === 0 && (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-background-elevated rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="w-8 h-8 text-text-tertiary"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z"
                />
              </svg>
            </div>
            <p className="text-text-secondary">
              {searchQuery ? 'No channels found matching your search' : 'No channels available'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
