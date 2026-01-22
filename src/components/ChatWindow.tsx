'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSocket } from '@/hooks/useSocket';
import { ConnectionStatus } from '@/types/database';

interface Message {
  id: string;
  content: string;
  userId: string;
  channelId?: string;
  dmConversationId?: string;
  createdAt: Date;
  user: {
    id: string;
    displayName: string;
    avatarUrl?: string;
  };
}

interface TypingUser {
  userId: string;
  displayName: string;
  channelId?: string;
  dmConversationId?: string;
  isTyping: boolean;
}

interface ChatWindowProps {
  channelId?: string;
  dmConversationId?: string;
  className?: string;
}

export function ChatWindow({ channelId, dmConversationId, className = '' }: ChatWindowProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const { socket, isConnected, connectionStatus, joinChannel, leaveChannel, joinDM, leaveDM, sendTypingStart, sendTypingStop } = useSocket();

  // 自动滚动到底部
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // 加载历史消息
  const loadMessages = useCallback(async () => {
    if (!channelId && !dmConversationId) return;

    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (channelId) params.append('channelId', channelId);
      if (dmConversationId) params.append('dmConversationId', dmConversationId);

      const response = await fetch(`/api/messages?${params}`, {
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to fetch messages');
      }

      const data = await response.json();
      setMessages(data.reverse()); // 反转数组，最早的消息在前面
    } catch (error) {
      console.error('Error loading messages:', error);
    } finally {
      setIsLoading(false);
    }
  }, [channelId, dmConversationId]);

  // 加入房间
  useEffect(() => {
    if (isConnected) {
      if (channelId) {
        joinChannel(channelId);
      } else if (dmConversationId) {
        joinDM(dmConversationId);
      }
    }

    return () => {
      if (channelId) {
        leaveChannel(channelId);
      } else if (dmConversationId) {
        leaveDM(dmConversationId);
      }
    };
  }, [isConnected, channelId, dmConversationId, joinChannel, leaveChannel, joinDM, leaveDM]);

  // 初始化加载消息
  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  // 监听 WebSocket 事件
  useEffect(() => {
    if (!socket) return;

    // 新消息
    socket.on('new-message', (message: Message) => {
      console.log('📨 Received new message:', message);
      setMessages(prev => [...prev, message]);
    });

    // 打字指示器
    socket.on('user-typing', (data: { userId: string; channelId?: string; dmConversationId?: string; isTyping: boolean }) => {
      setTypingUsers(prev => {
        const filtered = prev.filter(u => u.userId !== data.userId);

        if (data.isTyping) {
          return [...filtered, {
            userId: data.userId,
            displayName: 'User', // 这里应该从用户信息中获取实际名称
            channelId: data.channelId,
            dmConversationId: data.dmConversationId,
            isTyping: true
          }];
        }

        return filtered;
      });
    });

    // 消息更新
    socket.on('message-updated', (message: Message) => {
      setMessages(prev => prev.map(m => m.id === message.id ? message : m));
    });

    // 消息删除
    socket.on('message-deleted', (data: { messageId: string }) => {
      setMessages(prev => prev.filter(m => m.id !== data.messageId));
    });

    // 用户在线状态更新
    socket.on('user-presence-update', (data: { userId: string; isOnline: boolean }) => {
      console.log('👤 User presence update:', data);
      // 这里可以更新用户列表中的在线状态
    });

    return () => {
      socket.off('new-message');
      socket.off('user-typing');
      socket.off('message-updated');
      socket.off('message-deleted');
      socket.off('user-presence-update');
    };
  }, [socket]);

  // 发送消息
  const sendMessage = async () => {
    if (!newMessage.trim() || isSending) return;

    setIsSending(true);
    try {
      const response = await fetch('/api/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          content: newMessage.trim(),
          channelId,
          dmConversationId
        })
      });

      if (!response.ok) {
        throw new Error('Failed to send message');
      }

      setNewMessage('');
      sendTypingStop({ channelId, dmConversationId });
    } catch (error) {
      console.error('Error sending message:', error);
      alert('发送消息失败，请重试');
    } finally {
      setIsSending(false);
    }
  };

  // 处理输入变化（带打字指示器）
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setNewMessage(value);

    // 发送打字开始事件
    if (value.trim() && !typingTimeoutRef.current) {
      sendTypingStart({ channelId, dmConversationId });
    }

    // 清除之前的定时器
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // 设置新的定时器，3秒后发送打字停止
    typingTimeoutRef.current = setTimeout(() => {
      sendTypingStop({ channelId, dmConversationId });
      typingTimeoutRef.current = null;
    }, 3000);
  };

  // 处理按键事件
  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // 渲染连接状态
  const renderConnectionStatus = () => {
    const statusMap = {
      connecting: '🔄 连接中...',
      connected: '✅ 已连接',
      reconnecting: '🔄 重连中...',
      disconnected: '❌ 已断开',
      error: '⚠️ 连接错误'
    };

    return (
      <div className={`text-xs ${connectionStatus === 'connected' ? 'text-green-600' : 'text-gray-500'}`}>
        {statusMap[connectionStatus]}
      </div>
    );
  };

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* 头部 - 固定不滚动 */}
      <div className="flex-shrink-0 flex items-center justify-between p-4 border-b">
        <h2 className="text-lg font-semibold">
          {channelId ? '频道聊天' : '私聊'}
        </h2>
        {renderConnectionStatus()}
      </div>

      {/* 消息列表 - 独立滚动 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 message-scroll">
        {isLoading ? (
          <div className="text-center text-gray-500">加载中...</div>
        ) : messages.length === 0 ? (
          <div className="text-center text-gray-500">还没有消息</div>
        ) : (
          messages.map((message) => (
            <div key={message.id} className="flex items-start space-x-3">
              {message.user.avatarUrl ? (
                <img
                  src={message.user.avatarUrl}
                  alt={message.user.displayName}
                  className="w-8 h-8 rounded-full"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center">
                  {message.user.displayName[0]}
                </div>
              )}
              <div className="flex-1">
                <div className="flex items-baseline space-x-2">
                  <span className="font-semibold">{message.user.displayName}</span>
                  <span className="text-xs text-gray-500">
                    {new Date(message.createdAt).toLocaleTimeString()}
                  </span>
                </div>
                <p className="mt-1">{message.content}</p>
              </div>
            </div>
          ))
        )}

        {/* 打字指示器 */}
        {typingUsers.length > 0 && (
          <div className="text-sm text-gray-500 italic">
            {typingUsers.map(u => u.displayName).join(', ')} 正在输入...
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* 输入框 - 固定不滚动 */}
      <div className="flex-shrink-0 p-4 border-t">
        <div className="flex space-x-2">
          <input
            type="text"
            value={newMessage}
            onChange={handleInputChange}
            onKeyPress={handleKeyPress}
            placeholder={isConnected ? "输入消息..." : "连接中..."}
            disabled={!isConnected || isSending}
            className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
          />
          <button
            onClick={sendMessage}
            disabled={!newMessage.trim() || !isConnected || isSending}
            className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            {isSending ? '发送中...' : '发送'}
          </button>
        </div>
      </div>
    </div>
  );
}
