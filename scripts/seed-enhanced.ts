// =====================================================
// 增强版数据库填充脚本
// 为 Slack-like Chat Tool 添加丰富的测试数据
// =====================================================

import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

// 定义消息类型
type MessageType = 'text' | 'image' | 'file' | 'system';

const prisma = new PrismaClient();

// 生成随机日期
function randomDate(start: Date, end: Date): Date {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

// 生成随机整数
function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

interface SeedData {
  users: {
    email: string;
    password: string;
    displayName: string;
    realName: string;
    status: string;
    timezone: string;
  }[];
  channels: {
    name: string;
    description: string;
    isPrivate: boolean;
  }[];
  messages: {
    content: string;
    messageType: MessageType;
    channelName?: string;
    dmParticipants?: string[];
    parentMessageId?: string;
    createdAt?: Date;
  }[];
}

const seedData: SeedData = {
  users: [
    {
      email: 'admin@chat.com',
      password: 'admin123',
      displayName: 'Admin',
      realName: 'System Administrator',
      status: 'active',
      timezone: 'Asia/Shanghai',
    },
    {
      email: 'alice@chat.com',
      password: 'password123',
      displayName: 'Alice Chen',
      realName: 'Alice Chen',
      status: 'active',
      timezone: 'Asia/Shanghai',
    },
    {
      email: 'bob@chat.com',
      password: 'password123',
      displayName: 'Bob Smith',
      realName: 'Bob Smith',
      status: 'active',
      timezone: 'Asia/Shanghai',
    },
    {
      email: 'charlie@chat.com',
      password: 'password123',
      displayName: 'Charlie Brown',
      realName: 'Charlie Brown',
      status: 'active',
      timezone: 'Asia/Shanghai',
    },
    {
      email: 'diana@chat.com',
      password: 'password123',
      displayName: 'Diana Prince',
      realName: 'Diana Prince',
      status: 'active',
      timezone: 'Asia/Shanghai',
    },
    {
      email: 'edward@chat.com',
      password: 'password123',
      displayName: 'Edward Norton',
      realName: 'Edward Norton',
      status: 'active',
      timezone: 'Asia/Shanghai',
    },
    {
      email: 'frank@chat.com',
      password: 'password123',
      displayName: 'Frank Miller',
      realName: 'Frank Miller',
      status: 'active',
      timezone: 'Asia/Shanghai',
    },
    {
      email: 'grace@chat.com',
      password: 'password123',
      displayName: 'Grace Lee',
      realName: 'Grace Lee',
      status: 'active',
      timezone: 'Asia/Shanghai',
    },
  ],
  channels: [
    {
      name: 'general',
      description: 'General team discussion',
      isPrivate: false,
    },
    {
      name: 'random',
      description: 'Random topics and memes',
      isPrivate: false,
    },
    {
      name: 'announcements',
      description: 'Official announcements',
      isPrivate: false,
    },
    {
      name: 'development',
      description: 'Development team discussions',
      isPrivate: false,
    },
    {
      name: 'design',
      description: 'Design team discussions',
      isPrivate: false,
    },
    {
      name: 'marketing',
      description: 'Marketing team discussions',
      isPrivate: false,
    },
    {
      name: 'sales',
      description: 'Sales team discussions',
      isPrivate: false,
    },
    {
      name: 'hr',
      description: 'Human Resources',
      isPrivate: true,
    },
    {
      name: 'finance',
      description: 'Finance discussions',
      isPrivate: true,
    },
  ],
  messages: [
    // General channel messages
    {
      content: 'Welcome to our new Slack-like chat platform! 🎉',
      messageType: 'system',
      channelName: 'general',
      createdAt: randomDate(new Date(2024, 0, 1), new Date()),
    },
    {
      content: 'Hey everyone! Excited to be here.',
      messageType: 'text',
      channelName: 'general',
      createdAt: randomDate(new Date(2024, 0, 1), new Date()),
    },
    {
      content: 'Great to have you @Alice!',
      messageType: 'text',
      channelName: 'general',
      createdAt: randomDate(new Date(2024, 0, 1), new Date()),
    },
    {
      content: 'Let\'s build something amazing together!',
      messageType: 'text',
      channelName: 'general',
      createdAt: randomDate(new Date(2024, 0, 1), new Date()),
    },
    {
      content: 'Agreed! This platform looks fantastic.',
      messageType: 'text',
      channelName: 'general',
      createdAt: randomDate(new Date(2024, 0, 1), new Date()),
    },
    {
      content: 'Can we schedule a team meeting for next week?',
      messageType: 'text',
      channelName: 'general',
      createdAt: randomDate(new Date(2024, 0, 1), new Date()),
    },
    {
      content: 'I\'m working on the new feature set. Updates coming soon!',
      messageType: 'text',
      channelName: 'general',
      createdAt: randomDate(new Date(2024, 0, 1), new Date()),
    },

    // Random channel messages
    {
      content: 'Did anyone see the game last night?',
      messageType: 'text',
      channelName: 'random',
      createdAt: randomDate(new Date(2024, 0, 1), new Date()),
    },
    {
      content: 'Yes! What a thrilling match!',
      messageType: 'text',
      channelName: 'random',
      createdAt: randomDate(new Date(2024, 0, 1), new Date()),
    },
    {
      content: 'I love this random channel, so much fun! 😄',
      messageType: 'text',
      channelName: 'random',
      createdAt: randomDate(new Date(2024, 0, 1), new Date()),
    },
    {
      content: 'Share some memes here! 😂',
      messageType: 'text',
      channelName: 'random',
      createdAt: randomDate(new Date(2024, 0, 1), new Date()),
    },
    {
      content: 'Coffee break time! ☕',
      messageType: 'text',
      channelName: 'random',
      createdAt: randomDate(new Date(2024, 0, 1), new Date()),
    },

    // Announcements channel
    {
      content: 'Weekly team meeting on Friday at 2 PM',
      messageType: 'system',
      channelName: 'announcements',
      createdAt: randomDate(new Date(2024, 0, 1), new Date()),
    },
    {
      content: 'New feature rollout scheduled for next week',
      messageType: 'system',
      channelName: 'announcements',
      createdAt: randomDate(new Date(2024, 0, 1), new Date()),
    },
    {
      content: 'Company holiday schedule announced',
      messageType: 'system',
      channelName: 'announcements',
      createdAt: randomDate(new Date(2024, 0, 1), new Date()),
    },

    // Development channel
    {
      content: 'Starting work on the new notification system',
      messageType: 'text',
      channelName: 'development',
      createdAt: randomDate(new Date(2024, 0, 1), new Date()),
    },
    {
      content: 'Great! Let me know if you need help.',
      messageType: 'text',
      channelName: 'development',
      createdAt: randomDate(new Date(2024, 0, 1), new Date()),
    },
    {
      content: 'Pushed some code to the repo, please review @Bob',
      messageType: 'text',
      channelName: 'development',
      createdAt: randomDate(new Date(2024, 0, 1), new Date()),
    },
    {
      content: 'Working on the API endpoints',
      messageType: 'text',
      channelName: 'development',
      createdAt: randomDate(new Date(2024, 0, 1), new Date()),
    },
    {
      content: 'Fixed the bug in the websocket connection',
      messageType: 'text',
      channelName: 'development',
      createdAt: randomDate(new Date(2024, 0, 1), new Date()),
    },

    // Design channel
    {
      content: 'Working on the new UI mockups',
      messageType: 'text',
      channelName: 'design',
      createdAt: randomDate(new Date(2024, 0, 1), new Date()),
    },
    {
      content: 'Can\'t wait to see them!',
      messageType: 'text',
      channelName: 'design',
      createdAt: randomDate(new Date(2024, 0, 1), new Date()),
    },
    {
      content: 'Updated the color palette',
      messageType: 'text',
      channelName: 'design',
      createdAt: randomDate(new Date(2024, 0, 1), new Date()),
    },
    {
      content: 'Created new icons for the dashboard',
      messageType: 'text',
      channelName: 'design',
      createdAt: randomDate(new Date(2024, 0, 1), new Date()),
    },

    // Marketing channel
    {
      content: 'Planning the product launch campaign',
      messageType: 'text',
      channelName: 'marketing',
      createdAt: randomDate(new Date(2024, 0, 1), new Date()),
    },
    {
      content: 'Social media content ready for review',
      messageType: 'text',
      channelName: 'marketing',
      createdAt: randomDate(new Date(2024, 0, 1), new Date()),
    },

    // Sales channel
    {
      content: 'Q1 sales targets looking good!',
      messageType: 'text',
      channelName: 'sales',
      createdAt: randomDate(new Date(2024, 0, 1), new Date()),
    },
    {
      content: 'New client onboarding scheduled',
      messageType: 'text',
      channelName: 'sales',
      createdAt: randomDate(new Date(2024, 0, 1), new Date()),
    },

    // DM conversations
    {
      content: 'Hey Bob, how\'s the project going?',
      messageType: 'text',
      dmParticipants: ['alice@chat.com', 'bob@chat.com'],
      createdAt: randomDate(new Date(2024, 0, 1), new Date()),
    },
    {
      content: 'Going well! Almost done with the backend.',
      messageType: 'text',
      dmParticipants: ['alice@chat.com', 'bob@chat.com'],
      createdAt: randomDate(new Date(2024, 0, 1), new Date()),
    },
    {
      content: 'Awesome! Let me know when you need testing.',
      messageType: 'text',
      dmParticipants: ['alice@chat.com', 'bob@chat.com'],
      createdAt: randomDate(new Date(2024, 0, 1), new Date()),
    },
    {
      content: 'Thanks @Charlie, I\'ll ping you soon!',
      messageType: 'text',
      dmParticipants: ['alice@chat.com', 'bob@chat.com'],
      createdAt: randomDate(new Date(2024, 0, 1), new Date()),
    },

    // Reply threads
    {
      content: 'What do you think about the new design?',
      messageType: 'text',
      channelName: 'design',
      createdAt: randomDate(new Date(2024, 0, 1), new Date()),
    },
    {
      content: 'I love the color scheme!',
      messageType: 'text',
      channelName: 'design',
      parentMessageId: 'thread-1',
      createdAt: randomDate(new Date(2024, 0, 1), new Date()),
    },
    {
      content: 'Same here! Very modern and clean.',
      messageType: 'text',
      channelName: 'design',
      parentMessageId: 'thread-1',
      createdAt: randomDate(new Date(2024, 0, 1), new Date()),
    },
  ],
};

async function main() {
  console.log('🌱 开始填充增强版数据库...');

  try {
    // 清空现有数据
    console.log('🧹 清空现有数据...');
    await prisma.notification.deleteMany();
    await prisma.attachment.deleteMany();
    await prisma.messageMention.deleteMany();
    await prisma.messageRead.deleteMany();
    await prisma.message.deleteMany();
    await prisma.channelMember.deleteMany();
    await prisma.dMConversationMember.deleteMany();
    await prisma.dMConversation.deleteMany();
    await prisma.channel.deleteMany();
    await prisma.userSession.deleteMany();
    await prisma.teamMember.deleteMany();
    await prisma.notificationSettings.deleteMany();
    await prisma.user.deleteMany();
    console.log('✅ 数据已清空');

    // 创建用户
    console.log('👥 创建用户...');
    const createdUsers = [];
    for (const userData of seedData.users) {
      const passwordHash = await bcrypt.hash(userData.password, 10);
      const user = await prisma.user.create({
        data: {
          email: userData.email,
          passwordHash,
          displayName: userData.displayName,
          realName: userData.realName,
          status: userData.status,
          timezone: userData.timezone,
          emailVerifiedAt: new Date(),
          lastSeenAt: randomDate(new Date(2024, 0, 1), new Date()),
          isOnline: Math.random() > 0.5,
        },
      });
      createdUsers.push(user);
      console.log(`  ✓ 创建用户: ${user.displayName}`);
    }

    // 创建团队成员关系
    console.log('👨‍👩‍👧‍👦 创建团队成员关系...');
    for (const user of createdUsers) {
      await prisma.teamMember.create({
        data: {
          userId: user.id,
          role: user.email === 'admin@chat.com' ? 'owner' : 'member',
        },
      });
    }

    // 创建频道
    console.log('📢 创建频道...');
    const createdChannels = [];
    for (const channelData of seedData.channels) {
      const channel = await prisma.channel.create({
        data: {
          name: channelData.name,
          description: channelData.description,
          isPrivate: channelData.isPrivate,
          createdById: createdUsers[0].id, // Admin creates all channels
        },
      });
      createdChannels.push(channel);
      console.log(`  ✓ 创建频道: ${channel.name}`);

      // 将所有用户添加到公共频道
      if (!channelData.isPrivate) {
        for (const user of createdUsers) {
          await prisma.channelMember.create({
            data: {
              channelId: channel.id,
              userId: user.id,
              role: user.email === 'admin@chat.com' ? 'owner' : 'member',
            },
          });
        }
      }
    }

    // 创建 DM 对话
    console.log('💬 创建 DM 对话...');
    const dmPairs = [
      ['alice@chat.com', 'bob@chat.com'],
      ['charlie@chat.com', 'diana@chat.com'],
      ['edward@chat.com', 'frank@chat.com'],
      ['grace@chat.com', 'alice@chat.com'],
    ];

    for (const [email1, email2] of dmPairs) {
      const user1 = createdUsers.find(u => u.email === email1);
      const user2 = createdUsers.find(u => u.email === email2);

      if (user1 && user2) {
        const dmConversation = await prisma.dMConversation.create({
          data: {
            createdById: user1.id,
            members: {
              create: [
                { userId: user1.id },
                { userId: user2.id },
              ],
            },
          },
        });
        console.log(`  ✓ 创建 DM 对话: ${user1.displayName} & ${user2.displayName}`);
      }
    }

    // 创建消息
    console.log('💭 创建消息...');
    const createdMessages: any[] = [];
    for (let i = 0; i < seedData.messages.length; i++) {
      const messageData = seedData.messages[i];
      let channelId: string | undefined;
      let dmConversationId: string | undefined;

      if (messageData.channelName) {
        const channel = createdChannels.find(c => c.name === messageData.channelName);
        channelId = channel?.id;
      }

      if (messageData.dmParticipants) {
        const dmConv = await prisma.dMConversation.findFirst({
          include: {
            members: {
              include: {
                user: true,
              },
            },
          },
        });
        dmConversationId = dmConv?.id;
      }

      // 随机选择一个用户作为消息发送者
      const randomUser = createdUsers[Math.floor(Math.random() * createdUsers.length)];

      const message = await prisma.message.create({
        data: {
          content: messageData.content,
          messageType: messageData.messageType,
          channelId,
          dmConversationId,
          userId: randomUser.id,
          createdAt: messageData.createdAt || randomDate(new Date(2024, 0, 1), new Date()),
        },
      });
      createdMessages.push(message);

      // 处理 @ 提及
      const mentionRegex = /@(\w+)/g;
      const mentions = messageData.content.match(mentionRegex);
      if (mentions) {
        for (const mention of mentions) {
          const displayName = mention.substring(1);
          const mentionedUser = createdUsers.find(u => u.displayName.includes(displayName));
          if (mentionedUser) {
            await prisma.messageMention.create({
              data: {
                messageId: message.id,
                mentionedUserId: mentionedUser.id,
              },
            });
          }
        }
      }

      console.log(`  ✓ 创建消息 (${i + 1}/${seedData.messages.length}): ${message.content.substring(0, 50)}...`);
    }

    // 生成额外的随机消息
    console.log('🎲 生成额外的随机消息...');
    const randomMessages = [
      'This looks great! 👍',
      'I agree with that approach',
      'Let me review and get back to you',
      'Thanks for the update',
      'Could you provide more details?',
      'Looks good to me ✅',
      'I have a question about this',
      'Let\'s schedule a call to discuss',
      'Working on it now',
      'Done! Please check it out',
      'Awesome work team! 🎉',
      'Just pushed an update',
      'Bug fixed and deployed',
      'Ready for testing',
      'Can someone review this?',
    ];

    for (let i = 0; i < 50; i++) {
      const channel = createdChannels[Math.floor(Math.random() * createdChannels.length)];
      const user = createdUsers[Math.floor(Math.random() * createdUsers.length)];
      const messageContent = randomMessages[Math.floor(Math.random() * randomMessages.length)];

      const message = await prisma.message.create({
        data: {
          content: messageContent,
          messageType: 'text',
          channelId: channel.id,
          userId: user.id,
          createdAt: randomDate(new Date(2024, 0, 1), new Date()),
        },
      });
      createdMessages.push(message);
    }
    console.log('  ✓ 生成了 50 条额外消息');

    // 创建通知设置
    console.log('🔔 创建通知设置...');
    for (const user of createdUsers) {
      await prisma.notificationSettings.create({
        data: {
          userId: user.id,
          mentionInChannel: Math.random() > 0.2,
          mentionInDm: Math.random() > 0.1,
          channelInvite: Math.random() > 0.3,
          browserPush: Math.random() > 0.5,
          emailEnabled: Math.random() > 0.7,
        },
      });
    }

    // 创建一些示例通知
    console.log('📨 创建示例通知...');
    for (let i = 0; i < 20; i++) {
      const user = createdUsers[Math.floor(Math.random() * createdUsers.length)];
      const message = createdMessages[Math.floor(Math.random() * createdMessages.length)];

      await prisma.notification.create({
        data: {
          userId: user.id,
          type: 'mention',
          title: 'You were mentioned',
          content: 'Someone mentioned you in a message',
          relatedMessageId: message.id,
          isRead: Math.random() > 0.5,
          readAt: Math.random() > 0.5 ? randomDate(new Date(2024, 0, 1), new Date()) : null,
        },
      });
    }
    console.log('  ✓ 创建了 20 条示例通知');

    console.log('✅ 增强版数据库填充完成！');
    console.log('');
    console.log('📊 统计信息:');
    console.log(`  - 用户: ${createdUsers.length}`);
    console.log(`  - 频道: ${createdChannels.length}`);
    console.log(`  - 消息: ${await prisma.message.count()}`);
    console.log(`  - 提及: ${await prisma.messageMention.count()}`);
    console.log(`  - 通知: ${await prisma.notification.count()}`);
    console.log(`  - DM对话: ${await prisma.dMConversation.count()}`);
    console.log('');
    console.log('🔑 测试账户:');
    console.log('  管理员: admin@chat.com / admin123');
    for (let i = 1; i < createdUsers.length; i++) {
      console.log(`  ${createdUsers[i].displayName}: ${createdUsers[i].email} / password123`);
    }

  } catch (error) {
    console.error('❌ 填充数据时出错:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
