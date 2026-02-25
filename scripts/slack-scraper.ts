/**
 * Slack数据抓取脚本
 * 用于从Slack工作区抓取公开频道、用户和消息数据
 *
 * 使用方法:
 * 1. 设置环境变量 SLACK_USER_TOKEN
 * 2. 运行: npx ts-node scripts/slack-scraper.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// ES模块兼容的__dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Slack API配置
const SLACK_TOKEN = process.env.SLACK_USER_TOKEN;
const OUTPUT_FILE = path.join(__dirname, 'slack-data.json');

if (!SLACK_TOKEN) {
  console.error('Error: Please set SLACK_USER_TOKEN environment variable');
  console.log('   Example: SLACK_USER_TOKEN=xoxe-xxx npx tsx scripts/slack-scraper.ts');
  process.exit(1);
}

interface SlackUser {
  id: string;
  name: string;
  real_name: string;
  profile: {
    display_name: string;
    real_name: string;
    image_72: string;
    status_text?: string;
    status_emoji?: string;
  };
  is_bot: boolean;
  deleted: boolean;
}

interface SlackChannel {
  id: string;
  name: string;
  purpose: {
    value: string;
    creator: string;
    last_set: number;
  };
  topic: {
    value: string;
    creator: string;
    last_set: number;
  };
  num_members: number;
  is_private: boolean;
  is_archived: boolean;
  is_channel: boolean;
  is_group: boolean;
  is_im: boolean;
  is_mpim: boolean;
}

interface SlackMessage {
  type: string;
  subtype?: string;
  ts: string;
  user: string;
  text: string;
  files?: SlackFile[];
  attachments?: SlackAttachment[];
  reactions?: SlackReaction[];
  thread_ts?: string;
  reply_count?: number;
  reply_users_count?: number;
  latest_reply?: string;
  is_locked?: boolean;
  edited?: {
    user: string;
    ts: string;
  };
}

interface SlackFile {
  id: string;
  name: string;
  mimetype: string;
  filetype: string;
  url_private: string;
  url_private_download: string;
  thumbnail_url?: string;
  image_exif?: number;
  width?: number;
  height?: number;
  size?: number;
}

interface SlackAttachment {
  id: string;
  fallback: string;
  color?: string;
  pretext?: string;
  author_name?: string;
  author_link?: string;
  author_icon?: string;
  title?: string;
  title_link?: string;
  text?: string;
  image_url?: string;
  image_width?: number;
  image_height?: number;
  image_bytes?: number;
  thumb_url?: string;
  thumb_width?: number;
  thumb_height?: number;
}

interface SlackReaction {
  name: string;
  count: number;
  users: string[];
}

interface SlackData {
  exportedAt: string;
  teamId?: string;
  users: SlackUser[];
  channels: SlackChannel[];
  messages: Record<string, SlackMessage[]>;
  metadata: {
    totalUsers: number;
    totalChannels: number;
    totalMessages: number;
  };
}

// Slack API调用封装
async function slackApiCall<T>(method: string, params: Record<string, string | number | boolean> = {}): Promise<T> {
  const url = `https://slack.com/api/${method}`;

  // xoxe token 需要使用 form-urlencoded 格式
  const formData = new URLSearchParams();
  formData.append('token', SLACK_TOKEN!);
  for (const [key, value] of Object.entries(params)) {
    formData.append(key, String(value));
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: formData.toString(),
  });

  const data = await response.json() as T & { ok: boolean; error?: string };

  if (!data.ok) {
    throw new Error(`Slack API error: ${data.error || 'Unknown error'}`);
  }

  return data;
}

// 获取用户列表
async function fetchUsers(): Promise<SlackUser[]> {
  console.log('Fetching user list...');
  const users: SlackUser[] = [];
  let cursor: string | undefined;

  do {
    const response = await slackApiCall<{
      members: SlackUser[];
      response_metadata?: { next_cursor: string };
    }>('users.list', {
      limit: 200,
      cursor: cursor || '',
    });

    const validUsers = response.members.filter(u => !u.deleted && !u.is_bot);
    users.push(...validUsers);
    cursor = response.response_metadata?.next_cursor;

    console.log(`   Fetched ${users.length} users...`);
  } while (cursor);

  console.log(`Total: ${users.length} valid users fetched`);
  return users;
}

// 获取频道列表
async function fetchChannels(): Promise<SlackChannel[]> {
  console.log('Fetching channel list...');
  const channels: SlackChannel[] = [];
  let cursor: string | undefined;

  do {
    const response = await slackApiCall<{
      channels: SlackChannel[];
      response_metadata?: { next_cursor: string };
    }>('conversations.list', {
      types: 'public_channel',
      limit: 200,
      cursor: cursor || '',
    });

    channels.push(...response.channels);
    cursor = response.response_metadata?.next_cursor;

    console.log(`   Fetched ${channels.length} channels...`);
  } while (cursor);

  console.log(`Total: ${channels.length} channels fetched`);
  return channels;
}

// 获取频道消息历史
async function fetchChannelHistory(channelId: string, channelName: string): Promise<SlackMessage[]> {
  const messages: SlackMessage[] = [];
  let cursor: string | undefined;
  let hasMore = true;
  let latestTimestamp = Math.floor(Date.now() / 1000);

  // 限制获取的消息数量，避免耗时过长
  const MAX_MESSAGES_PER_CHANNEL = 1000;
  const MAX_PAGES = 10;

  let pageCount = 0;

  while (hasMore && messages.length < MAX_MESSAGES_PER_CHANNEL && pageCount < MAX_PAGES) {
    pageCount++;

    try {
      const response = await slackApiCall<{
        messages: SlackMessage[];
        has_more: boolean;
        response_metadata?: { next_cursor: string };
      }>('conversations.history', {
        channel: channelId,
        limit: 200,
        cursor: cursor || '',
        latest: latestTimestamp,
      });

      if (response.messages.length === 0) {
        hasMore = false;
        break;
      }

      messages.push(...response.messages);
      hasMore = response.has_more;
      cursor = response.response_metadata?.next_cursor;

      // 更新latest为最后一条消息的时间戳
      const lastMsg = response.messages[response.messages.length - 1];
      if (lastMsg) {
        latestTimestamp = parseFloat(lastMsg.ts) - 1;
      }

      console.log(`   [${channelName}] Fetched ${messages.length} messages...`);
    } catch (error) {
      console.error(`   [${channelName}] Failed to fetch messages:`, error);
      hasMore = false;
    }
  }

  return messages;
}

// 等待指定时间（处理速率限制）
async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 主函数
async function main() {
  console.log('Slack Data Scraper');
  console.log('='.repeat(50));
  console.log(`Start time: ${new Date().toISOString()}`);
  console.log('');

  try {
    // 1. 获取用户列表
    const users = await fetchUsers();

    // 2. 获取频道列表
    const channels = await fetchChannels();

    // 3. 获取每个频道的消息
    console.log('');
    console.log('Fetching channel messages...');
    const messages: Record<string, SlackMessage[]> = {};

    for (let i = 0; i < channels.length; i++) {
      const channel = channels[i];
      console.log(`[${i + 1}/${channels.length}] Processing channel #${channel.name}...`);

      try {
        const channelMessages = await fetchChannelHistory(channel.id, channel.name);
        messages[channel.id] = channelMessages;

        // 礼貌性等待，避免触发速率限制
        if (i < channels.length - 1) {
          await sleep(200);
        }
      } catch (error) {
        console.error(`   Failed to fetch #${channel.name} messages:`, error);
        messages[channel.id] = [];
      }
    }

    // 4. 汇总数据
    const totalMessages = Object.values(messages).reduce((sum, msgs) => sum + msgs.length, 0);

    const slackData: SlackData = {
      exportedAt: new Date().toISOString(),
      users,
      channels,
      messages,
      metadata: {
        totalUsers: users.length,
        totalChannels: channels.length,
        totalMessages,
      },
    };

    // 5. 保存到文件
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(slackData, null, 2), 'utf-8');

    console.log('');
    console.log('='.repeat(50));
    console.log('Data scraping completed!');
    console.log('');
    console.log('Statistics:');
    console.log(`   - Users: ${users.length}`);
    console.log(`   - Channels: ${channels.length}`);
    console.log(`   - Messages: ${totalMessages}`);
    console.log('');
    console.log(`Data saved to: ${OUTPUT_FILE}`);
    console.log(`End time: ${new Date().toISOString()}`);

  } catch (error) {
    console.error('Scraping failed:', error);
    process.exit(1);
  }
}

main();
