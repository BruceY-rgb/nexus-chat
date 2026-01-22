'use client';

import { useState, useEffect } from 'react';
import { TeamMember } from '../types';
import { Message } from '@/types/message';
import { Button } from '@/components/ui';
import DMMessageInput from './DMMessageInput';

interface MySpaceViewProps {
  member: TeamMember;
}

export default function MySpaceView({ member }: MySpaceViewProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const currentUserId = member.id;

  // 获取自己的消息列表
  const fetchMessages = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/messages?dmConversationId=self-${member.id}`);

      if (!response.ok) {
        // 如果没有消息，返回空数组
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

  useEffect(() => {
    fetchMessages();
  }, [member.id]);

  const handleMessageSent = () => {
    fetchMessages();
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-background">
      {/* 滚动内容区域 */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto p-6">
          {/* 大头像和欢迎信息 */}
          <div className="text-center py-8 mb-8">
            <div className="relative inline-block mb-6">
              <img
                src={member.avatarUrl}
                alt={member.displayName}
                className="w-24 h-24 rounded-lg shadow-lg"
              />
            </div>
            <h2 className="text-2xl font-semibold text-text-primary mb-4">
              这是你的空间
            </h2>
            <p className="text-text-secondary max-w-2xl mx-auto leading-relaxed">
              起草消息、列出待办事项或保持随时可用的链接和文件。
            </p>
            <div className="mt-6">
              <Button
                variant="ghost"
                className="text-text-secondary hover:text-text-primary"
                onClick={() => {
                  console.log('Edit profile');
                }}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                  className="w-4 h-4 mr-2"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10"
                  />
                </svg>
                编辑个人档案
              </Button>
            </div>
          </div>

          {/* 功能卡片区域 */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* 快速笔记 */}
            <div className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                    className="w-5 h-5 text-yellow-600"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25M9 16.5v.75c0 .414.336.75.75.75h1.5m0 0v1.5m0-1.5v1.5m0-1.5v.75c0 .414.336.75.75.75h1.5M9 16.5h4.5"
                    />
                  </svg>
                </div>
                <h3 className="font-medium text-text-primary">快速笔记</h3>
              </div>
              <p className="text-sm text-text-secondary">
                记录想法和点子
              </p>
            </div>

            {/* 待办事项 */}
            <div className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                    className="w-5 h-5 text-blue-600"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                <h3 className="font-medium text-text-primary">待办事项</h3>
              </div>
              <p className="text-sm text-text-secondary">
                跟踪任务和截止日期
              </p>
            </div>

            {/* 文件和链接 */}
            <div className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                    className="w-5 h-5 text-purple-600"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13"
                    />
                  </svg>
                </div>
                <h3 className="font-medium text-text-primary">文件和链接</h3>
              </div>
              <p className="text-sm text-text-secondary">
                保存重要文件和链接
              </p>
            </div>
          </div>

          {/* 最近活动 */}
          <div className="mt-12">
            <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wide mb-4">
              最近活动
            </h3>
            {messages.length > 0 ? (
              <div className="space-y-4">
                {messages.slice(0, 5).map((message) => (
                  <div key={message.id} className="flex items-start gap-3 p-3 bg-background-component rounded-lg">
                    <img
                      src={message.user.avatarUrl || '/default-avatar.png'}
                      alt={message.user.displayName}
                      className="w-8 h-8 rounded-sm"
                    />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-text-primary">
                        {message.user.displayName}
                      </p>
                      <p className="text-sm text-text-secondary">
                        {message.content}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-text-secondary">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1}
                  stroke="currentColor"
                  className="w-12 h-12 mx-auto mb-3"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <p className="text-sm">暂无最近活动</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 消息输入框 */}
      <div className="flex-shrink-0">
        <DMMessageInput
          placeholder="Message yourself"
          disabled={false}
          dmConversationId={`self-${member.id}`}
          onMessageSent={handleMessageSent}
        />
      </div>
    </div>
  );
}
