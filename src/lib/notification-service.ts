// =====================================================
// Notification Service
// 自动创建和管理用户通知
// =====================================================

import { prisma } from './prisma';
import { Server as SocketIOServer } from 'socket.io';
import { parseMentions, extractUsernames } from './mention-parser';

export interface CreateNotificationParams {
  userId: string;
  type: 'mention' | 'dm' | 'channel_invite' | 'system';
  title: string;
  content?: string;
  relatedMessageId?: string;
  relatedChannelId?: string;
  relatedDmConversationId?: string;
}

export interface NotificationWithUser {
  id: string;
  userId: string;
  type: string;
  title: string;
  content?: string | null;
  relatedMessageId?: string | null;
  relatedChannelId?: string | null;
  relatedDmConversationId?: string | null;
  isRead: boolean;
  readAt?: Date | null;
  createdAt: Date;
  user: {
    id: string;
    displayName: string;
    avatarUrl?: string | null;
  };
}

/**
 * NotificationService 类
 * 负责自动创建通知并通过 WebSocket 推送
 */
export class NotificationService {
  private io: SocketIOServer | null = null;

  /**
   * 设置 WebSocket 实例
   * @param io Socket.IO 服务器实例
   */
  setSocketIO(io: SocketIOServer) {
    this.io = io;
  }

  /**
   * 创建新通知
   * @param params 通知参数
   * @returns 创建的通知记录
   */
  async createNotification(params: CreateNotificationParams): Promise<NotificationWithUser> {
    const notification = await prisma.notification.create({
      data: {
        userId: params.userId,
        type: params.type,
        title: params.title,
        content: params.content,
        relatedMessageId: params.relatedMessageId,
        relatedChannelId: params.relatedChannelId,
        relatedDmConversationId: params.relatedDmConversationId,
      },
      include: {
        user: {
          select: {
            id: true,
            displayName: true,
            avatarUrl: true,
          },
        },
      },
    });

    console.log(`🔔 Created notification: ${params.type} for user ${params.userId}`);

    // 通过 WebSocket 推送给目标用户
    this.broadcastNotification(notification);

    return notification as NotificationWithUser;
  }

  /**
   * 为消息提及创建通知
   * 当消息包含 @提及时，为被提及用户创建通知
   * @param messageId 消息ID
   * @param senderId 发送者ID
   * @param content 消息内容
   * @param channelId 频道ID（可选）
   * @param dmConversationId 私聊会话ID（可选）
   */
  async createMentionNotifications(
    messageId: string,
    senderId: string,
    content: string,
    channelId?: string,
    dmConversationId?: string
  ): Promise<void> {
    try {
      // 解析消息中的提及
      const mentions = parseMentions(content);
      if (mentions.length === 0) {
        return;
      }

      // 提取被提及的用户名
      const usernames = extractUsernames(mentions);

      // 根据 displayName 查找用户
      const mentionedUsers = await prisma.user.findMany({
        where: {
          displayName: { in: usernames },
        },
        select: {
          id: true,
          displayName: true,
        },
      });

      if (mentionedUsers.length === 0) {
        return;
      }

      // 获取发送者信息
      const sender = await prisma.user.findUnique({
        where: { id: senderId },
        select: {
          id: true,
          displayName: true,
        },
      });

      if (!sender) {
        return;
      }

      // 为每个被提及的用户创建通知
      for (const mentionedUser of mentionedUsers) {
        // 不为发送者自己创建通知
        if (mentionedUser.id === senderId) {
          continue;
        }

        let title = `${sender.displayName} mentioned you in a message`;
        let notificationContent = content.substring(0, 100);

        // 如果是频道消息，添加频道信息
        if (channelId) {
          const channel = await prisma.channel.findUnique({
            where: { id: channelId },
            select: { name: true },
          });
          if (channel) {
            title = `${sender.displayName} 在 #${channel.name} 中提到了你`;
          }
        }

        await this.createNotification({
          userId: mentionedUser.id,
          type: 'mention',
          title,
          content: notificationContent,
          relatedMessageId: messageId,
          relatedChannelId: channelId,
          relatedDmConversationId: dmConversationId,
        });
      }

      console.log(`📌 Created ${mentionedUsers.length} mention notifications for message ${messageId}`);
    } catch (error) {
      console.error('Error creating mention notifications:', error);
    }
  }

  /**
   * 为私聊消息创建通知
   * 当发送私聊消息时，为接收方创建通知
   * @param messageId 消息ID
   * @param senderId 发送者ID
   * @param dmConversationId 私聊会话ID
   */
  async createDMNotification(
    messageId: string,
    senderId: string,
    dmConversationId: string
  ): Promise<void> {
    try {
      // 获取私聊会话的成员
      const dmMembers = await prisma.dMConversationMember.findMany({
        where: {
          conversationId: dmConversationId,
        },
        select: {
          userId: true,
        },
      });

      // 获取发送者信息
      const sender = await prisma.user.findUnique({
        where: { id: senderId },
        select: {
          id: true,
          displayName: true,
        },
      });

      if (!sender) {
        return;
      }

      // 为其他成员创建通知（排除发送者）
      for (const member of dmMembers) {
        if (member.userId === senderId) {
          continue;
        }

        await this.createNotification({
          userId: member.userId,
          type: 'dm',
          title: `The new message from ${sender.displayName} `,
          content: 'You have a new message',
          relatedMessageId: messageId,
          relatedDmConversationId: dmConversationId,
        });
      }

      console.log(`💬 Created DM notification for conversation ${dmConversationId}`);
    } catch (error) {
      console.error('Error creating DM notification:', error);
    }
  }

  /**
   * 批量标记通知为已读
   * @param userId 用户ID
   * @param notificationIds 通知ID数组
   */
  async markAsRead(userId: string, notificationIds: string[]): Promise<void> {
    try {
      await prisma.notification.updateMany({
        where: {
          userId,
          id: { in: notificationIds },
          isRead: false,
        },
        data: {
          isRead: true,
          readAt: new Date(),
        },
      });

      console.log(`✅ Marked ${notificationIds.length} notifications as read for user ${userId}`);
    } catch (error) {
      console.error('Error marking notifications as read:', error);
    }
  }

  /**
   * 获取用户未读通知数量
   * @param userId 用户ID
   * @returns 未读通知数量
   */
  async getUnreadCount(userId: string): Promise<number> {
    try {
      const count = await prisma.notification.count({
        where: {
          userId,
          isRead: false,
        },
      });

      return count;
    } catch (error) {
      console.error('Error getting unread notification count:', error);
      return 0;
    }
  }

  /**
   * 通过 WebSocket 广播通知给目标用户
   * @param notification 通知记录
   */
  private broadcastNotification(notification: any): void {
    if (!this.io) {
      console.warn('WebSocket instance not set, notification not broadcast');
      return;
    }

    try {
      // 推送给目标用户
      this.io.to(`user:${notification.userId}`).emit('new-notification', {
        id: notification.id,
        type: notification.type,
        title: notification.title,
        content: notification.content,
        relatedMessageId: notification.relatedMessageId,
        relatedChannelId: notification.relatedChannelId,
        relatedDmConversationId: notification.relatedDmConversationId,
        isRead: notification.isRead,
        createdAt: notification.createdAt,
        user: notification.user,
      });

      console.log(`📡 Broadcasted notification ${notification.id} to user ${notification.userId}`);
    } catch (error) {
      console.error('Error broadcasting notification:', error);
    }
  }
}

// 创建全局实例
export const notificationService = new NotificationService();
