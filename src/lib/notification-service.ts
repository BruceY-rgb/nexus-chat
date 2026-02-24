// =====================================================
// Notification Service
// Automatically create and manage user notifications
// =====================================================

import { prisma } from "./prisma";
import { Server as SocketIOServer } from "socket.io";
import { parseMentions, extractUsernames, convertTokensToTraditionalFormat } from "./mention-parser";

export type NotificationLevel = "all" | "mentions" | "nothing";

export interface CreateNotificationParams {
  userId: string;
  type:
    | "mention"
    | "dm"
    | "channel_invite"
    | "system"
    | "thread_reply"
    | "thread_mention";
  title: string;
  content?: string;
  relatedMessageId?: string;
  relatedThreadId?: string;
  relatedChannelId?: string;
  relatedDmConversationId?: string;
  isMention?: boolean; // Whether this is a @mention notification
}

export interface NotificationWithUser {
  id: string;
  userId: string;
  type: string;
  title: string;
  content?: string | null;
  relatedMessageId?: string | null;
  relatedThreadId?: string | null;
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
 * NotificationService class
 * Responsible for creating notifications and pushing them via WebSocket
 */
export class NotificationService {
  private io: SocketIOServer | null = null;

  /**
   * Set WebSocket instance
   * @param io Socket.IO server instance
   */
  setSocketIO(io: SocketIOServer) {
    this.io = io;
  }

  /**
   * Check if user should receive notification
   * @param userId User ID
   * @param relatedChannelId Channel ID (optional)
   * @param relatedDmConversationId DM conversation ID (optional)
   * @param isMention Whether this is a @mention
   * @returns Whether notification should be sent
   */
  async shouldSendNotification(
    userId: string,
    relatedChannelId?: string,
    relatedDmConversationId?: string,
    isMention?: boolean,
  ): Promise<boolean> {
    try {
      // For @mention notifications, always send (unless user set to nothing)
      if (isMention) {
        // Prioritize channel/DM level settings
        if (relatedChannelId) {
          const member = await prisma.channelMember.findUnique({
            where: {
              channelId_userId: {
                channelId: relatedChannelId,
                userId,
              },
            },
            select: {
              notificationLevel: true,
            },
          });
          if (member && member.notificationLevel === "nothing") {
            return false;
          }
        } else if (relatedDmConversationId) {
          const member = await prisma.dMConversationMember.findUnique({
            where: {
              conversationId_userId: {
                conversationId: relatedDmConversationId,
                userId,
              },
            },
            select: {
              notificationLevel: true,
            },
          });
          if (member && member.notificationLevel === "nothing") {
            return false;
          }
        }
        return true;
      }

      // For non-@mention notifications, check user's notification preferences
      if (relatedChannelId) {
        const member = await prisma.channelMember.findUnique({
          where: {
            channelId_userId: {
              channelId: relatedChannelId,
              userId,
            },
          },
          select: {
            notificationLevel: true,
          },
        });

        if (!member) {
          return true; // If not a member, send by default
        }

        // "all" - send all notifications
        // "mentions" - only send @mention notifications (currently non-mention, so don't send)
        // "nothing" - don't send any notifications
        return member.notificationLevel === "all";
      } else if (relatedDmConversationId) {
        const member = await prisma.dMConversationMember.findUnique({
          where: {
            conversationId_userId: {
              conversationId: relatedDmConversationId,
              userId,
            },
          },
          select: {
            notificationLevel: true,
          },
        });

        if (!member) {
          return true;
        }

        return member.notificationLevel === "all";
      }

      return true;
    } catch (error) {
      console.error("Error checking notification preferences:", error);
      return true; // Send by default on error
    }
  }

  /**
   * Create new notification
   * @param params Notification parameters
   * @returns Created notification record
   */
  async createNotification(
    params: CreateNotificationParams,
  ): Promise<NotificationWithUser | null> {
    // Check if notification should be sent
    const shouldSend = await this.shouldSendNotification(
      params.userId,
      params.relatedChannelId,
      params.relatedDmConversationId,
      params.isMention,
    );

    if (!shouldSend) {
      console.log(
        `Notification skipped for user ${params.userId} due to notification preferences`,
      );
      return null;
    }

    const notification = await prisma.notification.create({
      data: {
        userId: params.userId,
        type: params.type,
        title: params.title,
        content: params.content,
        relatedMessageId: params.relatedMessageId,
        relatedThreadId: params.relatedThreadId,
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

    console.log(
      `Created notification: ${params.type} for user ${params.userId}`,
    );

    // Push to target user via WebSocket
    this.broadcastNotification(notification);

    return notification as NotificationWithUser;
  }

  /**
   * Create notifications for message mentions
   * When a message contains @mentions, create notifications for mentioned users
   * @param messageId Message ID
   * @param senderId Sender ID
   * @param content Message content
   * @param channelId Channel ID (optional)
   * @param dmConversationId DM conversation ID (optional)
   */
  async createMentionNotifications(
    messageId: string,
    senderId: string,
    content: string,
    channelId?: string,
    dmConversationId?: string,
  ): Promise<void> {
    try {
      // Parse mentions in message
      const mentions = parseMentions(content);
      if (mentions.length === 0) {
        return;
      }

      // Extract mentioned usernames
      const usernames = extractUsernames(mentions);

      // Find users by displayName
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

      // Get sender information
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

      // Create notification for each mentioned user
      for (const mentionedUser of mentionedUsers) {
        // Don't create notification for sender themselves
        if (mentionedUser.id === senderId) {
          continue;
        }

        let title = `${sender.displayName} mentioned you in a message`;
        // Convert token format @{userId:displayName} to human-readable @displayName
        let notificationContent = convertTokensToTraditionalFormat(content).substring(0, 100);

        // If it's a channel message, add channel information
        if (channelId) {
          const channel = await prisma.channel.findUnique({
            where: { id: channelId },
            select: { name: true },
          });
          if (channel) {
            title = `${sender.displayName} mentioned you in #${channel.name}`;
          }
        }

        await this.createNotification({
          userId: mentionedUser.id,
          type: "mention",
          title,
          content: notificationContent,
          relatedMessageId: messageId,
          relatedChannelId: channelId,
          relatedDmConversationId: dmConversationId,
          isMention: true,
        });
      }

      console.log(
        `Created ${mentionedUsers.length} mention notifications for message ${messageId}`,
      );
    } catch (error) {
      console.error("Error creating mention notifications:", error);
    }
  }

  /**
   * Create notification for DM messages
   * When sending a DM, create notification for the recipient
   * @param messageId Message ID
   * @param senderId Sender ID
   * @param dmConversationId DM conversation ID
   */
  async createDMNotification(
    messageId: string,
    senderId: string,
    dmConversationId: string,
  ): Promise<void> {
    try {
      // Get DM conversation members
      const dmMembers = await prisma.dMConversationMember.findMany({
        where: {
          conversationId: dmConversationId,
        },
        select: {
          userId: true,
        },
      });

      // Get sender information
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

      // Create notifications for other members (excluding sender)
      for (const member of dmMembers) {
        if (member.userId === senderId) {
          continue;
        }

        await this.createNotification({
          userId: member.userId,
          type: "dm",
          title: `New message from ${sender.displayName}`,
          content: "You have a new message",
          relatedMessageId: messageId,
          relatedDmConversationId: dmConversationId,
        });
      }

      console.log(
        `Created DM notification for conversation ${dmConversationId}`,
      );
    } catch (error) {
      console.error("Error creating DM notification:", error);
    }
  }

  /**
   * Batch mark notifications as read
   * @param userId User ID
   * @param notificationIds Array of notification IDs
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

      console.log(
        `Marked ${notificationIds.length} notifications as read for user ${userId}`,
      );
    } catch (error) {
      console.error("Error marking notifications as read:", error);
    }
  }

  /**
   * Get user's unread notification count
   * @param userId User ID
   * @returns Unread notification count
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
      console.error("Error getting unread notification count:", error);
      return 0;
    }
  }

  /**
   * Broadcast notification to target user via WebSocket
   * @param notification Notification record
   */
  private broadcastNotification(notification: any): void {
    if (!this.io) {
      console.warn("WebSocket instance not set, notification not broadcast");
      return;
    }

    try {
      // Push to target user
      this.io.to(`user:${notification.userId}`).emit("new-notification", {
        id: notification.id,
        type: notification.type,
        title: notification.title,
        content: notification.content,
        relatedMessageId: notification.relatedMessageId,
        relatedThreadId: notification.relatedThreadId,
        relatedChannelId: notification.relatedChannelId,
        relatedDmConversationId: notification.relatedDmConversationId,
        isRead: notification.isRead,
        createdAt: notification.createdAt,
        user: notification.user,
      });

      console.log(
        `Broadcasted notification ${notification.id} to user ${notification.userId}`,
      );
    } catch (error) {
      console.error("Error broadcasting notification:", error);
    }
  }

  /**
   * Create notification for thread replies
   * When user replies to a thread, create notifications for thread participants
   * @param replyId Reply ID
   * @param threadId Thread ID (parent message ID)
   * @param senderId Sender ID
   * @param content Reply content
   * @param channelId Channel ID (optional)
   * @param dmConversationId DM conversation ID (optional)
   */
  async createThreadReplyNotification(
    replyId: string,
    threadId: string,
    senderId: string,
    content: string,
    channelId?: string,
    dmConversationId?: string,
  ): Promise<void> {
    try {
      // Get parent message of thread
      const parentMessage = await prisma.message.findUnique({
        where: { id: threadId },
        include: {
          channel: {
            select: {
              id: true,
              name: true,
              members: {
                select: {
                  userId: true,
                },
              },
            },
          },
          dmConversation: {
            select: {
              id: true,
              members: {
                select: {
                  userId: true,
                },
              },
            },
          },
          replies: {
            select: {
              userId: true,
            },
            distinct: ["userId"],
          },
        },
      });

      if (!parentMessage) {
        return;
      }

      // Get sender information
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

      // Get all thread participants (parent message author + all repliers, excluding sender)
      const participants = new Set<string>();

      // Add parent message author
      if (parentMessage.userId) {
        participants.add(parentMessage.userId);
      }

      // Add all repliers
      parentMessage.replies.forEach((reply) => {
        if (reply.userId) {
          participants.add(reply.userId);
        }
      });

      // Remove sender themselves
      participants.delete(senderId);

      // Create notification for each participant
      for (const participantId of participants) {
        let title = `${sender.displayName} replied to your thread`;
        // Convert token format @{userId:displayName} to human-readable @displayName
        let notificationContent = convertTokensToTraditionalFormat(content).substring(0, 100);

        // If it's a channel message, add channel information
        if (parentMessage.channelId) {
          const channel = parentMessage.channel;
          if (channel) {
            title = `${sender.displayName} replied in your thread in #${channel.name}`;
          }
        } else if (parentMessage.dmConversationId) {
          title = `${sender.displayName} replied to you in a thread`;
        }

        await this.createNotification({
          userId: participantId,
          type: "thread_reply",
          title,
          content: notificationContent,
          relatedMessageId: replyId,
          relatedThreadId: threadId,
          relatedChannelId: channelId,
          relatedDmConversationId: dmConversationId,
          isMention: true,
        });
      }

      console.log(`Created thread reply notifications for thread ${threadId}`);
    } catch (error) {
      console.error("Error creating thread reply notification:", error);
    }
  }
}

// Create global instance
export const notificationService = new NotificationService();
