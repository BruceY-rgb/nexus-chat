#!/usr/bin/env tsx
/**
 * 快速Mock数据填充脚本
 * 适用于自动部署环境（Vercel、Netlify、Dokploy等）
 *
 * 使用方法:
 * 1. 在部署平台的环境变量中添加 AUTO_SEED=true
 * 2. 在部署后手动运行: npx tsx scripts/quick-seed.ts
 * 3. 或通过API调用触发
 */

import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function seed() {
  console.log('🌱 开始快速填充Mock数据...\n');

  try {
    // 检查是否已有数据
    const userCount = await prisma.user.count();
    if (userCount > 0) {
      console.log(`⚠️  数据库中已有 ${userCount} 个用户，跳过填充`);
      return;
    }

    // 创建用户
    console.log('👥 创建测试用户...');
    const users = [
      { email: 'admin@chat.com', password: 'admin123', name: '管理员', role: 'owner' },
      { email: 'alice@chat.com', password: 'password123', name: 'Alice Chen', role: 'member' },
      { email: 'bob@chat.com', password: 'password123', name: 'Bob Smith', role: 'member' },
      { email: 'charlie@chat.com', password: 'password123', name: 'Charlie Brown', role: 'member' },
      { email: 'diana@chat.com', password: 'password123', name: 'Diana Prince', role: 'member' },
    ];

    const createdUsers = [];
    for (const userData of users) {
      const passwordHash = await bcrypt.hash(userData.password, 10);
      const user = await prisma.user.create({
        data: {
          email: userData.email,
          passwordHash,
          displayName: userData.name,
          realName: userData.name,
          emailVerifiedAt: new Date(),
        },
      });
      createdUsers.push(user);
      console.log(`  ✓ ${user.displayName}`);
    }

    // 创建团队成员
    for (const user of createdUsers) {
      await prisma.teamMember.create({
        data: {
          userId: user.id,
          role: user.email === 'admin@chat.com' ? 'owner' : 'member',
        },
      });
    }

    // 创建频道
    console.log('\n📢 创建频道...');
    const channels = [
      { name: 'general', description: 'General discussion', isPrivate: false },
      { name: 'random', description: 'Random topics', isPrivate: false },
      { name: 'development', description: 'Dev team', isPrivate: false },
      { name: 'design', description: 'Design team', isPrivate: false },
    ];

    const createdChannels = [];
    for (const channelData of channels) {
      const channel = await prisma.channel.create({
        data: {
          name: channelData.name,
          description: channelData.description,
          isPrivate: channelData.isPrivate,
          createdById: createdUsers[0].id,
        },
      });
      createdChannels.push(channel);
      console.log(`  ✓ #${channel.name}`);

      // 添加用户到频道
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

    // 创建消息
    console.log('\n💬 创建示例消息...');
    const messages = [
      { content: 'Welcome to the chat! 🎉', channel: 'general' },
      { content: 'Hey everyone!', channel: 'general' },
      { content: 'Let\'s build something amazing!', channel: 'general' },
      { content: 'Working on the new feature', channel: 'development' },
      { content: 'Great progress!', channel: 'development' },
      { content: 'Updated the UI mockups', channel: 'design' },
      { content: 'Love the new design!', channel: 'design' },
    ];

    for (const msg of messages) {
      const channel = createdChannels.find(c => c.name === msg.channel);
      if (channel) {
        const user = createdUsers[Math.floor(Math.random() * createdUsers.length)];
        await prisma.message.create({
          data: {
            content: msg.content,
            messageType: 'text',
            channelId: channel.id,
            userId: user.id,
          },
        });
      }
    }

    // 创建通知设置
    for (const user of createdUsers) {
      await prisma.notificationSettings.create({
        data: { userId: user.id },
      });
    }

    console.log('\n✅ Mock数据填充完成！');
    console.log('\n🔑 测试账户:');
    console.log('  admin@chat.com / admin123');
    console.log('  alice@chat.com / password123');
    console.log('  bob@chat.com / password123');
    console.log('  charlie@chat.com / password123');
    console.log('  diana@chat.com / password123');

  } catch (error) {
    console.error('\n❌ 填充失败:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

seed();
