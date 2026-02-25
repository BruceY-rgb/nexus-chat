/**
 * Slack Data Scraper Script
 * Scrapes public channels, users, and message data from a Slack workspace
 *
 * Usage:
 * 1. Set environment variable SLACK_USER_TOKEN
 * 2. Run: npx ts-node scripts/slack-scraper.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// ES module compatible __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Slack API configuration
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

// Slack API call wrapper
async function slackApiCall<T>(method: string, params: Record<string, string | number | boolean> = {}): Promise<T> {
  const url = `https://slack.com/api/${method}`;

  // xoxe token needs to use form-urlencoded format
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

// Fetch user list
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

// Fetch channel list
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

// Fetch channel message history
async function fetchChannelHistory(channelId: string, channelName: string): Promise<SlackMessage[]> {
  const messages: SlackMessage[] = [];
  let cursor: string | undefined;
  let hasMore = true;
  let latestTimestamp = Math.floor(Date.now() / 1000);

  // Limit number of messages to avoid long execution time
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

      // Update latest to timestamp of last message
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

// Wait for specified time (handle rate limiting)
async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Main function
async function main() {
  console.log('Slack Data Scraper');
  console.log('='.repeat(50));
  console.log(`Start time: ${new Date().toISOString()}`);
  console.log('');

  try {
    // 1. Fetch user list
    const users = await fetchUsers();

    // 2. Fetch channel list
    const channels = await fetchChannels();

    // 3. Fetch messages for each channel
    console.log('');
    console.log('Fetching channel messages...');
    const messages: Record<string, SlackMessage[]> = {};

    for (let i = 0; i < channels.length; i++) {
      const channel = channels[i];
      console.log(`[${i + 1}/${channels.length}] Processing channel #${channel.name}...`);

      try {
        const channelMessages = await fetchChannelHistory(channel.id, channel.name);
        messages[channel.id] = channelMessages;

        // Polite wait to avoid triggering rate limit
        if (i < channels.length - 1) {
          await sleep(200);
        }
      } catch (error) {
        console.error(`   Failed to fetch #${channel.name} messages:`, error);
        messages[channel.id] = [];
      }
    }

    // 4. Aggregate data
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

    // 5. Save to file
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
