/**
 * Slack数据导入脚本
 * 将抓取的Slack数据导入到本地数据库
 *
 * 使用方法:
 * 1. 先运行 slack-scraper.ts 获取数据
 * 2. 设置环境变量 DATABASE_URL
 * 3. 运行: npx ts-node scripts/import-slack-data.ts
 */

import { PrismaClient, Prisma } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import * as bcrypt from 'bcryptjs';

// ES模块兼容的__dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 配置
const INPUT_FILE = path.join(__dirname, 'slack-data.json');
const DEFAULT_PASSWORD = 'password123'; // 默认密码

interface SlackUser {
  id: string;
  name: string;
  real_name: string;
  profile: {
    display_name: string;
    real_name: string;
    image_72: string;
    status_text?: string;
  };
  is_bot: boolean;
  deleted: boolean;
}

interface SlackChannel {
  id: string;
  name: string;
  purpose: { value: string };
  topic: { value: string };
  num_members: number;
  is_private: boolean;
  is_archived: boolean;
}

interface SlackMessage {
  type: string;
  subtype?: string;
  ts: string;
  user: string;
  text: string;
  files?: any[];
  thread_ts?: string;
  reply_count?: number;
  edited?: {
    user: string;
    ts: string;
  };
}

interface SlackData {
  exportedAt: string;
  users: SlackUser[];
  channels: SlackChannel[];
  messages: Record<string, SlackMessage[]>;
  metadata: {
    totalUsers: number;
    totalChannels: number;
    totalMessages: number;
  };
}

const prisma = new PrismaClient({
  log: ['info', 'warn', 'error'],
});

// 映射表
interface UserMapping {
  slackUserId: string;
  localUserId: string;
  slackUserName: string;
}

interface ChannelMapping {
  slackChannelId: string;
  localChannelId: string;
  slackChannelName: string;
}

// 转换Slack时间戳为Date
function slackTimestampToDate(ts: string): Date {
  return new Date(parseFloat(ts) * 1000);
}

// 生成随机ID
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// 导入用户（追加模式）
async function importUsers(slackData: SlackData): Promise<UserMapping[]> {
  console.log('👥 导入用户（追加模式）...');

  const userMappings: UserMapping[] = [];
  let newUserCount = 0;
  let existUserCount = 0;

  for (const slackUser of slackData.users) {
    try {
      const email = `${slackUser.name}@slack-import.local`;

      // 检查用户是否已存在
      const existingUser = await prisma.user.findUnique({
        where: { email }
      });

      if (existingUser) {
        userMappings.push({
          slackUserId: slackUser.id,
          localUserId: existingUser.id,
          slackUserName: slackUser.name,
        });
        existUserCount++;
        continue;
      }

      const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);

      const user = await prisma.user.create({
        data: {
          email,
          passwordHash,
          displayName: slackUser.profile.display_name || slackUser.name,
          realName: slackUser.profile.real_name || slackUser.real_name || slackUser.name,
          avatarUrl: slackUser.profile.image_72 || null,
          emailVerifiedAt: new Date(),
        },
      });

      userMappings.push({
        slackUserId: slackUser.id,
        localUserId: user.id,
        slackUserName: slackUser.name,
      });

      newUserCount++;
      console.log(`   ✓ 新用户: ${slackUser.profile.display_name || slackUser.name}`);
    } catch (error: any) {
      console.error(`   ✗ 导入用户失败: ${slackUser.name}`, error.message);
    }
  }

  console.log(`   - 新增用户: ${newUserCount}`);
  console.log(`   - 现有用户: ${existUserCount}`);
  return userMappings;
}

// 导入频道（追加模式）
async function importChannels(
  slackData: SlackData,
  userMappings: UserMapping[]
): Promise<ChannelMapping[]> {
  console.log('');
  console.log('📢 导入频道（追加模式）...');

  const channelMappings: ChannelMapping[] = [];
  const ownerId = userMappings[0]?.localUserId;

  if (!ownerId) {
    throw new Error('没有可用的用户来创建频道');
  }

  let newChannelCount = 0;
  let existChannelCount = 0;

  for (const slackChannel of slackData.channels) {
    try {
      // 跳过私人频道
      if (slackChannel.is_private) {
        continue;
      }

      // 检查频道是否已存在
      const existingChannel = await prisma.channel.findUnique({
        where: { name: slackChannel.name }
      });

      if (existingChannel) {
        channelMappings.push({
          slackChannelId: slackChannel.id,
          localChannelId: existingChannel.id,
          slackChannelName: slackChannel.name,
        });
        existChannelCount++;
        continue;
      }

      const channel = await prisma.channel.create({
        data: {
          name: slackChannel.name,
          description: slackChannel.purpose?.value || slackChannel.topic?.value || '',
          isPrivate: false,
          isArchived: slackChannel.is_archived,
          createdById: ownerId,
        },
      });

      channelMappings.push({
        slackChannelId: slackChannel.id,
        localChannelId: channel.id,
        slackChannelName: slackChannel.name,
      });

      // 将所有用户添加到频道
      for (const mapping of userMappings) {
        await prisma.channelMember.create({
          data: {
            channelId: channel.id,
            userId: mapping.localUserId,
            role: 'member',
          },
        });
      }

      newChannelCount++;
      console.log(`   ✓ 新频道: #${slackChannel.name}`);
    } catch (error: any) {
      console.error(`   ✗ 导入频道失败: #${slackChannel.name}`, error.message);
    }
  }

  console.log(`   - 新增频道: ${newChannelCount}`);
  console.log(`   - 现有频道: ${existChannelCount}`);
  return channelMappings;
}

// 导入消息（追加模式）
async function importMessages(
  slackData: SlackData,
  userMappings: UserMapping[],
  channelMappings: ChannelMapping[]
) {
  console.log('');
  console.log('💬 导入消息（追加模式）...');

  // 创建映射查找表
  const userIdMap = new Map(userMappings.map(m => [m.slackUserId, m.localUserId]));
  const channelIdMap = new Map(channelMappings.map(m => [m.slackChannelId, m.localChannelId]));

  // 创建时间戳到本地消息ID的映射，用于处理线程
  const tsToLocalId = new Map<string, string>();

  let totalImported = 0;
  let totalSkipped = 0;
  let duplicateSkipped = 0;

  // 先按时间顺序导入所有消息（不包括线程回复）
  for (const slackChannel of slackData.channels) {
    const localChannelId = channelIdMap.get(slackChannel.id);
    if (!localChannelId) continue;

    const messages = slackData.messages[slackChannel.id] || [];

    // 按时间戳排序
    messages.sort((a, b) => parseFloat(a.ts) - parseFloat(b.ts));

    for (const slackMsg of messages) {
      try {
        // 跳过系统消息（但保留file_share类型的用户上传文件消息）
        if (slackMsg.subtype && !['file_share', 'thread_broadcast'].includes(slackMsg.subtype)) {
          if (slackMsg.subtype !== 'bot_message') {
            totalSkipped++;
          }
          continue;
        }

        // 跳过没有用户的消息（除非是文件分享消息）
        if (!slackMsg.user && slackMsg.subtype !== 'file_share') {
          totalSkipped++;
          continue;
        }

        let localUserId = slackMsg.user ? userIdMap.get(slackMsg.user) : null;

        // 如果是文件分享消息，尝试找第一个用户作为替代
        if (!localUserId && slackMsg.subtype === 'file_share') {
          localUserId = userMappings[0]?.localUserId;
        }

        if (!localUserId) {
          totalSkipped++;
          continue;
        }

        // 检查消息是否已存在（通过时间和用户判断）
        const msgCreatedAt = slackTimestampToDate(slackMsg.ts);
        const existingMessage = await prisma.message.findFirst({
          where: {
            channelId: localChannelId,
            userId: localUserId,
            createdAt: msgCreatedAt,
          }
        });

        if (existingMessage) {
          tsToLocalId.set(`${slackChannel.id}-${slackMsg.ts}`, existingMessage.id);
          duplicateSkipped++;
          continue;
        }

        // 判断是否为线程根消息
        const isThreadRoot = !!(slackMsg.thread_ts && slackMsg.ts === slackMsg.thread_ts);

        const message = await prisma.message.create({
          data: {
            content: slackMsg.text || '',
            messageType: 'text',
            channelId: localChannelId,
            userId: localUserId,
            createdAt: msgCreatedAt,
            isEdited: !!slackMsg.edited,
            isThreadRoot: isThreadRoot || false,
            // parentMessageId稍后处理
          },
        });

        // 存储时间戳到本地ID的映射
        tsToLocalId.set(`${slackChannel.id}-${slackMsg.ts}`, message.id);

        totalImported++;

        if (totalImported % 100 === 0) {
          console.log(`   已导入 ${totalImported} 条消息...`);
        }
      } catch (error: any) {
        if (error.code !== 'P2002') {
          totalSkipped++;
        }
      }
    }
  }

  console.log(`   ✓ 第一轮导入完成，共 ${totalImported} 条消息`);

  // 第二轮：处理线程关系
  console.log('   正在处理线程关系...');
  let threadCount = 0;

  for (const slackChannel of slackData.channels) {
    const localChannelId = channelIdMap.get(slackChannel.id);
    if (!localChannelId) continue;

    const messages = slackData.messages[slackChannel.id] || [];

    for (const slackMsg of messages) {
      // 只有当消息是线程回复时才处理
      if (!slackMsg.thread_ts || slackMsg.ts === slackMsg.thread_ts) continue;

      const localMessageId = tsToLocalId.get(`${slackChannel.id}-${slackMsg.ts}`);
      const parentMessageId = tsToLocalId.get(`${slackChannel.id}-${slackMsg.thread_ts}`);

      if (localMessageId && parentMessageId) {
        try {
          // 检查是否已经设置了parentMessageId
          const message = await prisma.message.findUnique({
            where: { id: localMessageId }
          });

          if (message && message.parentMessageId) {
            continue; // 已处理过
          }

          await prisma.message.update({
            where: { id: localMessageId },
            data: {
              parentMessageId,
              isThreadRoot: false,
            },
          });

          // 更新父消息的回复计数
          await prisma.message.update({
            where: { id: parentMessageId },
            data: {
              threadReplyCount: { increment: 1 },
              lastReplyAt: slackTimestampToDate(slackMsg.ts),
            },
          });

          threadCount++;
        } catch (error) {
          // 忽略更新错误
        }
      }
    }
  }

  console.log(`   ✓ 处理了 ${threadCount} 个线程回复`);

  console.log(`   ✓ 新增消息: ${totalImported}`);
  console.log(`   ⏭ 跳过重复消息: ${duplicateSkipped}`);
  console.log(`   ⏭ 跳过其他: ${totalSkipped}`);
}

// 主函数
async function main() {
  console.log('📥 Slack数据导入工具（追加模式）');
  console.log('='.repeat(50));

  // 1. 检查输入文件
  if (!fs.existsSync(INPUT_FILE)) {
    console.error(`❌ 错误: 找不到数据文件 ${INPUT_FILE}`);
    console.log('   请先运行: npx tsx scripts/slack-scraper.ts');
    process.exit(1);
  }

  // 2. 读取数据
  console.log(`📂 读取数据文件: ${INPUT_FILE}`);
  const fileContent = fs.readFileSync(INPUT_FILE, 'utf-8');
  const slackData: SlackData = JSON.parse(fileContent);

  console.log('');
  console.log('📊 数据概览:');
  console.log(`   - 用户: ${slackData.metadata.totalUsers}`);
  console.log(`   - 频道: ${slackData.metadata.totalChannels}`);
  console.log(`   - 消息: ${slackData.metadata.totalMessages}`);
  console.log('');

  // 3. 导入用户（追加模式）
  const userMappings = await importUsers(slackData);

  if (userMappings.length === 0) {
    console.log('❌ 没有可用的用户，请先确保用户导入成功');
    process.exit(1);
  }

  // 4. 创建团队成员关系（追加模式）
  console.log('');
  console.log('👨‍👩‍👧‍👦 创建团队成员关系（追加模式）...');
  const users = await prisma.user.findMany();
  let newTeamMemberCount = 0;

  for (const user of users) {
    const existingMember = await prisma.teamMember.findUnique({
      where: { userId: user.id }
    });

    if (!existingMember) {
      await prisma.teamMember.create({
        data: {
          userId: user.id,
          role: user.email.includes('admin') ? 'owner' : 'member',
        },
      });
      newTeamMemberCount++;
    }
  }
  console.log(`   - 新增团队成员: ${newTeamMemberCount}`);

  // 5. 导入频道（追加模式）
  const channelMappings = await importChannels(slackData, userMappings);

  // 6. 导入消息（追加模式）
  await importMessages(slackData, userMappings, channelMappings);

  // 7. 创建通知设置（追加模式）
  console.log('');
  console.log('🔔 创建通知设置（追加模式）...');
  let newNotificationSettingsCount = 0;

  for (const user of users) {
    const existingSettings = await prisma.notificationSettings.findUnique({
      where: { userId: user.id }
    });

    if (!existingSettings) {
      await prisma.notificationSettings.create({
        data: {
          userId: user.id,
        },
      });
      newNotificationSettingsCount++;
    }
  }
  console.log(`   - 新增通知设置: ${newNotificationSettingsCount}`);

  // 8. 统计
  console.log('');
  console.log('='.repeat(50));
  console.log('✅ 追加导入完成!');
  console.log('');
  console.log('📊 当前数据库统计:');
  console.log(`   - 用户: ${await prisma.user.count()}`);
  console.log(`   - 频道: ${await prisma.channel.count()}`);
  console.log(`   - 消息: ${await prisma.message.count()}`);
  console.log('');
  console.log('🔑 Slack导入用户测试账户:');
  console.log(`   密码统一为: ${DEFAULT_PASSWORD}`);
  console.log(`   邮箱格式: {username}@slack-import.local`);

  await prisma.$disconnect();
}

main()
  .catch((e) => {
    console.error('❌ 导入失败:', e);
    process.exit(1);
  });
