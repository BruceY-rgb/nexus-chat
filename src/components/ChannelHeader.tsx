'use client';

import { useState } from 'react';
import { Channel } from '../types/channel';
import { Button } from '@/components/ui';

interface ChannelHeaderProps {
  channel: Channel;
  onLeaveChannel: (channelId: string) => void;
}

export default function ChannelHeader({ channel, onLeaveChannel }: ChannelHeaderProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const handleLeaveChannel = () => {
    onLeaveChannel(channel.id);
    setIsDropdownOpen(false);
  };

  return (
    <div className="h-16 bg-background-component border-b border-border flex items-center px-6 justify-between">
      {/* 左侧：频道信息 */}
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-semibold text-text-primary flex items-center gap-2">
          <span className="text-slack-blue">#</span>
          {channel.name}
        </h1>
        {channel.description && (
          <p className="text-sm text-text-tertiary hidden md:block">
            {channel.description}
          </p>
        )}
      </div>

      {/* 右侧：频道设置按钮 */}
      <div className="relative">
        <button
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          className="p-2 hover:bg-background-elevated rounded-md transition-colors"
          aria-label="Channel settings"
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
              d="M12 6.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 12.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 18.75a.75.75 0 110-1.5.75.75 0 010 1.5z"
            />
          </svg>
        </button>

        {/* 下拉菜单 */}
        {isDropdownOpen && (
          <>
            {/* 背景遮罩 */}
            <div
              className="fixed inset-0 z-10"
              onClick={() => setIsDropdownOpen(false)}
            />

            {/* 菜单内容 */}
            <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-xl border border-gray-200 py-1 z-20">
              <div className="px-4 py-2 border-b border-gray-100">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Channel
                </p>
                <p className="text-sm text-gray-900 font-medium mt-1">
                  #{channel.name}
                </p>
              </div>

              <button
                onClick={handleLeaveChannel}
                className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 transition-colors flex items-center gap-2"
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
                    d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75"
                  />
                </svg>
                Leave channel
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
