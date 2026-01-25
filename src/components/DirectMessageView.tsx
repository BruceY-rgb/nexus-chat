'use client';

import { useState, useEffect, useRef } from 'react';
import { TeamMember } from '../types';
import { Message, DMConversation } from '@/types/message';
import DMHeader from './DMHeader';
import DMTabs from './DMTabs';
import MySpaceView from './MySpaceView';
import MessageList from './MessageList';
import DMMessageInput from './DMMessageInput';
import { useUnreadCount } from '@/hooks/useUnreadCount';
import { useWebSocketMessages } from '@/hooks/useWebSocketMessages';
import { useSocket } from '@/hooks/useSocket';
import WebSocketStatus from './WebSocketStatus';

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
  const { socket, isConnected, connect, connectionStatus } = useSocket();

  // 用于跟踪是否在消息列表底部
  const isAtBottomRef = useRef(true);

  // 强制连接 WebSocket（如果未连接）
  useEffect(() => {
    console.log(`🔌 [DirectMessageView] WebSocket Status Check:`, {
      socketExists: !!socket,
      isConnected,
      socketId: socket?.id
    });

    if (!socket || !isConnected) {
      console.log(`🔌 [DirectMessageView] Force connecting WebSocket...`);
      connect();
    }
  }, [socket, isConnected, connect]);

  // 处理滚动位置变化
  const handleScrollPositionChange = (isAtBottom: boolean) => {
    isAtBottomRef.current = isAtBottom;
  };

  // WebSocket 消息监听
  const handleNewMessage = (newMessage: Message) => {
    console.log('📨 [DirectMessageView] 🔥 CRITICAL: New message received via WebSocket!', {
      messageId: newMessage.id,
      content: newMessage.content?.substring(0, 50),
      fromUser: newMessage.userId,
      dmConversationId: newMessage.dmConversationId,
      expectedConversationId: conversation?.id,
      currentUserId,
      timestamp: new Date().toISOString()
    });

    // 立即尝试更新 UI
    setMessages(prev => {
      console.log(`📨 [DirectMessageView] Current message count: ${prev.length}`);

      // 防止重复消息
      if (prev.some(msg => msg.id === newMessage.id)) {
        console.log('⚠️ [DirectMessageView] Duplicate message detected, ignoring:', newMessage.id);
        return prev;
      }

      const updated = [...prev, newMessage];
      console.log(`✅ [DirectMessageView] Message added to state. New count: ${updated.length}`);

      // 自动滚动到底部（仅当用户已在底部时）
      if (isAtBottomRef.current) {
        console.log('📜 [DirectMessageView] User is at bottom, auto-scrolling to new message');
        setTimeout(() => {
          const messagesEndElement = document.querySelector('#messages-end-ref');
          if (messagesEndElement) {
            console.log('📜 [DirectMessageView] Auto-scroll triggered');
            messagesEndElement.scrollIntoView({ behavior: 'smooth' });
          } else {
            console.log('⚠️ [DirectMessageView] Scroll anchor element not found');
          }
        }, 100);
      } else {
        console.log('📜 [DirectMessageView] User is not at bottom, skipping auto-scroll');
      }

      return updated;
    });

    console.log('✅ [DirectMessageView] Message processing completed');
  };

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

  // WebSocket 消息监听
  // 只有当 conversation 加载完成后才开始监听，确保使用真实的房间ID
  const shouldUseWebSocket = !isOwnSpace && conversation && !conversation.id.startsWith('self-');
  useWebSocketMessages({
    dmConversationId: shouldUseWebSocket ? conversation.id : undefined,
    currentUserId,
    onNewMessage: handleNewMessage
  });

  // 记录 WebSocket 状态
  useEffect(() => {
    if (!isOwnSpace) {
      console.log(`🔌 [DirectMessageView] WebSocket status:`, {
        shouldUseWebSocket,
        hasConversation: !!conversation,
        conversationId: conversation?.id,
        memberId: member.id
      });
    }
  }, [shouldUseWebSocket, conversation, isOwnSpace, member.id]);

  // 处理消息发送完成
  const handleMessageSent = () => {
    // 不再需要手动刷新消息列表，WebSocket 会自动推送新消息
    // 但可以保留作为备用方案
    console.log('✅ Message sent via API, WebSocket will handle real-time update');
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

      {/* 3. WebSocket 状态指示器 - 仅在有问题时显示 */}
      {!isOwnSpace && (connectionStatus === 'reconnecting' || connectionStatus === 'error' || (connectionStatus !== 'connected' && connectionStatus !== 'connecting')) && (
        <div className="flex-shrink-0 px-4 py-2 bg-yellow-50 border-b border-yellow-200">
          <WebSocketStatus showDetails={true} />
        </div>
      )}

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
                dmConversationId={conversation?.id && !conversation.id.startsWith('self-') ? conversation.id : undefined}
                onScrollPositionChange={handleScrollPositionChange}
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
