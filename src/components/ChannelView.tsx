'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Channel } from '../types/channel';
import { Message } from '@/types/message';
import { Button } from '@/components/ui';
import { TeamMember } from '@/types';
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
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [showMembersList, setShowMembersList] = useState(false);

  // 获取频道成员
  useEffect(() => {
    const fetchMembers = async () => {
      try {
        const response = await fetch(`/api/channels/${channel.id}/members`);
        if (response.ok) {
          const data = await response.json();
          setMembers(data.members || []);
        }
      } catch (error) {
        console.error('Error fetching channel members:', error);
      }
    };

    if (isJoined) {
      fetchMembers();
    }
  }, [channel.id, isJoined]);

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
    <div className="flex flex-col h-full bg-background overflow-hidden">
      {/* 1. 顶部 Header - 固定 */}
      <div className="flex-shrink-0 bg-background-secondary border-b border-border">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-sm bg-[#1164A3] flex items-center justify-center flex-shrink-0">
              <span className="text-white font-semibold text-sm">
                #{channel.name.charAt(0).toUpperCase()}
              </span>
            </div>
            <div>
              <h1 className="text-lg font-semibold text-text-primary">
                #{channel.name}
              </h1>
              <p className="text-sm text-text-secondary">
                {members.length} members
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              className="p-2 hover:bg-background-tertiary rounded-full transition-colors"
              title="Channel settings"
              onClick={() => setShowMembersList(!showMembersList)}
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
                  d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z"
                />
              </svg>
            </button>
            <button
              className="p-2 hover:bg-background-tertiary rounded-full transition-colors text-text-secondary hover:text-yellow-500"
              title="Leave channel"
              onClick={handleToggleMembership}
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
            </button>
          </div>
        </div>
      </div>

      {/* 2. 核心内容区：确保它占据所有剩余高度 */}
      <div className="flex-1 flex flex-col min-h-0">
        {isJoined ? (
          showMembersList ? (
            /* 成员列表视图 */
            <div className="flex-1 overflow-y-auto p-6">
              <div className="max-w-4xl mx-auto">
                {/* 返回按钮 */}
                <div className="flex items-center gap-2 mb-6">
                  <button
                    onClick={() => setShowMembersList(false)}
                    className="p-1 hover:bg-background-tertiary rounded transition-colors"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={2}
                      stroke="currentColor"
                      className="w-5 h-5 text-text-secondary"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M15.75 19.5L8.25 12l7.5-7.5"
                      />
                    </svg>
                  </button>
                  <h2 className="text-xl font-semibold text-text-primary">
                    #{channel.name} 成员
                  </h2>
                </div>

                {/* 成员列表 */}
                <div className="bg-background-elevated rounded-lg p-6">
                  <div className="space-y-3">
                    {members.map((member) => (
                      <div
                        key={member.id}
                        className="flex items-center gap-3 p-2 hover:bg-background-component rounded-md transition-colors cursor-pointer"
                        onClick={() => onStartChat?.(member.id)}
                        title={`点击与 ${member.displayName} 私聊`}
                      >
                        {member.avatarUrl ? (
                          <img
                            src={member.avatarUrl}
                            alt={member.displayName}
                            className="w-10 h-10 rounded-sm"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-sm bg-gray-400 flex items-center justify-center text-sm text-white">
                            {member.displayName[0].toUpperCase()}
                          </div>
                        )}
                        <div className="flex-1">
                          <p className="text-sm font-medium text-text-primary">
                            {member.realName || member.displayName}
                          </p>
                          <p className="text-xs text-text-tertiary">
                            {member.displayName}
                          </p>
                        </div>
                        {member.isOnline && (
                          <span className="w-2 h-2 bg-green-500 rounded-full" />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* 消息列表：必须设置 flex-1 和 min-h-0 以强制占满空间并支持内部滚动 */}
              <div className="flex-1 min-h-0 relative">
                <MessageList
                  messages={messages}
                  currentUserId={user?.id || ''}
                  isLoading={isLoading}
                  className="h-full w-full"
                />
              </div>

              {/* 3. 输入框：使用 flex-shrink-0 确保它被推到最底部，永不上移 */}
              <div className="flex-shrink-0 p-4 bg-background border-t">
                <DMMessageInput
                  placeholder={`Message #${channel.name}`}
                  disabled={false}
                  channelId={channel.id}
                  currentUserId={user?.id || ''}
                  members={members}
                  onMessageSent={handleMessageSent}
                />
              </div>
            </>
          )
        ) : (
        /* 未加入频道时的提示 - 独立滚动 */
        <div className="flex-1 overflow-y-auto min-h-0 p-6">
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
                    {member.avatarUrl ? (
                      <img
                        src={member.avatarUrl}
                        alt={member.displayName}
                        className="w-8 h-8 rounded-sm"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-sm bg-gray-400 flex items-center justify-center text-sm text-white">
                        {member.displayName[0].toUpperCase()}
                      </div>
                    )}
                    <div className="flex-1">
                      <p className="text-sm font-medium text-text-primary">
                        {member.realName || member.displayName}
                      </p>
                      <p className="text-xs text-text-tertiary">
                        {member.displayName}
                      </p>
                    </div>
                    {member.isOnline && (
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
    </div>
  );
}
