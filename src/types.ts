// TeamMember interface definition - consistent with database User table
export interface TeamMember {
  id: string;
  slackUserId?: string | null;
  email: string;
  displayName: string;
  realName?: string | null;
  avatarUrl?: string | null;
  isOnline: boolean;
  lastSeenAt?: Date | null;
  unreadCount?: number;
  lastReadAt?: Date;
  dmConversationId?: string;
  isStarred?: boolean;
  role?: string; // Channel member role: owner, admin, member
}
