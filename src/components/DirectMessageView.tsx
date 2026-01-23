'use client';

import { useState, useEffect } from 'react';
import { TeamMember } from '../types';
import { Message, DMConversation } from '@/types/message';
import DMHeader from './DMHeader';
import DMTabs from './DMTabs';
import MySpaceView from './MySpaceView';
import MessageList from './MessageList';
import DMMessageInput from './DMMessageInput';
import { useUnreadCount } from '@/hooks/useUnreadCount';

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
  const { markAsRead } = useUnreadCount();

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

      // 如果是真实会话（非 self-），清除未读计数
      if (!isOwnSpace && data.id && !data.id.startsWith('self-')) {
        try {
          // 清除该会话的未读计数
          markAsRead(undefined, data.id);
        } catch (markAsReadError) {
          console.error('Error marking as read:', markAsReadError);
          // 即使 markAsRead 失败，也不影响消息加载
        }
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
    <div className="flex flex-col h-full bg-background overflow-hidden">
      {/* 1. 顶部 Header - 固定 */}
      <div className="flex-shrink-0">
        <DMHeader member={member} currentUserId={currentUserId} />
      </div>

      {/* 2. Tab 导航 - 固定 */}
      <div className="flex-shrink-0">
        <DMTabs isOwnSpace={isOwnSpace} />
      </div>

      {/* 3. 核心内容区：确保它占据所有剩余高度 */}
      <div className="flex-1 flex flex-col min-h-0">
        {isOwnSpace ? (
          <div className="flex-1 overflow-y-auto">
            <MySpaceView member={member} currentUserId={currentUserId} />
          </div>
        ) : (
          <>
            {/* 消息列表：必须设置 flex-1 和 min-h-0 以强制占满空间并支持内部滚动 */}
            <div className="flex-1 min-h-0 relative">
              <MessageList
                messages={messages}
                currentUserId={currentUserId}
                isLoading={isLoading}
                className="h-full w-full"
              />
            </div>

            {error && (
              <div className="flex-shrink-0 p-4 bg-red-500/10 text-red-500 text-center">
                {error}
              </div>
            )}

            {/* 4. 输入框：使用 flex-shrink-0 确保它被推到最底部，永不上移 */}
            <div className="flex-shrink-0 p-4 bg-background">
              <DMMessageInput
                placeholder={`Message ${member.displayName}`}
                disabled={isLoading || !conversation || conversation.id.startsWith('self-')}
                dmConversationId={conversation?.id && !conversation.id.startsWith('self-') ? conversation.id : undefined}
                currentUserId={currentUserId}
                members={[member]}
                onMessageSent={handleMessageSent}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
