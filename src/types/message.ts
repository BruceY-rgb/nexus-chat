export interface Message {
  id: string;
  content: string;
  messageType: string;
  channelId?: string | null;
  dmConversationId?: string | null;
  parentMessageId?: string | null;
  userId: string;
  isEdited: boolean;
  isDeleted: boolean;
  threadReplyCount: number;
  lastReplyAt?: string | null;
  isThreadRoot: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
  user: {
    id: string;
    displayName: string;
    avatarUrl?: string | null;
    realName?: string | null;
  };
  attachments?: Attachment[];
  mentions?: MessageMention[];
  reads?: MessageRead[];
  reactions?: MessageReaction[];
  parentMessage?: Message;
  replies?: Message[];
}

export interface Attachment {
  id: string;
  messageId: string;
  fileName: string;
  filePath: string;
  fileSize: string;
  mimeType: string;
  fileType?: string | null;
  s3Key: string;
  s3Bucket: string;
  thumbnailUrl?: string | null;
  createdAt: string;
}

export interface MessageMention {
  id: string;
  messageId: string;
  mentionedUserId: string;
  createdAt: string;
  mentionedUser: {
    id: string;
    displayName: string;
  };
}

export interface MessageRead {
  id: string;
  messageId: string;
  userId: string;
  readAt: string;
}

export interface MessageReaction {
  id: string;
  messageId: string;
  userId: string;
  emoji: string;
  createdAt: string;
  user: {
    id: string;
    displayName: string;
  };
}

export interface DMConversation {
  id: string;
  createdById: string;
  lastMessageAt: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
  isOwnSpace?: boolean;
  members: DMConversationMember[];
  messages?: Message[];
}

export interface DMConversationMember {
  id: string;
  conversationId: string;
  userId: string;
  lastReadAt: string;
  unreadCount: number;
  joinedAt: string;
  createdAt: string;
  updatedAt: string;
  conversation: DMConversation;
  user: {
    id: string;
    displayName: string;
    avatarUrl?: string | null;
    realName?: string | null;
    status: string;
    isOnline: boolean;
  };
}
