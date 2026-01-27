// =====================================================
// TypeScript 类型定义 for Slack-like Chat Tool
// =====================================================

// 用户相关类型
export type UserStatus = 'active' | 'inactive' | 'suspended';
export type UserRole = 'owner' | 'admin' | 'member';

// Channel-related types
export type ChannelType = 'public' | 'private';
export type ChannelRole = 'owner' | 'admin' | 'member';

// Message-related types
export type MessageType = 'text' | 'image' | 'file' | 'system';
export type NotificationType = 'mention' | 'dm' | 'channel_invite' | 'system';

// 分页响应类型
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
}

// Message list response type
export interface MessageListResponse {
  messages: any[];
  hasMore: boolean;
  cursor?: string;
}

// Channel list response type
export interface ChannelListResponse {
  channels: any[];
  total: number;
}

// DM 对话列表响应类型
export interface DMConversationListResponse {
  conversations: any[];
  total: number;
}

// 用户列表响应类型
export interface UserListResponse {
  users: any[];
  total: number;
}

// WebSocket message events
export interface WSMessage {
  type: 'message' | 'typing' | 'read' | 'presence';
  payload: any;
  timestamp: number;
}

// Message event payload
export interface MessageEventPayload {
  message: any;
  channelId?: string;
  dmConversationId?: string;
}

// 打字事件负载
export interface TypingEventPayload {
  userId: string;
  channelId?: string;
  dmConversationId?: string;
  isTyping: boolean;
}

// 阅读状态事件负载
export interface ReadEventPayload {
  userId: string;
  messageIds: string[];
  channelId?: string;
  dmConversationId?: string;
}

// Online status event payload
export interface PresenceEventPayload {
  userId: string;
  isOnline: boolean;
  lastSeenAt?: Date;
}

// 文件上传响应
export interface FileUploadResponse {
  attachment: any;
  url: string;
  thumbnailUrl?: string;
}

// S3 配置
export interface S3Config {
  bucket: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  publicUrl: string;
}

// Search request
export interface SearchRequest {
  query: string;
  type?: 'message' | 'user' | 'channel';
  channelId?: string;
  dmConversationId?: string;
  userId?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

// Search response
export interface SearchResponse {
  query: string;
  results: {
    messages?: any[];
    users?: any[];
    channels?: any[];
  };
  total: number;
  took: number;
}

// 用户统计
export interface UserStats {
  userId: string;
  messageCount: number;
  channelCount: number;
  dmConversationCount: number;
  lastActiveAt: Date;
}

// Channel statistics
export interface ChannelStats {
  channelId: string;
  messageCount: number;
  memberCount: number;
  activeUserCount: number;
  lastMessageAt?: Date;
}

// 团队统计
export interface TeamStats {
  totalUsers: number;
  onlineUsers: number;
  totalChannels: number;
  totalMessages: number;
  totalDmConversations: number;
}

// Create channel form
export interface CreateChannelForm {
  name: string;
  description?: string;
  isPrivate: boolean;
}

// Create DM conversation form
export interface CreateDMConversationForm {
  userIds: string[];
}

// Send message form
export interface SendMessageForm {
  content: string;
  channelId?: string;
  dmConversationId?: string;
  parentMessageId?: string;
  attachments?: File[];
}

// Update user profile form
export interface UpdateUserProfileForm {
  displayName?: string;
  realName?: string;
  avatarUrl?: string;
  timezone?: string;
}

// Update notification settings form
export interface UpdateNotificationSettingsForm {
  mentionInChannel?: boolean;
  mentionInDm?: boolean;
  channelInvite?: boolean;
  browserPush?: boolean;
  emailEnabled?: boolean;
  quietHoursStart?: string;
  quietHoursEnd?: string;
}

// API error response
export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, any>;
  timestamp: number;
}

// Validation error
export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

// 实时连接状态
export type ConnectionStatus = 'connecting' | 'connected' | 'reconnecting' | 'disconnected' | 'error';

// 实时事件类型
export type RealtimeEventType =
  | 'message.created'
  | 'message.updated'
  | 'message.deleted'
  | 'message.read'
  | 'typing.start'
  | 'typing.stop'
  | 'user.presence'
  | 'user.joined'
  | 'user.left'
  | 'channel.created'
  | 'channel.updated'
  | 'notification.created';

// 实时事件
export interface RealtimeEvent<T = any> {
  type: RealtimeEventType;
  payload: T;
  timestamp: number;
  userId?: string;
}

// 应用配置
export interface AppConfig {
  database: {
    url: string;
  };
  websocket: {
    url: string;
    reconnectInterval: number;
    maxReconnectAttempts: number;
  };
  s3: S3Config;
  auth: {
    jwtSecret: string;
    tokenExpiry: string;
    sessionExpiry: string;
  };
  features: {
    enableSearch: boolean;
    enableFileUpload: boolean;
    enableNotifications: boolean;
    maxFileSize: number;
    allowedFileTypes: string[];
  };
}

// 通用 ID 类型
export type ID = string;

// 通用时间戳类型
export type Timestamp = Date | string;

// 通用可选字段
export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

// 通用必填字段
export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;

// 通用部分更新类型
export type PartialUpdate<T> = Partial<T> & { id: string };

// Common create type (excluding auto-generated fields)
export type CreateInput<T> = Omit<T, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>;

// 通用更新类型（排除不可更新字段）
export type UpdateInput<T> = Partial<T>;
