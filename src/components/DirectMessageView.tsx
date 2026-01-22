'use client';

import { useState, useEffect } from 'react';
import { TeamMember } from '../types';
import { Message, DMConversation } from '@/types/message';
import DMHeader from './DMHeader';
import DMTabs from './DMTabs';
import MySpaceView from './MySpaceView';
import MessageList from './MessageList';
import DMMessageInput from './DMMessageInput';

interface DirectMessageViewProps {
  member: TeamMember;
  currentUserId: string;
}

export default function DirectMessageView({
  member,
  currentUserId
}: DirectMessageViewProps) {
  const isOwnSpace = member.id === currentUserId;
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversation, setConversation] = useState<DMConversation | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 获取或创建 DM 会话
  const fetchConversation = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/conversations/dm/${member.id}`);

      if (!response.ok) {
        throw new Error('Failed to fetch conversation');
      }

      const data = await response.json();
      setConversation(data);

      // 如果不是自己的空间，获取消息
      if (!isOwnSpace && data.id && !data.id.startsWith('self-')) {
        fetchMessages(data.id);
      } else {
        setIsLoading(false);
      }
    } catch (err) {
      console.error('Error fetching conversation:', err);
      setError('Failed to load conversation');
      setIsLoading(false);
    }
  };

  // 获取消息列表
  const fetchMessages = async (conversationId: string) => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/messages?dmConversationId=${conversationId}`);

      if (!response.ok) {
        throw new Error('Failed to fetch messages');
      }

      const data = await response.json();
      setMessages(data.reverse()); // 反转以显示最新的消息
      setIsLoading(false);
    } catch (err) {
      console.error('Error fetching messages:', err);
      setError('Failed to load messages');
      setIsLoading(false);
    }
  };

  // 初始加载
  useEffect(() => {
    fetchConversation();
  }, [member.id, isOwnSpace]);

  // 处理消息发送完成
  const handleMessageSent = () => {
    if (conversation && !isOwnSpace && !conversation.id.startsWith('self-')) {
      fetchMessages(conversation.id);
    }
  };

  return (
    <div className="flex flex-col h-full bg-background">
      {/* 顶部 Header */}
      <DMHeader
        member={member}
        currentUserId={currentUserId}
      />

      {/* Tab 导航 */}
      <DMTabs isOwnSpace={isOwnSpace} />

      {/* 主内容区域 */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {/* 消息流区域 */}
        {isOwnSpace ? (
          // 个人空间视图
          <MySpaceView member={member} />
        ) : (
          // 正常私聊视图
          <>
            <MessageList
              messages={messages}
              currentUserId={currentUserId}
              isLoading={isLoading}
            />
            {error && (
              <div className="p-4 bg-red-500/10 text-red-500 text-center">
                {error}
              </div>
            )}
          </>
        )}

        {/* 消息输入框 - 仅在非个人空间时显示 */}
        {!isOwnSpace && (
          <div className="flex-shrink-0">
            <DMMessageInput
              placeholder={`Message ${member.displayName}`}
              disabled={isLoading || !conversation || conversation.id.startsWith('self-')}
              dmConversationId={conversation && !conversation.id.startsWith('self-') ? conversation.id : undefined}
              onMessageSent={handleMessageSent}
            />
          </div>
        )}
      </div>
    </div>
  );
}
