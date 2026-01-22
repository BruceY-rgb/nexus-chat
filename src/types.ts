// TeamMember 接口定义 - 与数据库 User 表保持一致
export interface TeamMember {
  id: string;
  email: string;
  displayName: string;
  realName?: string | null;
  avatarUrl?: string | null;
  isOnline: boolean;
  lastSeenAt?: Date | null;
  unreadCount?: number;
  lastReadAt?: Date;
  dmConversationId?: string;
}
