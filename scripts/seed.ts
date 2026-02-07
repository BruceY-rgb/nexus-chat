
// 为 Slack-like Chat Tool 添加测试数据
// =====================================================

import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

// 定义消息类型
type MessageType = 'text' | 'image' | 'file' | 'system';

const prisma = new PrismaClient();

interface SeedData {
  users: {
    email: string;
    password: string;
    displayName: string;
    realName: string;
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
  }[];
}

const seedData: SeedData = {
  users: [
    {
      email: 'admin@chat.com',
      password: 'admin123',
      displayName: 'Admin',
      realName: 'System Administrator',
    },
    {
      email: 'alice@chat.com',
      password: 'password123',
      displayName: 'Alice Chen',
      realName: 'Alice Chen',
    },
    {
      email: 'bob@chat.com',
      password: 'password123',
      displayName: 'Bob Smith',
      realName: 'Bob Smith',
    },
    {
      email: 'charlie@chat.com',
      password: 'password123',
      displayName: 'Charlie Brown',
      realName: 'Charlie Brown',
    },
    {
      email: 'diana@chat.com',
      password: 'password123',
      displayName: 'Diana Prince',
      realName: 'Diana Prince',
    },
    {
      email: 'edward@chat.com',
      password: 'password123',
      displayName: 'Edward Norton',
      realName: 'Edward Norton',
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
      name: 'hr',
      description: 'Human Resources',
      isPrivate: true,
    },
  ],
  messages: [
    // General channel messages
    {
      content: 'Welcome to our new Slack-like chat platform! 🎉',
      messageType: 'system',
      channelName: 'general',
    },
    {
      content: 'Hey everyone! Excited to be here.',
      messageType: 'text',
      channelName: 'general',
    },
    {
      content: 'Great to have you @Alice!',
      messageType: 'text',
      channelName: 'general',
    },
    {
      content: 'Let\'s build something amazing together!',
      messageType: 'text',
      channelName: 'general',
    },
    {
      content: 'Agreed! This platform looks fantastic.',
      messageType: 'text',
      channelName: 'general',
    },

    // Random channel messages
    {
      content: 'Did anyone see the game last night?',
      messageType: 'text',
      channelName: 'random',
    },
    {
      content: 'Yes! What a thrilling match!',
      messageType: 'text',
      channelName: 'random',
    },
    {
      content: 'I love this random channel, so much fun! 😄',
      messageType: 'text',
      channelName: 'random',
    },

    // Announcements channel
    {
      content: 'Weekly team meeting on Friday at 2 PM',
      messageType: 'system',
      channelName: 'announcements',
    },
    {
      content: 'New feature rollout scheduled for next week',
      messageType: 'system',
      channelName: 'announcements',
    },

    // Development channel
    {
      content: 'Starting work on the new notification system',
      messageType: 'text',
      channelName: 'development',
    },
    {
      content: 'Great! Let me know if you need help.',
      messageType: 'text',
      channelName: 'development',
    },
    {
      content: 'Pushed some code to the repo, please review @Bob',
      messageType: 'text',
      channelName: 'development',
    },

    // Design channel
    {
      content: 'Working on the new UI mockups',
      messageType: 'text',
      channelName: 'design',
    },
    {
      content: 'Can\'t wait to see them!',
      messageType: 'text',
      channelName: 'design',
    },

    // DM conversations
    {
      content: 'Hey Bob, how\'s the project going?',
      messageType: 'text',
      dmParticipants: ['alice@chat.com', 'bob@chat.com'],
    },
    {
      content: 'Going well! Almost done with the backend.',
      messageType: 'text',
      dmParticipants: ['alice@chat.com', 'bob@chat.com'],
    },
    {
      content: 'Awesome! Let me know when you need testing.',
      messageType: 'text',
      dmParticipants: ['alice@chat.com', 'bob@chat.com'],
    },
    {
      content: 'Thanks @Charlie, I\'ll ping you soon!',
      messageType: 'text',
      dmParticipants: ['alice@chat.com', 'bob@chat.com'],
    },

    // Reply thread
    {
      content: 'What do you think about the new design?',
      messageType: 'text',
      channelName: 'design',
    },
    {
      content: 'I love the color scheme!',
      messageType: 'text',
      channelName: 'design',
      parentMessageId: 'thread-1',
    },
    {
      content: 'Same here! Very modern and clean.',
      messageType: 'text',
      channelName: 'design',
      parentMessageId: 'thread-1',
    },
  ],
};

async function main() {
  console.log('🌱 开始填充数据库...');

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
          emailVerifiedAt: new Date(),
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
    const alice = createdUsers.find(u => u.email === 'alice@chat.com');
    const bob = createdUsers.find(u => u.email === 'bob@chat.com');

    if (alice && bob) {
      const dmConversation = await prisma.dMConversation.create({
        data: {
          createdById: alice.id,
          members: {
            create: [
              { userId: alice.id },
              { userId: bob.id },
            ],
          },
        },
      });
      console.log(`  ✓ 创建 DM 对话: Alice & Bob`);
    }

    // 创建消息
    console.log('💭 创建消息...');
    for (const messageData of seedData.messages) {
      let channelId: string | undefined;
      let dmConversationId: string | undefined;

      if (messageData.channelName) {
        const channel = createdChannels.find(c => c.name === messageData.channelName);
        channelId = channel?.id;
      }

      if (messageData.dmParticipants) {
        const dmConv = await prisma.dMConversation.findFirst({
          include: {
            members: true,
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
        },
      });

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

      console.log(`  ✓ 创建消息: ${message.content.substring(0, 50)}...`);
    }

    // 创建通知设置
    console.log('🔔 创建通知设置...');
    for (const user of createdUsers) {
      await prisma.notificationSettings.create({
        data: {
          userId: user.id,
        },
      });
    }

    // 创建一些示例通知
    console.log('📨 创建示例通知...');
    const firstMessage = await prisma.message.findFirst();
    if (firstMessage && alice) {
      await prisma.notification.create({
        data: {
          userId: alice.id,
          type: 'mention',
          title: 'You were mentioned',
          content: 'Someone mentioned you in a message',
          relatedMessageId: firstMessage.id,
        },
      });
    }

    console.log('✅ 数据库填充完成！');
    console.log('');
    console.log('📊 统计信息:');
    console.log(`  - 用户: ${createdUsers.length}`);
    console.log(`  - 频道: ${createdChannels.length}`);
    console.log(`  - 消息: ${await prisma.message.count()}`);
    console.log(`  - 提及: ${await prisma.messageMention.count()}`);
    console.log(`  - 通知: ${await prisma.notification.count()}`);
    console.log('');
    console.log('🔑 测试账户:');
    console.log('  管理员: admin@chat.com / admin123');
    console.log('  Alice: alice@chat.com / password123');
    console.log('  Bob: bob@chat.com / password123');
    console.log('  Charlie: charlie@chat.com / password123');

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