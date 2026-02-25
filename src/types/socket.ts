// =====================================================
// WebSocket related TypeScript type definitions
// =====================================================

import { Socket } from 'socket.io-client';

// Extended Socket type
export interface CustomSocket extends Socket {}

// WebSocket event types
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
  // Thread related events
  | 'thread-reply-created'
  | 'thread-reply-updated'
  | 'thread-reply-deleted'
  | 'thread-read-status-changed'
  | 'thread-unread-count-updated';

// WebSocket message events payload
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

// Typing event payload
export interface TypingPayload {
  userId: string;
  channelId?: string;
  dmConversationId?: string;
  isTyping: boolean;
  displayName?: string;
}

// Message read event payload
export interface MessageReadPayload {
  userId: string;
  messageIds: string[];
  channelId?: string;
  dmConversationId?: string;
}

// New notification event payload
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

// User online status event payload
export interface PresenceUpdatePayload {
  userId: string;
  isOnline: boolean;
  lastSeenAt?: Date | string;
}

// Thread reply event payload
export interface ThreadReplyCreatedPayload {
  threadId: string;
  message: NewMessagePayload;
  replyCount: number;
}

// Thread reply update event payload
export interface ThreadReplyUpdatedPayload {
  threadId: string;
  message: NewMessagePayload;
}

// Thread reply deleted event payload
export interface ThreadReplyDeletedPayload {
  threadId: string;
  replyId: string;
}

// Thread read status changed event payload
export interface ThreadReadStatusChangedPayload {
  threadId: string;
  readAt: string;
  unreadThreadsCount: number;
}

// Thread unread count updated event payload
export interface ThreadUnreadCountUpdatedPayload {
  count: number;
}

// Online users list payload
export interface OnlineUsersPayload {
  userId: string;
  channels: string[];
  dmConversations: string[];
}

// Join channel event payload
export interface JoinChannelPayload {
  channelId: string;
}

// Leave channel event payload
export interface LeaveChannelPayload {
  channelId: string;
}

// Join DM event payload
export interface JoinDMPayload {
  conversationId: string;
}

// Leave DM event payload
export interface LeaveDMPayload {
  conversationId: string;
}

// WebSocket authentication payload
export interface SocketAuthPayload {
  token: string;
}

// WebSocket connection options
export interface SocketOptions {
  auth?: SocketAuthPayload;
  transports?: ('websocket' | 'polling')[];
  reconnection?: boolean;
  reconnectionDelay?: number;
  reconnectionDelayMax?: number;
  reconnectionAttempts?: number;
  timeout?: number;
}

// WebSocket error event
export interface SocketError {
  message: string;
  description?: string;
  context?: string;
}

// Room type
export type RoomType = 'channel' | 'dm' | 'self';

// Room name generator
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

// WebSocket event listener type
export type EventListener<T = any> = (payload: T) => void;

// Room member information
export interface RoomMember {
  userId: string;
  socketId: string;
  joinedAt: Date;
  lastActivityAt: Date;
}

// Channel room information
export interface ChannelRoom {
  channelId: string;
  members: Map<string, RoomMember>;
}

// DM room information
export interface DMRoom {
  conversationId: string;
  members: Map<string, RoomMember>;
}

// WebSocket statistics
export interface SocketStats {
  connectedUsers: number;
  totalChannels: number;
  totalDMRooms: number;
  messagesPerMinute: number;
  activeConnections: number;
}

// Message queue (for offline messages)
export interface MessageQueue {
  userId: string;
  messages: NewMessagePayload[];
  queuedAt: Date;
}

// WebSocket configuration
export interface WebSocketConfig {
  url: string;
  options: SocketOptions;
  heartbeatInterval: number;
  maxMessageQueueSize: number;
  enableTypingIndicators: boolean;
  enablePresenceUpdates: boolean;
  enableMessageHistory: boolean;
}

// Event bus interface (for server internal communication)
export interface EventBus {
  emit(event: string, data: any): boolean;
  on(event: string, listener: (...args: any[]) => void): this;
  off(event: string, listener?: (...args: any[]) => void): this;
}

// Extend global variable types
declare global {
  var io: import('socket.io').Server | undefined;
}

