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
  logStep('1', '检查数据库连接...');

  const prisma = new PrismaClient();

  try {
    await prisma.$connect();
    log('green', '✅ 数据库连接成功');

    const version = await prisma.$queryRaw`SELECT version()`;
    console.log(`   数据库版本: ${version[0].version}`);

    return prisma;
  } catch (error) {
    log('red', `❌ 数据库连接失败: ${error.message}`);
    console.error(error);
    process.exit(1);
  }
}

async function checkTables(prisma) {
  logStep('2', '检查数据表...');

  try {
    // 检查用户表
    const users = await prisma.user.findMany({ take: 1 });
    log('green', `✅ users 表存在，记录数: ${await prisma.user.count()}`);

    // 检查频道表
    const channels = await prisma.channel.findMany({ take: 1 });
    log('green', `✅ channels 表存在，记录数: ${await prisma.channel.count()}`);

    // 检查频道成员表
    const channelMembers = await prisma.channelMember.findMany({ take: 1 });
    log('green', `✅ channel_members 表存在，记录数: ${await prisma.channelMember.count()}`);

    // 检查私聊表
    const dmConversations = await prisma.dMConversation.findMany({ take: 1 });
    log('green', `✅ dm_conversations 表存在，记录数: ${await prisma.dMConversation.count()}`);

    // 检查私聊成员表
    const dmMembers = await prisma.dMConversationMember.findMany({ take: 1 });
    log('green', `✅ dm_conversation_members 表存在，记录数: ${await prisma.dMConversationMember.count()}`);

    // 检查消息表
    const messages = await prisma.message.findMany({ take: 1 });
    log('green', `✅ messages 表存在，记录数: ${await prisma.message.count()}`);

  } catch (error) {
    log('red', `❌ 数据表检查失败: ${error.message}`);
    console.error(error);
  }
}

async function checkSampleData(prisma) {
  logStep('3', '检查示例数据...');

  try {
    const userCount = await prisma.user.count();
    log(userCount > 0 ? 'green' : 'yellow',
      `👤 用户数: ${userCount} ${userCount === 0 ? '(需要添加测试用户)' : ''}`);

    const channelCount = await prisma.channel.count();
    log(channelCount > 0 ? 'green' : 'yellow',
      `📢 频道数: ${channelCount} ${channelCount === 0 ? '(需要添加测试频道)' : ''}`);

    const dmCount = await prisma.dMConversation.count();
    log(dmCount >= 0 ? 'green' : 'yellow',
      `💬 私聊数: ${dmCount}`);

    const messageCount = await prisma.message.count();
    log(messageCount > 0 ? 'green' : 'yellow',
      `📝 消息数: ${messageCount} ${messageCount === 0 ? '(可以发送测试消息)' : ''}`);

    if (userCount > 0) {
      const user = await prisma.user.findFirst();
      console.log(`\n👤 示例用户:`);
      console.log(`   ID: ${user.id}`);
      console.log(`   邮箱: ${user.email}`);
      console.log(`   显示名: ${user.displayName}`);
      console.log(`   在线: ${user.isOnline}`);
    }

    if (channelCount > 0) {
      const channel = await prisma.channel.findFirst();
      console.log(`\n📢 示例频道:`);
      console.log(`   ID: ${channel.id}`);
      console.log(`   名称: ${channel.name}`);
      console.log(`   私有: ${channel.isPrivate}`);
    }

  } catch (error) {
    log('red', `❌ 示例数据检查失败: ${error.message}`);
  }
}

async function checkRelationships(prisma) {
  logStep('4', '检查数据关联...');

  try {
    // 检查频道成员关系
    const channelMemberCount = await prisma.channelMember.count();
    const channelCount = await prisma.channel.count();
    const userCount = await prisma.user.count();

    if (channelMemberCount > 0) {
      const member = await prisma.channelMember.findFirst({
        include: { user: true, channel: true }
      });
      console.log(`\n👤 频道成员示例:`);
      console.log(`   用户: ${member.user.displayName} (${member.user.email})`);
      console.log(`   频道: ${member.channel.name}`);
      console.log(`   角色: ${member.role}`);
    }

    // 检查私聊成员关系
    const dmMemberCount = await prisma.dMConversationMember.count();

    if (dmMemberCount > 0) {
      const member = await prisma.dMConversationMember.findFirst({
        include: { user: true, conversation: true }
      });
      console.log(`\n💬 私聊成员示例:`);
      console.log(`   用户: ${member.user.displayName} (${member.user.email})`);
      console.log(`   会话 ID: ${member.conversationId}`);
    }

  } catch (error) {
    log('red', `❌ 关联检查失败: ${error.message}`);
  }
}

async function checkMessages(prisma) {
  logStep('5', '检查消息数据...');

  try {
    const messageCount = await prisma.message.count();

    if (messageCount > 0) {
      const message = await prisma.message.findFirst({
        include: { user: true }
      });
      console.log(`\n📝 示例消息:`);
      console.log(`   ID: ${message.id}`);
      console.log(`   内容: ${message.content.substring(0, 50)}...`);
      console.log(`   发送者: ${message.user.displayName}`);
      console.log(`   类型: ${message.messageType}`);
      console.log(`   频道 ID: ${message.channelId || 'N/A'}`);
      console.log(`   私聊 ID: ${message.dmConversationId || 'N/A'}`);
      console.log(`   创建时间: ${message.createdAt}`);

      // 检查消息关联
      if (message.channelId) {
        const channel = await prisma.channel.findUnique({
          where: { id: message.channelId }
        });
        console.log(`   频道: ${channel?.name || '未知'}`);
      }

      if (message.dmConversationId) {
        const dm = await prisma.dMConversation.findUnique({
          where: { id: message.dmConversationId }
        });
        console.log(`   私聊: ${dm ? '存在' : '未知'}`);
      }
    }

  } catch (error) {
    log('red', `❌ 消息检查失败: ${error.message}`);
  }
}

async function generateTestToken(prisma) {
  logStep('6', '生成测试数据...');

  try {
    const userCount = await prisma.user.count();

    if (userCount === 0) {
      log('yellow', '⚠️  没有用户数据，无法生成测试 token');
      return null;
    }

    const user = await prisma.user.findFirst();
    const jwt = require('jsonwebtoken');

    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '1h' }
    );

    console.log(`\n🔑 测试 token:`);
    console.log(`   用户: ${user.displayName} (${user.email})`);
    console.log(`   Token: ${token}`);
    console.log(`   \n使用此 token 运行调试:`);
    console.log(`   DEBUG_TOKEN="${token}" node scripts/debug-socket.js`);

    return token;

  } catch (error) {
    log('red', `❌ 生成测试数据失败: ${error.message}`);
    return null;
  }
}

async function suggestActions(prisma) {
  logStep('7', '建议操作...');

  const userCount = await prisma.user.count();
  const channelCount = await prisma.channel.count();
  const dmCount = await prisma.dMConversation.count();

  console.log('\n📋 建议操作:');

  if (userCount === 0) {
    console.log('1. 运行数据库种子: npm run db:seed');
  }

  if (channelCount === 0) {
    console.log('2. 创建测试频道');
  }

  if (dmCount === 0) {
    console.log('3. 创建测试私聊');
  }

  console.log('4. 登录用户获取 token');
  console.log('5. 运行 Socket 调试: node scripts/debug-socket.js');
}

async function main() {
  console.log('='.repeat(50));
  console.log('数据库调试工具');
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
  console.log('✅ 数据库检查完成');
  console.log('='.repeat(50));

  process.exit(0);
}

// 错误处理
process.on('unhandledRejection', (error) => {
  log('red', `\n💥 未处理的错误: ${error.message}`);
  console.error(error);
  process.exit(1);
});

main().catch((error) => {
  log('red', `\n💥 程序错误: ${error.message}`);
  console.error(error);
  process.exit(1);
});
