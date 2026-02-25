#!/usr/bin/env node

/**
 * 数据库调试脚本
 *
 * 检查数据库连接、表结构、测试数据等
 */

const { PrismaClient } = require('@prisma/client');

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(color, message) {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logStep(step, message) {
  console.log(`\n${colors.cyan}[${step}]${colors.reset} ${message}`);
}

async function checkDatabaseConnection() {
  logStep('1', 'Checking database connection...');

  const prisma = new PrismaClient();

  try {
    await prisma.$connect();
    log('green', 'Database connection successful');

    const version = await prisma.$queryRaw`SELECT version()`;
    console.log(`   Database version: ${version[0].version}`);

    return prisma;
  } catch (error) {
    log('red', `Database connection failed: ${error.message}`);
    console.error(error);
    process.exit(1);
  }
}

async function checkTables(prisma) {
  logStep('2', 'Checking data tables...');

  try {
    // 检查用户表
    const users = await prisma.user.findMany({ take: 1 });
    log('green', `users table exists, record count: ${await prisma.user.count()}`);

    // 检查频道表
    const channels = await prisma.channel.findMany({ take: 1 });
    log('green', `channels table exists, record count: ${await prisma.channel.count()}`);

    // 检查频道成员表
    const channelMembers = await prisma.channelMember.findMany({ take: 1 });
    log('green', `channel_members table exists, record count: ${await prisma.channelMember.count()}`);

    // 检查私聊表
    const dmConversations = await prisma.dMConversation.findMany({ take: 1 });
    log('green', `dm_conversations table exists, record count: ${await prisma.dMConversation.count()}`);

    // 检查私聊成员表
    const dmMembers = await prisma.dMConversationMember.findMany({ take: 1 });
    log('green', `dm_conversation_members table exists, record count: ${await prisma.dMConversationMember.count()}`);

    // 检查消息表
    const messages = await prisma.message.findMany({ take: 1 });
    log('green', `messages table exists, record count: ${await prisma.message.count()}`);

  } catch (error) {
    log('red', `Data table check failed: ${error.message}`);
    console.error(error);
  }
}

async function checkSampleData(prisma) {
  logStep('3', 'Checking sample data...');

  try {
    const userCount = await prisma.user.count();
    log(userCount > 0 ? 'green' : 'yellow',
      `Users: ${userCount} ${userCount === 0 ? '(need to add test users)' : ''}`);

    const channelCount = await prisma.channel.count();
    log(channelCount > 0 ? 'green' : 'yellow',
      `Channels: ${channelCount} ${channelCount === 0 ? '(need to add test channels)' : ''}`);

    const dmCount = await prisma.dMConversation.count();
    log(dmCount >= 0 ? 'green' : 'yellow',
      `DMs: ${dmCount}`);

    const messageCount = await prisma.message.count();
    log(messageCount > 0 ? 'green' : 'yellow',
      `Messages: ${messageCount} ${messageCount === 0 ? '(can send test messages)' : ''}`);

    if (userCount > 0) {
      const user = await prisma.user.findFirst();
      console.log(`\nExample user:`);
      console.log(`   ID: ${user.id}`);
      console.log(`   Email: ${user.email}`);
      console.log(`   Display name: ${user.displayName}`);
      console.log(`   Online: ${user.isOnline}`);
    }

    if (channelCount > 0) {
      const channel = await prisma.channel.findFirst();
      console.log(`\nExample channel:`);
      console.log(`   ID: ${channel.id}`);
      console.log(`   Name: ${channel.name}`);
      console.log(`   Private: ${channel.isPrivate}`);
    }

  } catch (error) {
    log('red', `Sample data check failed: ${error.message}`);
  }
}

async function checkRelationships(prisma) {
  logStep('4', 'Checking data relationships...');

  try {
    // 检查频道成员关系
    const channelMemberCount = await prisma.channelMember.count();
    const channelCount = await prisma.channel.count();
    const userCount = await prisma.user.count();

    if (channelMemberCount > 0) {
      const member = await prisma.channelMember.findFirst({
        include: { user: true, channel: true }
      });
      console.log(`\nChannel member example:`);
      console.log(`   User: ${member.user.displayName} (${member.user.email})`);
      console.log(`   Channel: ${member.channel.name}`);
      console.log(`   Role: ${member.role}`);
    }

    // 检查私聊成员关系
    const dmMemberCount = await prisma.dMConversationMember.count();

    if (dmMemberCount > 0) {
      const member = await prisma.dMConversationMember.findFirst({
        include: { user: true, conversation: true }
      });
      console.log(`\nDM member example:`);
      console.log(`   User: ${member.user.displayName} (${member.user.email})`);
      console.log(`   Conversation ID: ${member.conversationId}`);
    }

  } catch (error) {
    log('red', `Relationship check failed: ${error.message}`);
  }
}

async function checkMessages(prisma) {
  logStep('5', 'Checking message data...');

  try {
    const messageCount = await prisma.message.count();

    if (messageCount > 0) {
      const message = await prisma.message.findFirst({
        include: { user: true }
      });
      console.log(`\nExample message:`);
      console.log(`   ID: ${message.id}`);
      console.log(`   Content: ${message.content.substring(0, 50)}...`);
      console.log(`   Sender: ${message.user.displayName}`);
      console.log(`   Type: ${message.messageType}`);
      console.log(`   Channel ID: ${message.channelId || 'N/A'}`);
      console.log(`   DM ID: ${message.dmConversationId || 'N/A'}`);
      console.log(`   Created at: ${message.createdAt}`);

      // 检查消息关联
      if (message.channelId) {
        const channel = await prisma.channel.findUnique({
          where: { id: message.channelId }
        });
        console.log(`   Channel: ${channel?.name || 'unknown'}`);
      }

      if (message.dmConversationId) {
        const dm = await prisma.dMConversation.findUnique({
          where: { id: message.dmConversationId }
        });
        console.log(`   DM: ${dm ? 'exists' : 'unknown'}`);
      }
    }

  } catch (error) {
    log('red', `Message check failed: ${error.message}`);
  }
}

async function generateTestToken(prisma) {
  logStep('6', 'Generating test data...');

  try {
    const userCount = await prisma.user.count();

    if (userCount === 0) {
      log('yellow', 'No user data available to generate test token');
      return null;
    }

    const user = await prisma.user.findFirst();
    const jwt = require('jsonwebtoken');

    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '1h' }
    );

    console.log(`\nTest token:`);
    console.log(`   User: ${user.displayName} (${user.email})`);
    console.log(`   Token: ${token}`);
    console.log(`   \nRun debug with this token:`);
    console.log(`   DEBUG_TOKEN="${token}" node scripts/debug-socket.js`);

    return token;

  } catch (error) {
    log('red', `Failed to generate test data: ${error.message}`);
    return null;
  }
}

async function suggestActions(prisma) {
  logStep('7', 'Suggested actions...');

  const userCount = await prisma.user.count();
  const channelCount = await prisma.channel.count();
  const dmCount = await prisma.dMConversation.count();

  console.log('\nSuggested actions:');

  if (userCount === 0) {
    console.log('1. Run database seed: npm run db:seed');
  }

  if (channelCount === 0) {
    console.log('2. Create test channels');
  }

  if (dmCount === 0) {
    console.log('3. Create test DMs');
  }

  console.log('4. Login to get token');
  console.log('5. Run Socket debug: node scripts/debug-socket.js');
}

async function main() {
  console.log('='.repeat(50));
  console.log('Database Debug Tool');
  console.log('='.repeat(50));

  const prisma = await checkDatabaseConnection();

  await checkTables(prisma);
  await checkSampleData(prisma);
  await checkRelationships(prisma);
  await checkMessages(prisma);
  await generateTestToken(prisma);
  await suggestActions(prisma);

  await prisma.$disconnect();

  console.log('\n' + '='.repeat(50));
  console.log('Database check completed');
  console.log('='.repeat(50));

  process.exit(0);
}

// 错误处理
process.on('unhandledRejection', (error) => {
  log('red', `\nUnhandled error: ${error.message}`);
  console.error(error);
  process.exit(1);
});

main().catch((error) => {
  log('red', `\nProgram error: ${error.message}`);
  console.error(error);
  process.exit(1);
});
