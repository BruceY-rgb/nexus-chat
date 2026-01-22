'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Channel } from '../types/channel';
import { Message } from '@/types/message';
import { Button } from '@/components/ui';
import { mockTeamMembers, TeamMember } from '@/types';
import MessageList from './MessageList';
import DMMessageInput from './DMMessageInput';

interface ChannelViewProps {
  channel: Channel;
  isJoined: boolean;
  onJoinChannel: (channelId: string) => void;
  onLeaveChannel: (channelId: string) => void;
  onStartChat?: (memberId: string) => void;
}

export default function ChannelView({
  channel,
  isJoined,
  onJoinChannel,
  onLeaveChannel,
  onStartChat
}: ChannelViewProps) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // 模拟频道成员（从 mockTeamMembers 中获取）
  const members = mockTeamMembers.slice(0, 5); // 显示前5个成员

  const handleToggleMembership = () => {
    if (isJoined) {
      onLeaveChannel(channel.id);
    } else {
      onJoinChannel(channel.id);
    }
  };

  // 获取频道消息
  const fetchMessages = async () => {
    if (!isJoined) {
      setMessages([]);
      return;
    }

    try {
      setIsLoading(true);
      const response = await fetch(`/api/messages?channelId=${channel.id}`);

      if (!response.ok) {
        setMessages([]);
        setIsLoading(false);
        return;
      }

      const data = await response.json();
      setMessages(data.reverse());
      setIsLoading(false);
    } catch (err) {
      console.error('Error fetching messages:', err);
      setMessages([]);
      setIsLoading(false);
    }
  };

  // 当加入状态改变时获取消息
  useEffect(() => {
    fetchMessages();
  }, [isJoined, channel.id]);

  const handleMessageSent = () => {
    fetchMessages();
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {isJoined ? (
        <>
          {/* 消息列表 - 独立滚动 */}
          <div className="flex-1 overflow-y-auto message-scroll">
            <MessageList
              messages={messages}
              currentUserId={user?.id || ''}
              isLoading={isLoading}
            />
          </div>

          {/* 消息输入框 - 固定不滚动 */}
          <div className="flex-shrink-0">
            <DMMessageInput
              placeholder={`Message #${channel.name}`}
              disabled={false}
              channelId={channel.id}
              onMessageSent={handleMessageSent}
            />
          </div>
        </>
      ) : (
        /* 未加入频道时的提示 - 独立滚动 */
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-4xl mx-auto">
            {/* 频道介绍卡片 */}
            <div className="bg-background-elevated rounded-lg p-6 mb-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-2xl font-bold text-text-primary flex items-center gap-2 mb-2">
                    <span className="text-[#1164A3] text-3xl">#</span>
                    {channel.name}
                  </h2>
                  {channel.description && (
                    <p className="text-text-secondary">{channel.description}</p>
                  )}
                </div>
                <Button
                  variant="primary"
                  onClick={handleToggleMembership}
                >
                  Join Channel
                </Button>
              </div>

              {/* 频道统计 */}
              <div className="flex items-center gap-6 text-sm text-text-tertiary">
                <div className="flex items-center gap-2">
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
                      d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z"
                    />
                  </svg>
                  <span>{members.length} members</span>
                </div>
                <div className="flex items-center gap-2">
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
                      d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z"
                    />
                  </svg>
                  <span>Active now</span>
                </div>
              </div>
            </div>

            {/* 加入提示 */}
            <div className="bg-background-elevated rounded-lg p-8 text-center">
              <div className="w-16 h-16 bg-yellow-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg
                  className="w-8 h-8 text-yellow-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M16.5 10.5V6.75M4 19h8a2 2 0 002-2V7a2 2 0 00-2-2H4a2 2 0 00-2 2v10a2 2 0 002 2z"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-text-primary mb-2">
                Join to start chatting
              </h3>
              <p className="text-text-secondary mb-4">
                Join this channel to read and send messages
              </p>
              <Button
                variant="primary"
                onClick={() => onJoinChannel(channel.id)}
              >
                Join Channel
              </Button>
            </div>

            {/* 成员列表 */}
            <div className="mt-6 bg-background-elevated rounded-lg p-6">
              <h3 className="text-sm font-semibold text-text-primary mb-4 uppercase tracking-wide">
                Members ({members.length})
              </h3>
              <div className="space-y-3">
                {members.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center gap-3 p-2 hover:bg-background-component rounded-md transition-colors cursor-pointer"
                    onClick={() => onStartChat?.(member.id)}
                    title={`点击与 ${member.displayName} 私聊`}
                  >
                    <img
                      src={member.avatarUrl}
                      alt={member.displayName}
                      className="w-8 h-8 rounded-sm"
                    />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-text-primary">
                        {member.name}
                      </p>
                      <p className="text-xs text-text-tertiary">
                        {member.displayName}
                      </p>
                    </div>
                    {member.status === 'online' && (
                      <span className="w-2 h-2 bg-green-500 rounded-full" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
