// =====================================================
// WebSocket 相关 TypeScript 类型定义
// =====================================================

import { Socket } from 'socket.io-client';

// 扩展 Socket 类型
export interface CustomSocket extends Socket {}

// WebSocket 事件类型
export type SocketEventType =
  | 'connect'
  | 'disconnect'
  | 'error'
  | 'new-message'
  | 'message-updated'
  | 'message-deleted'
  | 'user-typing'
  | 'message-read-by-user'
  | 'user-presence-update'
  | 'online-users'
  | 'join-channel'
  | 'leave-channel'
  | 'join-dm'
  | 'leave-dm'
  | 'typing-start'
  | 'typing-stop'
  | 'message-read'
  | 'get-online-users'
  | 'new-notification'
  // 线程相关事件
  | 'thread-reply-created'
  | 'thread-reply-updated'
  | 'thread-reply-deleted'
  | 'thread-read-status-changed'
  | 'thread-unread-count-updated';

// WebSocket message events负载
export interface NewMessagePayload {
  id: string;
  content: string;
  userId: string;
  channelId?: string;
  dmConversationId?: string;
  createdAt: Date | string;
  messageType: 'text' | 'image' | 'file' | 'system';
  user: {
    id: string;
    displayName: string;
    avatarUrl?: string;
    realName?: string;
  };
  channel?: {
    id: string;
    name: string;
  };
  dmConversation?: {
    id: string;
  };
}

// 打字事件负载
export interface TypingPayload {
  userId: string;
  channelId?: string;
  dmConversationId?: string;
  isTyping: boolean;
  displayName?: string;
}

// Message read事件负载
export interface MessageReadPayload {
  userId: string;
  messageIds: string[];
  channelId?: string;
  dmConversationId?: string;
}

// 新通知事件负载
export interface NewNotificationPayload {
  id: string;
  type: 'mention' | 'dm' | 'channel_invite' | 'system' | 'thread_reply' | 'thread_mention';
  title: string;
  content?: string;
  relatedMessageId?: string;
  relatedThreadId?: string;
  relatedChannelId?: string;
  relatedDmConversationId?: string;
  isRead: boolean;
  createdAt: Date | string;
  user: {
    id: string;
    displayName: string;
    avatarUrl?: string | null;
  };
}

// 用户Online status event payload
export interface PresenceUpdatePayload {
  userId: string;
  isOnline: boolean;
  lastSeenAt?: Date | string;
}

// 线程回复事件负载
export interface ThreadReplyCreatedPayload {
  threadId: string;
  message: NewMessagePayload;
  replyCount: number;
}

// 线程回复更新事件负载
export interface ThreadReplyUpdatedPayload {
  threadId: string;
  message: NewMessagePayload;
}

// 线程回复删除事件负载
export interface ThreadReplyDeletedPayload {
  threadId: string;
  replyId: string;
}

// 线程已读状态变更事件负载
export interface ThreadReadStatusChangedPayload {
  threadId: string;
  readAt: string;
  unreadThreadsCount: number;
}

// 线程未读计数更新事件负载
export interface ThreadUnreadCountUpdatedPayload {
  count: number;
}

// 在线用户列表负载
export interface OnlineUsersPayload {
  userId: string;
  channels: string[];
  dmConversations: string[];
}

// 加入频道事件负载
export interface JoinChannelPayload {
  channelId: string;
}

// 离开频道事件负载
export interface LeaveChannelPayload {
  channelId: string;
}

// 加入私聊事件负载
export interface JoinDMPayload {
  conversationId: string;
}

// 离开私聊事件负载
export interface LeaveDMPayload {
  conversationId: string;
}

// WebSocket 认证负载
export interface SocketAuthPayload {
  token: string;
}

// WebSocket 连接选项
export interface SocketOptions {
  auth?: SocketAuthPayload;
  transports?: ('websocket' | 'polling')[];
  reconnection?: boolean;
  reconnectionDelay?: number;
  reconnectionDelayMax?: number;
  reconnectionAttempts?: number;
  timeout?: number;
}

// WebSocket 错误事件
export interface SocketError {
  message: string;
  description?: string;
  context?: string;
}

// 房间类型
export type RoomType = 'channel' | 'dm' | 'self';

// 房间名称生成器
export function getRoomName(type: RoomType, id: string): string {
  return `${type}:${id}`;
}

export function parseRoomName(roomName: string): { type: RoomType; id: string } | null {
  const match = roomName.match(/^(channel|dm|self):(.+)$/);
  if (!match) return null;

  return {
    type: match[1] as RoomType,
    id: match[2]
  };
}

// WebSocket 事件监听器类型
export type EventListener<T = any> = (payload: T) => void;

// 房间成员信息
export interface RoomMember {
  userId: string;
  socketId: string;
  joinedAt: Date;
  lastActivityAt: Date;
}

// 频道房间信息
export interface ChannelRoom {
  channelId: string;
  members: Map<string, RoomMember>;
}

// 私聊房间信息
export interface DMRoom {
  conversationId: string;
  members: Map<string, RoomMember>;
}

// WebSocket 统计信息
export interface SocketStats {
  connectedUsers: number;
  totalChannels: number;
  totalDMRooms: number;
  messagesPerMinute: number;
  activeConnections: number;
}

// 消息队列（用于离线消息）
export interface MessageQueue {
  userId: string;
  messages: NewMessagePayload[];
  queuedAt: Date;
}

// WebSocket 配置
export interface WebSocketConfig {
  url: string;
  options: SocketOptions;
  heartbeatInterval: number;
  maxMessageQueueSize: number;
  enableTypingIndicators: boolean;
  enablePresenceUpdates: boolean;
  enableMessageHistory: boolean;
}

// 事件总线接口（用于服务器内部通信）
export interface EventBus {
  emit(event: string, data: any): boolean;
  on(event: string, listener: (...args: any[]) => void): this;
  off(event: string, listener?: (...args: any[]) => void): this;
}

// 扩展全局变量类型
declare global {
  var io: import('socket.io').Server | undefined;
}

