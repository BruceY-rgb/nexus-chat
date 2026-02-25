#!/usr/bin/env tsx
/**
 * Quick Mock Data Seeding Script
 * Suitable for automated deployment environments (Vercel, Netlify, Dokploy, etc.)
 *
 * Usage:
 * 1. Add AUTO_SEED=true to environment variables in deployment platform
 * 2. Run manually after deployment: npx tsx scripts/quick-seed.ts
 * 3. Or trigger via API call
 */

import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

// Environment detection
const isProduction = process.env.NODE_ENV === 'production';
const isDokploy = !!process.env.DOKPLOY || !!process.env.DOCKER;

// Set log level
const logLevel = {
  showProgress: !isProduction || process.env.SEED_VERBOSE === 'true',
};

const prisma = new PrismaClient({
  log: isProduction ? ['error'] : ['query', 'info', 'warn'],
});

async function seed() {
  // Environment info log
  console.log('Seeding started (Quick Mode)...');
  console.log(`Environment: ${isProduction ? 'Production' : 'Development'}${isDokploy ? ' (Dokploy)' : ''}`);
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log('─'.repeat(50));

  try {
    // Check if data already exists
    const userCount = await prisma.user.count();
    if (userCount > 0) {
      console.log(`Database already has ${userCount} users, skipping seed`);
      console.log('Quick seed completed (data already exists)');
      return;
    }

    if (logLevel.showProgress) {
      console.log('Starting quick mock data seeding...\n');
    }

    // Create users
    console.log('Creating test users...');
    const users = [
      { email: 'admin@chat.com', password: 'admin123', name: 'Admin', role: 'owner' },
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
      console.log(`  - ${user.displayName}`);
    }

    // Create team members
    for (const user of createdUsers) {
      await prisma.teamMember.create({
        data: {
          userId: user.id,
          role: user.email === 'admin@chat.com' ? 'owner' : 'member',
        },
      });
    }

    // Create channels
    console.log('\nCreating channels...');
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
      console.log(`  - #${channel.name}`);

      // Add users to channels
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

    // Create messages
    console.log('\nCreating sample messages...');
    const messages = [
      { content: 'Welcome to the chat!', channel: 'general' },
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

    // Create notification settings
    for (const user of createdUsers) {
      await prisma.notificationSettings.create({
        data: { userId: user.id },
      });
    }

    console.log('\nMock data seeding completed!');
    console.log('\nTest accounts:');
    console.log('  admin@chat.com / admin123');
    console.log('  alice@chat.com / password123');
    console.log('  bob@chat.com / password123');
    console.log('  charlie@chat.com / password123');
    console.log('  diana@chat.com / password123');

  } catch (error) {
    console.error('\nSeeding failed:', error);
    console.error('Stack trace:', error instanceof Error ? error.stack : 'Unknown error');
    throw error;
  } finally {
    await prisma.$disconnect();
    console.log('Database disconnected');
    console.log('Quick seed completed successfully');
  }
}

seed();
