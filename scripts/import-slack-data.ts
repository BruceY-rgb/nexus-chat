/**
 * Slack数据导入脚本
 * 将抓取的Slack数据导入到本地数据库
 *
 * 使用方法:
 * 1. 先运行 slack-scraper.ts 获取数据
 * 2. 设置环境变量 DATABASE_URL, OSS_*, SLACK_USER_TOKEN
 * 3. 运行: npx tsx scripts/import-slack-data.ts
 */

import { PrismaClient, Prisma } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import * as bcrypt from "bcryptjs";
import OSS from "ali-oss";

// ES模块兼容的__dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 配置
const INPUT_FILE = path.join(__dirname, "slack-data.json");
const DEFAULT_PASSWORD = "password123"; // 默认密码
const SLACK_TOKEN = process.env.SLACK_USER_TOKEN;

// OSS 客户端初始化
function getOssClient(): OSS {
  return new OSS({
    accessKeyId: process.env.OSS_ACCESS_KEY_ID!,
    accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET!,
    region: process.env.OSS_REGION || "oss-cn-hangzhou",
    bucket: process.env.OSS_BUCKET!,
    endpoint: process.env.OSS_ENDPOINT,
  });
}

// 下载 Slack 文件
async function downloadSlackFile(
  fileUrl: string,
  token: string,
): Promise<Buffer> {
  const response = await fetch(fileUrl, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to download file: ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

// 上传文件到 OSS
async function uploadToOss(
  fileBuffer: Buffer,
  fileName: string,
  mimeType: string,
): Promise<{
  s3Key: string;
  s3Bucket: string;
  fileUrl: string;
  thumbnailUrl?: string;
}> {
  const timestamp = Date.now();
  const randomString = Math.random().toString(36).substring(7);
  const extension = fileName.split(".").pop();
  const uniqueFileName = `import/${timestamp}-${randomString}.${extension}`;

  const s3Bucket = process.env.OSS_BUCKET!;
  const s3Key = uniqueFileName;

  const ossClient = getOssClient();
  const result = await ossClient.put(s3Key, fileBuffer, {
    headers: {
      "Content-Type": mimeType,
      "Content-Disposition": `inline; filename="${encodeURIComponent(fileName)}"`,
      "Cache-Control": "public, max-age=31536000",
    },
  });

  // 使用 ali-oss 返回的 URL
  let fileUrl = result.url;
  if (process.env.OSS_CUSTOM_DOMAIN) {
    fileUrl = `https://${process.env.OSS_CUSTOM_DOMAIN}/${s3Key}`;
  }

  let thumbnailUrl: string | undefined;
  if (mimeType.startsWith("image/")) {
    thumbnailUrl = fileUrl;
  }

  return {
    s3Key,
    s3Bucket,
    fileUrl,
    thumbnailUrl,
  };
}

// 导入文件附件
async function importAttachment(
  slackFile: SlackFile,
  messageId: string,
  userId: string,
): Promise<number> {
  try {
    // 下载文件（优先使用下载专用 URL）
    const downloadUrl = slackFile.url_private_download || slackFile.url_private;
    const fileBuffer = await downloadSlackFile(downloadUrl, SLACK_TOKEN!);

    // 上传到 OSS
    const uploadResult = await uploadToOss(
      fileBuffer,
      slackFile.name,
      slackFile.mimetype,
    );

    // 创建附件记录
    await prisma.attachment.create({
      data: {
        messageId,
        fileName: slackFile.name,
        filePath: uploadResult.fileUrl,
        fileSize: BigInt(slackFile.size || fileBuffer.length),
        mimeType: slackFile.mimetype,
        fileType: slackFile.mimetype.startsWith("image/")
          ? "image"
          : "document",
        s3Key: uploadResult.s3Key,
        s3Bucket: uploadResult.s3Bucket,
        thumbnailUrl: uploadResult.thumbnailUrl || null,
      },
    });

    return 1;
  } catch (error) {
    console.error(`   Warning: Failed to import attachment: ${slackFile.name}`, error);
    return 0;
  }
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

interface SlackMessage {
  type: string;
  subtype?: string;
  ts: string;
  user: string;
  text: string;
  files?: SlackFile[];
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
  log: ["info", "warn", "error"],
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

// 重置模式：清空现有数据
async function resetData() {
  console.log("Warning: Clearing existing data (reset mode)...");

  try {
    // 按依赖顺序删除数据（先删除有外键依赖的表）
    await prisma.attachment.deleteMany();
    console.log("   - Attachments cleared");

    await prisma.message.deleteMany();
    console.log("   - Messages cleared");

    await prisma.channelMember.deleteMany();
    console.log("   - Channel members cleared");

    await prisma.channel.deleteMany();
    console.log("   - Channels cleared");

    await prisma.teamMember.deleteMany();
    console.log("   - Team members cleared");

    // 私信相关（依赖 user，需要先删除）
    await prisma.dMConversationMember.deleteMany();
    console.log("   - DM conversation members cleared");

    await prisma.dMConversation.deleteMany();
    console.log("   - DM conversations cleared");

    await prisma.notificationSettings.deleteMany();
    console.log("   - Notification settings cleared");

    await prisma.user.deleteMany();
    console.log("   - Users cleared");

    console.log("   - Data cleared successfully!\n");
  } catch (error) {
    console.error("   Error: Failed to clear data:", error);
    throw error;
  }
}

// 生成随机ID
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// 导入用户（重置模式）
async function importUsers(slackData: SlackData): Promise<UserMapping[]> {
  console.log("Users: Importing users (reset mode)...");

  const userMappings: UserMapping[] = [];
  let newUserCount = 0;
  let existUserCount = 0;

  for (const slackUser of slackData.users) {
    try {
      const email = `${slackUser.name}@slack-import.local`;

      // 检查用户是否已存在
      const existingUser = await prisma.user.findUnique({
        where: { email },
      });

      if (existingUser) {
        // Update slackUserId if not already set
        if (!existingUser.slackUserId) {
          await prisma.user.update({
            where: { id: existingUser.id },
            data: { slackUserId: slackUser.id },
          });
        }
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
          realName:
            slackUser.profile.real_name ||
            slackUser.real_name ||
            slackUser.name,
          avatarUrl: slackUser.profile.image_72 || null,
          slackUserId: slackUser.id,
          emailVerifiedAt: new Date(),
        },
      });

      userMappings.push({
        slackUserId: slackUser.id,
        localUserId: user.id,
        slackUserName: slackUser.name,
      });

      newUserCount++;
      console.log(
        `   - New user: ${slackUser.profile.display_name || slackUser.name}`,
      );
    } catch (error: any) {
      console.error(`   X Failed to import user: ${slackUser.name}`, error.message);
    }
  }

  console.log(`   - New users: ${newUserCount}`);
  console.log(`   - Existing users: ${existUserCount}`);
  return userMappings;
}

// 导入频道（重置模式）
async function importChannels(
  slackData: SlackData,
  userMappings: UserMapping[],
): Promise<ChannelMapping[]> {
  console.log("");
  console.log("Channels: Importing channels (reset mode)...");

  const channelMappings: ChannelMapping[] = [];
  const ownerId = userMappings[0]?.localUserId;

  if (!ownerId) {
    throw new Error("No available users to create channel");
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
        where: { name: slackChannel.name },
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
          description:
            slackChannel.purpose?.value || slackChannel.topic?.value || "",
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
            role: "member",
          },
        });
      }

      newChannelCount++;
      console.log(`   - New channel: #${slackChannel.name}`);
    } catch (error: any) {
      console.error(`   X Failed to import channel: #${slackChannel.name}`, error.message);
    }
  }

  console.log(`   - New channels: ${newChannelCount}`);
  console.log(`   - Existing channels: ${existChannelCount}`);
  return channelMappings;
}

// 导入消息（重置模式）
async function importMessages(
  slackData: SlackData,
  userMappings: UserMapping[],
  channelMappings: ChannelMapping[],
) {
  console.log("");
  console.log("Messages: Importing messages (reset mode)...");

  // 创建映射查找表
  const userIdMap = new Map(
    userMappings.map((m) => [m.slackUserId, m.localUserId]),
  );
  const channelIdMap = new Map(
    channelMappings.map((m) => [m.slackChannelId, m.localChannelId]),
  );

  // 创建时间戳到本地消息ID的映射，用于处理线程
  const tsToLocalId = new Map<string, string>();

  let totalImported = 0;
  let totalSkipped = 0;
  let duplicateSkipped = 0;
  let totalAttachmentsImported = 0;

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
        if (
          slackMsg.subtype &&
          !["file_share", "thread_broadcast"].includes(slackMsg.subtype)
        ) {
          if (slackMsg.subtype !== "bot_message") {
            totalSkipped++;
          }
          continue;
        }

        // 跳过没有用户的消息（除非是文件分享消息）
        if (!slackMsg.user && slackMsg.subtype !== "file_share") {
          totalSkipped++;
          continue;
        }

        let localUserId = slackMsg.user ? userIdMap.get(slackMsg.user) : null;

        // 如果是文件分享消息，尝试找第一个用户作为替代
        if (!localUserId && slackMsg.subtype === "file_share") {
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
          },
        });

        if (existingMessage) {
          tsToLocalId.set(
            `${slackChannel.id}-${slackMsg.ts}`,
            existingMessage.id,
          );
          duplicateSkipped++;
          continue;
        }

        // 判断是否为线程根消息
        const isThreadRoot = !!(
          slackMsg.thread_ts && slackMsg.ts === slackMsg.thread_ts
        );

        // 判断消息类型（根据附件）
        let messageType = "text";
        if (slackMsg.files && slackMsg.files.length > 0) {
          const hasImage = slackMsg.files.some((f) =>
            f.mimetype?.startsWith("image/"),
          );
          messageType = hasImage ? "image" : "file";
        }

        const message = await prisma.message.create({
          data: {
            content: slackMsg.text || "",
            messageType,
            channelId: localChannelId,
            userId: localUserId,
            createdAt: msgCreatedAt,
            isEdited: !!slackMsg.edited,
            isThreadRoot: isThreadRoot || false,
            // parentMessageId稍后处理
          },
        });

        // 导入附件
        let attachmentCount = 0;
        if (slackMsg.files && slackMsg.files.length > 0) {
          for (const slackFile of slackMsg.files) {
            const count = await importAttachment(
              slackFile,
              message.id,
              localUserId,
            );
            attachmentCount += count;
            totalAttachmentsImported += count;
          }
          if (attachmentCount > 0) {
            console.log(
              `   - Message ${message.id} imported ${attachmentCount} attachment(s)`,
            );
          }
        }

        // 存储时间戳到本地ID的映射
        tsToLocalId.set(`${slackChannel.id}-${slackMsg.ts}`, message.id);

        totalImported++;

        if (totalImported % 100 === 0) {
          console.log(`   Imported ${totalImported} messages...`);
        }
      } catch (error: any) {
        if (error.code !== "P2002") {
          totalSkipped++;
        }
      }
    }
  }

  console.log(`   - First round import complete, ${totalImported} messages`);

  // 第二轮：处理线程关系
  console.log("   Processing thread relationships...");
  let threadCount = 0;

  for (const slackChannel of slackData.channels) {
    const localChannelId = channelIdMap.get(slackChannel.id);
    if (!localChannelId) continue;

    const messages = slackData.messages[slackChannel.id] || [];

    for (const slackMsg of messages) {
      // 只有当消息是线程回复时才处理
      if (!slackMsg.thread_ts || slackMsg.ts === slackMsg.thread_ts) continue;

      const localMessageId = tsToLocalId.get(
        `${slackChannel.id}-${slackMsg.ts}`,
      );
      const parentMessageId = tsToLocalId.get(
        `${slackChannel.id}-${slackMsg.thread_ts}`,
      );

      if (localMessageId && parentMessageId) {
        try {
          // 检查是否已经设置了parentMessageId
          const message = await prisma.message.findUnique({
            where: { id: localMessageId },
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

  console.log(`   - Processed ${threadCount} thread replies`);

  console.log(`   - New messages: ${totalImported}`);
  console.log(`   - New attachments: ${totalAttachmentsImported}`);
  console.log(`   - Skipped duplicates: ${duplicateSkipped}`);
  console.log(`   - Skipped others: ${totalSkipped}`);
}

// 主函数
async function main() {
  console.log("Slack Data Import Tool (Reset Mode)");
  console.log("=".repeat(50));

  // 1. 检查输入文件
  if (!fs.existsSync(INPUT_FILE)) {
    console.error(`Error: Data file not found ${INPUT_FILE}`);
    console.log("   Please run first: npx tsx scripts/slack-scraper.ts");
    process.exit(1);
  }

  // 1.1 检查 Slack Token
  if (!SLACK_TOKEN) {
    console.error(`Error: Please set SLACK_USER_TOKEN environment variable`);
    console.log("   To download Slack files, you need a Slack User Token");
    process.exit(1);
  }

  // 2. 重置模式：清空现有数据
  await resetData();

  // 3. 读取数据
  console.log(`Reading data file: ${INPUT_FILE}`);
  const fileContent = fs.readFileSync(INPUT_FILE, "utf-8");
  const slackData: SlackData = JSON.parse(fileContent);

  console.log("");
  console.log("Data Overview:");
  console.log(`   - Users: ${slackData.metadata.totalUsers}`);
  console.log(`   - Channels: ${slackData.metadata.totalChannels}`);
  console.log(`   - Messages: ${slackData.metadata.totalMessages}`);
  console.log("");

  // 3. 导入用户（重置模式）
  const userMappings = await importUsers(slackData);

  if (userMappings.length === 0) {
    console.log("Error: No available users, please ensure user import succeeds first");
    process.exit(1);
  }

  // 4. 创建团队成员关系（重置模式）
  console.log("");
  console.log("Creating team member relationships (reset mode)...");
  const users = await prisma.user.findMany();
  let newTeamMemberCount = 0;

  for (const user of users) {
    const existingMember = await prisma.teamMember.findUnique({
      where: { userId: user.id },
    });

    if (!existingMember) {
      await prisma.teamMember.create({
        data: {
          userId: user.id,
          role: user.email.includes("admin") ? "owner" : "member",
        },
      });
      newTeamMemberCount++;
    }
  }
  console.log(`   - New team members: ${newTeamMemberCount}`);

  // 5. 导入频道（重置模式）
  const channelMappings = await importChannels(slackData, userMappings);

  // 6. 导入消息（重置模式）
  await importMessages(slackData, userMappings, channelMappings);

  // 7. 创建通知设置（重置模式）
  console.log("");
  console.log("Creating notification settings (reset mode)...");
  let newNotificationSettingsCount = 0;

  for (const user of users) {
    const existingSettings = await prisma.notificationSettings.findUnique({
      where: { userId: user.id },
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
  console.log(`   - New notification settings: ${newNotificationSettingsCount}`);

  // 8. 统计
  console.log("");
  console.log("=".repeat(50));
  console.log("Reset import completed!");
  console.log("");
  console.log("Current database stats:");
  console.log(`   - Users: ${await prisma.user.count()}`);
  console.log(`   - Channels: ${await prisma.channel.count()}`);
  console.log(`   - Messages: ${await prisma.message.count()}`);
  console.log("");
  console.log("Slack import test accounts:");
  console.log(`   Password: ${DEFAULT_PASSWORD}`);
  console.log(`   Email format: {username}@slack-import.local`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("Error: Import failed:", e);
  process.exit(1);
});
