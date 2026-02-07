#!/usr/bin/env tsx
/**
 * 大规模种子数据生成脚本
 * 为 Slack-like Chat Tool 生成 3000+ 条真实合理的测试数据
 *
 * 数据规模：
 * - 150 用户
 * - 35 频道
 * - 3000 消息
 * - 80 DM 对话
 * - 相关的提及、反应、已读状态等
 *
 * 使用方法：
 * npx tsx scripts/seed-large.ts
 * 或
 * npm run db:seed:large
 */

import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

// ============================================================================
// 配置常量
// ============================================================================

const SEED_CONFIG = {
  TARGET_MESSAGE_COUNT: 3000,
  USER_COUNT: 150,
  CHANNEL_COUNT: 35,
  DM_CONVERSATION_COUNT: 80,
  TIME_RANGE_DAYS: 90,
  MENTION_PROBABILITY: 0.3,
  REACTION_PROBABILITY: 0.4,
  THREAD_REPLY_PROBABILITY: 0.2,
};

// 用户活跃度权重
const USER_ACTIVITY_WEIGHTS = {
  superActive: 0.05, // 5% 超活跃
  active: 0.15, // 15% 活跃
  normal: 0.75, // 75% 普通
  silent: 0.05, // 5% 沉默
};

// 消息类型权重
const MESSAGE_TYPE_WEIGHTS = {
  text: 0.7,
  emoji: 0.15,
  system: 0.1,
  code: 0.05,
};

// ============================================================================
// 工具函数
// ============================================================================

// 随机数工具
function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFloat(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

function randomChoice<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomSample<T>(arr: T[], count: number): T[] {
  const shuffled = [...arr].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

function weightedRandom<T>(items: { value: T; weight: number }[]): T {
  const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);

  // 如果总权重为0或无效，则使用随机选择
  if (totalWeight <= 0 || !isFinite(totalWeight)) {
    return randomChoice(items.map(item => item.value));
  }

  let random = Math.random() * totalWeight;

  for (const item of items) {
    if (random < item.weight) {
      return item.value;
    }
    random -= item.weight;
  }

  return items[items.length - 1].value;
}

// 生成随机日期
function randomDate(start: Date, end: Date): Date {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

// Box-Muller变换生成正态分布
function randomNormal(mean = 0, stdDev = 1): number {
  const u1 = Math.random();
  const u2 = Math.random();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return z * stdDev + mean;
}

// 生成用户活跃度分数
function generateUserActivityScore(userType: keyof typeof USER_ACTIVITY_WEIGHTS): number {
  switch (userType) {
    case 'superActive':
      return 0.9 + Math.random() * 0.1;
    case 'active':
      return 0.7 + Math.random() * 0.2;
    case 'normal':
      return 0.4 + Math.random() * 0.3;
    case 'silent':
      return 0.1 + Math.random() * 0.2;
    default:
      return 0.5;
  }
}

// ============================================================================
// 数据模板
// ============================================================================

const ENGLISH_NAMES = [
  // 常见英文名
  'James Smith', 'John Johnson', 'Robert Williams', 'Michael Brown', 'David Jones',
  'William Garcia', 'Richard Miller', 'Joseph Davis', 'Thomas Rodriguez', 'Charles Martinez',
  'Christopher Hernandez', 'Daniel Lopez', 'Matthew Gonzalez', 'Anthony Wilson', 'Mark Anderson',
  'Donald Taylor', 'Steven Moore', 'Paul Jackson', 'Andrew White', 'Joshua Harris',
  'Kenneth Clark', 'Kevin Lewis', 'Timothy Robinson', 'Jason Lee', 'Jeffrey Walker',
  'Ryan Hall', 'Jacob Young', 'Gary Allen', 'Eric King', 'Stephen Wright',
  'Jonathan Lopez', 'Justin Hill', 'Tyler Scott', 'Aaron Green', 'Jose Adams',
  'Christian Baker', 'Nathan Gonzalez', 'Zachary Nelson', 'Samuel Carter', 'Gabriel Mitchell',
  'Elijah Torres', 'Angel Ramos', 'Brandon Roberts', 'Hunter Richardson', 'Logan James',
  'Isaac Morgan', 'Luke Patterson', 'Ian Price', 'Cody Barnes', 'Caleb Bell',
  // 女性英文名
  'Mary Johnson', 'Patricia Williams', 'Linda Brown', 'Barbara Jones', 'Elizabeth Davis',
  'Jennifer Miller', 'Maria Rodriguez', 'Susan Wilson', 'Margaret Anderson', 'Dorothy Taylor',
  'Lisa Moore', 'Nancy Jackson', 'Karen White', 'Betty Harris', 'Helen Martin',
  'Sandra Thompson', 'Donna Garcia', 'Carol Martinez', 'Ruth Robinson', 'Sharon Clark',
  'Michelle Lewis', 'Laura Lee', 'Kimberly Walker', 'Deborah Hall', 'Jessica Gonzalez',
  'Cynthia Turner', 'Angela Martinez', 'Shirley Adams', 'Emma Wilson', 'Olivia Johnson',
  'Sophia Lopez', 'Ava Jones', 'Isabella Miller', 'Mia Davis', 'Charlotte Wilson',
  'Amelia Taylor', 'Harper Jackson', 'Evelyn White', 'Abigail Harris', 'Emily Anderson',
  'Elizabeth Moore', 'Avery Taylor', 'Sofia Jackson', 'Ella White', 'Madison Harris',
  'Scarlett Anderson', 'Victoria Moore', 'Aria Taylor', 'Grace Jackson', 'Chloe White',
  // 混合族裔姓名
  'Alice Chen', 'Bob Smith', 'Charlie Brown', 'Diana Prince', 'Edward Norton',
  'Grace Lee', 'Frank Miller', 'Helen Carter', 'Ivan Petrov', 'Julia Roberts',
  'Kevin Zhang', 'Linda Wang', 'Michael Johnson', 'Nancy Lee', 'Oscar Garcia',
  'Sophie Turner', 'Liam Johnson', 'Noah Smith', 'Emma Davis', 'Oliver Wilson',
  'Amelia Brown', 'Sophia Garcia', 'Isabella Martinez', 'Mia Lopez', 'Charlotte Anderson',
  'Harper Thompson', 'Evelyn Taylor', 'Abigail Moore', 'Emily Jackson', 'Elizabeth White',
  'Avery Harris', 'Sofia Johnson', 'Ella Smith', 'Madison Davis', 'Scarlett Wilson',
  'Victoria Brown', 'Aria Garcia', 'Grace Martinez', 'Chloe Lopez', 'Penelope Anderson',
  'Riley Thompson', 'Zoey Taylor', 'Nora Moore', 'Lily Jackson', 'Eleanor White',
  'Hannah Harris', 'Lillian Johnson', 'Addison Smith', 'Aubrey Davis', 'Stella Wilson',
];

const WORK_MESSAGES = [
  "How's everyone's progress today?",
  "I've posted the design mockups in the channel, please take a look",
  "Does anyone know best practices for {tech}?",
  "Meeting rescheduled to {time}",
  "Please review this PR @{user}",
  "New requirements came down, let's discuss implementation",
  "Having deployment issues, can someone help?",
  "Quick standup in 5 minutes",
  "Can we sync on this later today?",
  "Working on the new feature set",
  "Status update: Feature is 80% complete",
  "Need feedback on this approach",
  "Has anyone tested this scenario?",
  "Deploying to staging now",
  "Hotfix going out in 10 minutes",
  "Ready for code review",
  "This needs to be done by end of week",
  "Can we add this to the next sprint?",
  "Documentation has been updated",
  "Tests are passing locally",
  "Found a critical bug in production",
  "Performance metrics look good",
  "Architecture review scheduled",
  "Migration plan ready for review",
  "Security audit completed",
  "API endpoint is ready",
  "Database schema updated",
  "CI/CD pipeline configured",
  "Monitoring alerts set up",
  "Error rate is below threshold",
  "Backup strategy implemented",
  "Load testing completed",
  "Capacity planning done",
  "Tech debt sprint starting",
  "Retrospective tomorrow at 3pm",
  "Sprint planning on Monday",
  "Release notes drafted",
  "User acceptance testing done",
  "QA sign-off received",
  "Product demo on Friday",
  "Customer feedback incorporated",
  "Bug triage meeting at 2pm",
];

const CASUAL_MESSAGES = [
  "Beautiful weather today",
  "Lunch plans anyone?",
  "Did anyone catch the game last night?",
  "Weekend plans?",
  "Recommend a good movie",
  "Coffee time ☕",
  "It's Friday! 🎉",
  "Happy Monday everyone",
  "TGIF!",
  "Anyone up for happy hour?",
  "Just got coffee, want some?",
  "How was everyone's weekend?",
  "Spring is coming!",
  "Can't believe it's already Friday",
  "Movie night this weekend?",
  "Gym session after work?",
  "New restaurant opened downtown",
  "Happy birthday to @user!",
  "Anniversary celebration! 🎂",
  "Team building event next week",
  "Company picnic planned",
  "Game night on Thursday?",
  "Board game tournament?",
  "Book club anyone?",
  "Meditation session at lunch",
  "Yoga class this evening?",
  "Running club meetup",
  "Cycling on Saturday?",
  "Hiking trip planned",
  "Beach volleyball?",
  "Basketball game tonight",
  "Football Sunday!",
  "Baseball season started",
  "Tennis doubles?",
  "Golf tournament next month",
  "Chess club meeting",
  "Photography walk",
  "Art gallery opening",
  "Concert this weekend?",
  "Comedy show Friday",
  "Theater play tonight",
  "Festival this weekend",
  "Farmers market visit?",
  "Bookstore browsing?",
  "Museum day out",
  "Local history tour",
  "Cooking class?",
  "Baking competition",
  "Potluck dinner!",
];

const TECH_MESSAGES = [
  "Just discovered this interesting {npm_package}",
  "Anyone used {framework} before?",
  "Ever encountered this {error}?",
  "Sharing a useful {tool}",
  "What do you guys think about code style?",
  "Recommend some good books on {topic}",
  "Found a neat solution to a common problem",
  "Pro tip: Use this instead of that",
  "This library saved me hours",
  "StackOverflow to the rescue again",
  "Anyone else love/hate this framework?",
  "Just learned this neat trick",
  "Code review tips appreciated",
  "Debugging session later?",
  "Pair programming?",
  "Architecture decision record needed",
  "Technical RFC drafted",
  "Design pattern discussion?",
  "Algorithm optimization help?",
  "Performance bottleneck analysis",
  "Memory leak investigation",
  "Concurrency issues?",
  "Distributed systems chat?",
  "Microservices migration?",
  "Serverless adoption?",
  "Container orchestration setup",
  "Kubernetes cluster ready",
  "Docker image optimized",
  "CI/CD pipeline help?",
  "Test automation strategy",
  "Unit test coverage report",
  "Integration testing approach?",
  "End-to-end test suite",
  "Performance testing suite",
  "Load testing results",
  "Security scanning done",
  "Dependency update needed",
  "Package version conflict?",
  "TypeScript migration?",
  "ESLint configuration help?",
  "Prettier setup?",
  "Git hooks configuration",
  "Branching strategy discussion?",
  "Merge vs rebase?",
  "Commit message format?",
  "Code review guidelines?",
  "Pairing session today?",
  "Tech talk tomorrow?",
  "Conference presentation?",
  "Open source contribution?",
  "Hackathon participation?",
  "Side project showcase?",
];

const SHORT_MESSAGES = [
  "👍", "👌", "😊", "😂", "🤔", "👍👍", "Got it", "Sure", "Yep", "Sounds good",
  "No problem", "OK", "Understood", "Noted", "Haha", "LOL", "😅", "🙂", "🤝", "💪",
  "Interesting", "Nice!", "Great!", "Cool", "Thanks!", "Awesome", "Perfect", "Indeed",
  "Absolutely", "Definitely", "Certainly", "Of course", "Right", "True", "Agreed",
  "Looks good", "Well done", "Excellent", "Impressive", "Brilliant", "Genius",
  "Working on it", "On it", "Will do", "Consider it done", "Done",
  "Will check", "Looking into it", "Investigating", "Figuring it out",
];

const CHANNEL_NAMES = [
  // 核心频道
  'general', 'announcements', 'random',
  // 团队频道
  'development', 'design', 'marketing', 'sales', 'product', 'engineering',
  'qa', 'devops', 'security', 'research',
  // 项目频道
  'project-alpha', 'project-beta', 'project-gamma', 'project-delta',
  'app-v2', 'website-redesign', 'mobile-app', 'api-v3',
  'infrastructure', 'cloud-migration',
  // 兴趣频道
  'sports', 'music', 'movies', 'books', 'gaming', 'travel',
  'food', 'fitness', 'photography', 'art',
  // 私有频道
  'hr', 'finance', 'legal', 'executives', 'board-meeting',
];

const TECH_KEYWORDS = [
  'React', 'Vue', 'Angular', 'Node.js', 'Python', 'Java', 'TypeScript',
  'JavaScript', 'Go', 'Rust', 'C++', 'C#', 'PHP', 'Ruby', 'Swift', 'Kotlin',
  'Docker', 'Kubernetes', 'AWS', 'Azure', 'GCP', 'Linux', 'Windows', 'MacOS',
  'PostgreSQL', 'MySQL', 'MongoDB', 'Redis', 'Elasticsearch', 'GraphQL',
  'REST', 'WebSocket', 'gRPC', 'Microservices', 'Serverless', 'Next.js',
  'Express', 'Spring', 'Django', 'Flask', 'Rails', 'Laravel',
  'Jest', 'Mocha', 'Cypress', 'Selenium', 'Playwright',
  'Webpack', 'Babel', 'ESLint', 'Prettier', 'npm', 'yarn', 'pnpm',
];

// ============================================================================
// Prisma 客户端
// ============================================================================

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'production' ? ['error'] : ['query', 'info', 'warn'],
});

// ============================================================================
// 数据生成器
// ============================================================================

class ProgressTracker {
  private total: number;
  private current: number;
  private startTime: number;
  private label: string;

  constructor(label: string, total: number) {
    this.label = label;
    this.total = total;
    this.current = 0;
    this.startTime = Date.now();
  }

  update(current: number) {
    this.current = current;
    const progress = (current / this.total * 100).toFixed(1);
    const elapsed = (Date.now() - this.startTime) / 1000;
    const eta = current > 0 ? (elapsed / current * (this.total - current)).toFixed(1) : '0';

    process.stdout.write(
      `\r${this.label}: [${'█'.repeat(Math.floor(parseFloat(progress) / 2))}${'░'.repeat(50 - Math.floor(parseFloat(progress) / 2))}] ${progress}% | ETA: ${eta}s`
    );
  }

  complete() {
    const elapsed = ((Date.now() - this.startTime) / 1000).toFixed(1);
    console.log(`\n${this.label}: Completed in ${elapsed}s`);
  }
}

// 用户生成器
class UserGenerator {
  generate(count: number) {
    console.log(`\n👥 Generating ${count} users...`);
    const progress = new ProgressTracker('Users', count);

    // 创建基础管理员账户
    const adminUsers = [
      {
        email: 'admin@chat.com',
        password: 'admin123',
        displayName: 'Admin User',
        realName: 'System Administrator',
        activityScore: 1.0,
        userType: 'superActive' as const,
      },
      {
        email: 'ceo@chat.com',
        password: 'password123',
        displayName: 'CEO User',
        realName: 'Chief Executive Officer',
        activityScore: 0.8,
        userType: 'active' as const,
      },
    ];

    // 生成其他用户
    const generatedUsers = [];
    let nameIndex = 0;

    for (let i = 0; i < count - adminUsers.length; i++) {
      // 分配用户类型
      const userTypes: (keyof typeof USER_ACTIVITY_WEIGHTS)[] = [
        'superActive', 'superActive', 'superActive', 'superActive', 'superActive',
        'active', 'active', 'active', 'active', 'active', 'active', 'active', 'active', 'active',
        'normal', 'normal', 'normal', 'normal', 'normal', 'normal', 'normal', 'normal', 'normal', 'normal', 'normal', 'normal', 'normal', 'normal', 'normal',
        'silent', 'silent',
      ];
      const userType = randomChoice(userTypes);

      // 选择名字（循环使用英文姓名库）
      const displayName = ENGLISH_NAMES[nameIndex % ENGLISH_NAMES.length];
      const realName = displayName;
      nameIndex++;

      generatedUsers.push({
        email: `user${i + 1}@chat.com`,
        password: 'password123',
        displayName,
        realName,
        activityScore: generateUserActivityScore(userType),
        userType,
      });

      progress.update(i + 1);
    }

    progress.complete();

    // 合并管理员用户
    return [
      ...adminUsers.map(u => ({ ...u, activityScore: 1.0, userType: 'superActive' as const })),
      ...generatedUsers,
    ];
  }
}

// 频道生成器
class ChannelGenerator {
  generate(count: number, createdById: string) {
    console.log(`\n📢 Generating ${count} channels...`);
    const progress = new ProgressTracker('Channels', count);

    const channels = [];
    const channelNames = randomSample(CHANNEL_NAMES, count);

    for (let i = 0; i < count; i++) {
      const name = channelNames[i];
      // 前30个公共，后5个私有
      const isPrivate = i >= 30;

      channels.push({
        name,
        description: this.generateDescription(name),
        isPrivate,
        createdById,
      });

      progress.update(i + 1);
    }

    progress.complete();
    return channels;
  }

  private generateDescription(name: string): string {
    const descriptions: Record<string, string> = {
      general: 'General team discussion',
      announcements: 'Official announcements',
      random: 'Random topics and memes',
      development: 'Development team discussions',
      design: 'Design team discussions',
      marketing: 'Marketing team discussions',
      sales: 'Sales team discussions',
      product: 'Product team discussions',
      engineering: 'Engineering team discussions',
      qa: 'Quality assurance team',
      devops: 'DevOps and infrastructure',
      security: 'Security team discussions',
      research: 'Research and development',
      'project-alpha': 'Project Alpha development',
      'project-beta': 'Project Beta development',
      'project-gamma': 'Project Gamma development',
      'project-delta': 'Project Delta development',
      'app-v2': 'Mobile app version 2',
      'website-redesign': 'Website redesign project',
      'mobile-app': 'Mobile application development',
      'api-v3': 'API version 3 development',
      infrastructure: 'Infrastructure team',
      'cloud-migration': 'Cloud migration project',
      sports: 'Sports and athletics',
      music: 'Music and musicians',
      movies: 'Movies and cinema',
      books: 'Books and reading',
      gaming: 'Gaming community',
      travel: 'Travel and adventures',
      food: 'Food and cooking',
      fitness: 'Fitness and health',
      photography: 'Photography and art',
      art: 'Art and creativity',
      hr: 'Human Resources',
      finance: 'Finance discussions',
      legal: 'Legal matters',
      executives: 'Executive team',
      'board-meeting': 'Board meeting room',
    };

    return descriptions[name] || 'Team discussions';
  }
}

// 消息生成器
class MessageGenerator {
  generate(count: number, users: any[], channels: any[], dmConversations: any[]) {
    console.log(`\n💬 Generating ${count} messages...`);
    const progress = new ProgressTracker('Messages', count);

    const messages = [];

    for (let i = 0; i < count; i++) {
      // 根据权重选择消息类型
      const messageType = weightedRandom([
        { value: 'text', weight: MESSAGE_TYPE_WEIGHTS.text },
        { value: 'emoji', weight: MESSAGE_TYPE_WEIGHTS.emoji },
        { value: 'system', weight: MESSAGE_TYPE_WEIGHTS.system },
        { value: 'code', weight: MESSAGE_TYPE_WEIGHTS.code },
      ]);

      // 选择发送者（根据活跃度加权）
      if (!users || users.length === 0) {
        console.error('❌ Users array is empty or undefined');
        throw new Error('Users array is empty');
      }

      // 使用简单的随机选择，避免复杂的加权逻辑
      const sender = randomChoice(users);
      if (!sender) {
        console.error('❌ Sender is invalid');
        throw new Error('Sender is invalid');
      }

      // 选择目标（频道或DM）
      const isChannel = Math.random() > 0.3; // 70%频道消息，30%DM消息
      let target;
      let targetType: 'channel' | 'dm';

      if (isChannel) {
        const availableChannels = channels.filter(c => !c.isPrivate);
        if (availableChannels.length === 0) {
          console.error('❌ No public channels available!');
          throw new Error('No public channels available');
        }
        target = randomChoice(availableChannels);
        targetType = 'channel';
        if (!target || !target.id) {
          console.error('❌ Target is invalid', { target, availableChannels, channels });
          throw new Error('Target is invalid');
        }
      } else {
        if (dmConversations.length === 0) {
          console.error('❌ No DM conversations available!');
          throw new Error('No DM conversations available');
        }
        target = randomChoice(dmConversations);
        targetType = 'dm';
        if (!target || !target.id) {
          console.error('❌ Target is invalid', { target, dmConversations });
          throw new Error('Target is invalid');
        }
      }

      // 生成时间（过去90天内）
      const now = new Date();
      const daysBack = SEED_CONFIG.TIME_RANGE_DAYS;
      const baseTime = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000);

      // 生成时间（工作日模式）
      let createdAt = this.generateWorkTimeMessage(baseTime, now);

      // 生成内容
      const content = this.generateContent(messageType, users, sender);

      messages.push({
        content,
        messageType,
        channelId: targetType === 'channel' ? target.id : null,
        dmConversationId: targetType === 'dm' ? target.id : null,
        userId: sender.id,
        createdAt,
        isEdited: Math.random() > 0.9, // 10%被编辑
        parentMessageId: null, // 将在后续设置
      });

      progress.update(i + 1);
    }

    progress.complete();
    return messages;
  }

  private generateWorkTimeMessage(start: Date, end: Date): Date {
    const isWeekday = Math.random() > 0.25; // 75%工作日
    let date = new Date(start);

    if (isWeekday) {
      // 工作日
      const hour = weightedRandom([
        { value: 9, weight: 0.05 },
        { value: 10, weight: 0.1 },
        { value: 11, weight: 0.15 },
        { value: 12, weight: 0.1 },
        { value: 13, weight: 0.05 },
        { value: 14, weight: 0.15 },
        { value: 15, weight: 0.15 },
        { value: 16, weight: 0.1 },
        { value: 17, weight: 0.1 },
        { value: 18, weight: 0.05 },
      ]);
      const minute = randomInt(0, 59);
      date.setHours(hour, minute, randomInt(0, 59), 0);
    } else {
      // 周末
      const hour = randomInt(10, 22);
      const minute = randomInt(0, 59);
      date.setHours(hour, minute, randomInt(0, 59), 0);
    }

    // 确保日期在范围内
    if (date < start) {
      date = new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
    }

    return date;
  }

  private generateContent(type: string, users: any[], sender: any): string {
    switch (type) {
      case 'emoji':
        return randomChoice(SHORT_MESSAGES.filter(m => m.includes('👍') || m.includes('😊') || m.includes('😂') || m.includes('🤔')));

      case 'system':
        return randomChoice([
          'joined the channel',
          'created a new channel',
          'updated the channel topic',
          'pinned a message',
          'left the channel',
        ]);

      case 'code':
        const languages = ['javascript', 'python', 'typescript', 'java', 'go', 'rust'];
        const language = randomChoice(languages);
        return `\`\`\`${language}\n${this.generateCodeSnippet(language)}\n\`\`\``;

      default:
        // 文本消息
        return this.generateTextMessage(users, sender);
    }
  }

  private generateTextMessage(users: any[], sender: any): string {
    const templates = [
      () => {
        const template = randomChoice(WORK_MESSAGES);
        return this.fillTemplate(template, users, sender);
      },
      () => {
        const template = randomChoice(CASUAL_MESSAGES);
        return this.fillTemplate(template, users, sender);
      },
      () => {
        const template = randomChoice(TECH_MESSAGES);
        return this.fillTemplate(template, users, sender);
      },
      () => randomChoice(SHORT_MESSAGES),
      () => {
        // 生成简单的@提及
        const mentionedUser = randomChoice(users.filter(u => u.id !== sender.id));
        return `Hey @${mentionedUser.displayName}, quick question`;
      },
      () => {
        // 生成问题
        const questions = [
          "Does anyone know how to fix this?",
          "Can someone help me with this?",
          "What's the best approach here?",
          "Has anyone tried this before?",
          "Where can I find documentation?",
          "How do you usually handle this?",
          "What do you think about this solution?",
        ];
        return randomChoice(questions);
      },
    ];

    return randomChoice(templates)();
  }

  private fillTemplate(template: string, users: any[], sender: any): string {
    let result = template;

    // 替换 {tech}
    if (result.includes('{tech}')) {
      const tech = randomChoice(TECH_KEYWORDS);
      result = result.replace('{tech}', tech);
    }

    // 替换 {time}
    if (result.includes('{time}')) {
      const times = ['2 PM', '3 PM tomorrow', 'Monday morning', 'end of day', 'next week'];
      result = result.replace('{time}', randomChoice(times));
    }

    // 替换 {npm_package}
    if (result.includes('{npm_package}')) {
      const packages = ['lodash', 'moment', 'axios', 'express', 'react', 'vue'];
      result = result.replace('{npm_package}', randomChoice(packages));
    }

    // 替换 {framework}
    if (result.includes('{framework}')) {
      const frameworks = ['React', 'Vue', 'Angular', 'Node.js', 'Express', 'Django'];
      result = result.replace('{framework}', randomChoice(frameworks));
    }

    // 替换 {error}
    if (result.includes('{error}')) {
      const errors = ['TypeError', 'NullPointerException', '404 error', 'timeout', 'memory leak'];
      result = result.replace('{error}', randomChoice(errors));
    }

    // 替换 {tool}
    if (result.includes('{tool}')) {
      const tools = ['Docker', 'Kubernetes', 'Jest', 'Webpack', 'ESLint', 'Prettier'];
      result = result.replace('{tool}', randomChoice(tools));
    }

    // 替换 {topic}
    if (result.includes('{topic}')) {
      const topics = ['algorithms', 'design patterns', 'best practices', 'performance', 'security'];
      result = result.replace('{topic}', randomChoice(topics));
    }

    // 替换 {user}
    if (result.includes('{user}')) {
      const mentionedUser = randomChoice(users.filter(u => u.id !== sender.id));
      result = result.replace('{user}', mentionedUser.displayName.split(' ')[0]);
    }

    return result;
  }

  private generateCodeSnippet(language: string): string {
    const snippets: Record<string, string[]> = {
      javascript: [
        'const user = { name: "John", age: 30 };',
        'const sum = (a, b) => a + b;',
        'async function fetchData() { return await fetch("/api"); }',
        'const result = items.map(item => item.value).filter(v => v > 0);',
      ],
      python: [
        'def fibonacci(n):\n    if n <= 1:\n        return n\n    return fibonacci(n-1) + fibonacci(n-2)',
        'data = {"key": "value", "count": 42}',
        'for item in items:\n    if item.active:\n        process(item)',
      ],
      typescript: [
        'interface User { name: string; age: number; }',
        'type Status = "pending" | "approved" | "rejected";',
        'const users: User[] = [];',
      ],
      java: [
        'public class Main { public static void main(String[] args) {} }',
        'List<String> items = new ArrayList<>();',
        'public void process() { /* implementation */ }',
      ],
      go: [
        'func main() {\n    fmt.Println("Hello, World!")\n}',
        'type User struct {\n    Name string\n    Age int\n}',
        'for i := 0; i < 10; i++ {\n    fmt.Println(i)\n}',
      ],
      rust: [
        'fn main() {\n    println!("Hello, World!");\n}',
        'let mut counter = 0;\nwhile counter < 10 {\n    counter += 1;\n}',
        'struct User { name: String, age: u32 }',
      ],
    };

    return randomChoice(snippets[language] || snippets.javascript);
  }
}

// 互动数据生成器
class InteractionGenerator {
  generateMentions(messages: any[], users: any[]) {
    console.log('\n🏷️  Generating mentions...');
    const progress = new ProgressTracker('Mentions', messages.length);

    const mentions = [];

    for (let i = 0; i < messages.length; i++) {
      const message = messages[i];
      const mentionedUsers = this.generateMentionsForMessage(message, users);

      for (const user of mentionedUsers) {
        mentions.push({
          messageId: message.id,
          mentionedUserId: user.id,
        });
      }

      progress.update(i + 1);
    }

    progress.complete();
    return mentions;
  }

  private generateMentionsForMessage(message: any, users: any[]) {
    const mentions = [];

    // 问题类消息：40%概率提及
    if (message.content.includes('?') || message.content.includes('anyone') || message.content.includes('know')) {
      if (Math.random() < SEED_CONFIG.MENTION_PROBABILITY) {
        const activeUsers = users.filter(u => u.activityScore > 0.5);
        mentions.push(randomChoice(activeUsers));
      }
    }

    // 感谢类消息：60%概率提及
    if (message.content.includes('thanks') || message.content.includes('thank you') || message.content.includes('appreciate')) {
      if (Math.random() < 0.6) {
        mentions.push(randomChoice(users));
      }
    }

    // 技术类消息：70%概率提及开发人员
    if (message.content.includes('code') || message.content.includes('bug') || message.content.includes('deploy') || message.content.includes('PR')) {
      const devs = users.filter(u => u.activityScore > 0.6);
      if (devs.length > 0 && Math.random() < 0.7) {
        mentions.push(randomChoice(devs));
      }
    }

    // 直接@提及
    const atMention = message.content.match(/@(\w+)/);
    if (atMention) {
      const mentionedName = atMention[1];
      const user = users.find(u => u.displayName.toLowerCase().includes(mentionedName.toLowerCase()));
      if (user) {
        mentions.push(user);
      }
    }

    // 去重
    const uniqueMentions = mentions.filter((mention, index, self) =>
      index === self.findIndex(m => m.id === mention.id)
    );

    return uniqueMentions;
  }

  generateReactions(messages: any[], users: any[]) {
    console.log('\n😊 Generating reactions...');
    const progress = new ProgressTracker('Reactions', messages.length);

    const EMOJIS = ['👍', '👎', '😊', '😂', '😮', '😢', '😡', '🎉', '❤️', '🔥', '💯', '👏', '🙌', '🤔', '😍'];

    const reactions = [];

    for (let i = 0; i < messages.length; i++) {
      const message = messages[i];

      if (Math.random() > SEED_CONFIG.REACTION_PROBABILITY) {
        progress.update(i + 1);
        continue;
      }

      const reactionCount = randomInt(1, 5);
      const reactingUsers = randomSample(users, reactionCount);

      for (const user of reactingUsers) {
        reactions.push({
          messageId: message.id,
          userId: user.id,
          emoji: randomChoice(EMOJIS),
        });
      }

      progress.update(i + 1);
    }

    progress.complete();
    return reactions;
  }

  generateReads(messages: any[], users: any[]) {
    console.log('\n👁️  Generating read statuses...');
    const progress = new ProgressTracker('Reads', messages.length);

    const reads = [];

    for (let i = 0; i < messages.length; i++) {
      const message = messages[i];

      // 模拟已读状态（60%用户会读消息）
      const probability = 0.6;
      const readerCount = Math.floor(users.length * probability);

      for (const user of randomSample(users, readerCount)) {
        const readDelay = Math.random() * 60 * 60 * 1000; // 1小时内
        reads.push({
          messageId: message.id,
          userId: user.id,
          readAt: new Date(message.createdAt.getTime() + readDelay),
        });
      }

      progress.update(i + 1);
    }

    progress.complete();
    return reads;
  }
}

// ============================================================================
// 主函数
// ============================================================================

async function main() {
  console.log('🚀 =======================================');
  console.log('   Large Scale Database Seeding');
  console.log('   =============================');
  console.log('');
  console.log(`📊 Target Statistics:`);
  console.log(`   - Users: ${SEED_CONFIG.USER_COUNT}`);
  console.log(`   - Channels: ${SEED_CONFIG.CHANNEL_COUNT}`);
  console.log(`   - Messages: ${SEED_CONFIG.TARGET_MESSAGE_COUNT}`);
  console.log(`   - DM Conversations: ${SEED_CONFIG.DM_CONVERSATION_COUNT}`);
  console.log(`   - Time Range: ${SEED_CONFIG.TIME_RANGE_DAYS} days`);
  console.log('');
  console.log(`🌍 Language: English only`);
  console.log('🚀 =======================================\n');

  try {
    // 清空现有数据
    console.log('🧹 Clearing existing data...');
    const startTime = Date.now();

    await prisma.notification.deleteMany();
    await prisma.attachment.deleteMany();
    await prisma.messageMention.deleteMany();
    await prisma.messageRead.deleteMany();
    await prisma.messageReaction.deleteMany();
    await prisma.message.deleteMany();
    await prisma.channelMember.deleteMany();
    await prisma.dMConversationMember.deleteMany();
    await prisma.dMConversation.deleteMany();
    await prisma.channel.deleteMany();
    await prisma.teamMember.deleteMany();
    await prisma.notificationSettings.deleteMany();
    await prisma.userSession.deleteMany();
    await prisma.user.deleteMany();

    console.log(`✅ Existing data cleared in ${((Date.now() - startTime) / 1000).toFixed(2)}s\n`);

    // 生成用户
    const userGenerator = new UserGenerator();
    const userData = userGenerator.generate(SEED_CONFIG.USER_COUNT);

    console.log('\n👥 Creating users in database...');
    const createdUsers = [];
    for (const userDataItem of userData) {
      const passwordHash = await bcrypt.hash(userDataItem.password, 10);
      const user = await prisma.user.create({
        data: {
          email: userDataItem.email,
          passwordHash,
          displayName: userDataItem.displayName,
          realName: userDataItem.realName,
          emailVerifiedAt: new Date(),
          lastSeenAt: randomDate(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), new Date()),
          isOnline: Math.random() > 0.8,
          timezone: 'UTC',
          status: 'active',
        },
      });
      createdUsers.push({
        ...user,
        activityScore: userDataItem.activityScore,
        userType: userDataItem.userType,
      });
    }
    console.log(`✅ Created ${createdUsers.length} users\n`);

    // 创建团队成员关系
    console.log('👨‍👩‍👧‍👦 Creating team memberships...');
    for (const user of createdUsers) {
      await prisma.teamMember.create({
        data: {
          userId: user.id,
          role: user.email.includes('admin') ? 'owner' : (user.email.includes('ceo') ? 'admin' : 'member'),
        },
      });
    }
    console.log(`✅ Created team memberships\n`);

    // 生成频道
    const channelGenerator = new ChannelGenerator();
    const channelData = channelGenerator.generate(SEED_CONFIG.CHANNEL_COUNT, createdUsers[0].id);

    console.log('\n📢 Creating channels in database...');
    const createdChannels = [];
    for (const channelDataItem of channelData) {
      const channel = await prisma.channel.create({
        data: channelDataItem,
      });
      createdChannels.push(channel);
    }
    console.log(`✅ Created ${createdChannels.length} channels\n`);

    // 创建频道成员关系
    console.log('👥 Adding users to channels...');
    for (const channel of createdChannels) {
      // 公共频道：所有用户加入
      if (!channel.isPrivate) {
        for (const user of createdUsers) {
          await prisma.channelMember.create({
            data: {
              channelId: channel.id,
              userId: user.id,
              role: user.email.includes('admin') || user.email.includes('ceo') ? 'owner' : 'member',
            },
          });
        }
      }
    }
    console.log(`✅ Added users to channels\n`);

    // 创建 DM 对话
    console.log('💬 Creating DM conversations...');
    const dmConversations = [];

    // 预先计算所有可能的用户对
    const allUserPairs: [any, any][] = [];
    for (let i = 0; i < createdUsers.length; i++) {
      for (let j = i + 1; j < createdUsers.length; j++) {
        allUserPairs.push([createdUsers[i], createdUsers[j]]);
      }
    }

    // 随机打乱用户对
    const shuffledPairs = randomSample(allUserPairs, allUserPairs.length);

    // 选择所需数量的用户对
    const selectedPairs = shuffledPairs.slice(0, SEED_CONFIG.DM_CONVERSATION_COUNT);

    for (const [user1, user2] of selectedPairs) {
      const dmConv = await prisma.dMConversation.create({
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
      dmConversations.push(dmConv);
    }
    console.log(`✅ Created ${dmConversations.length} DM conversations (${selectedPairs.length} unique pairs)\n`);

    // 生成消息
    const messageGenerator = new MessageGenerator();
    const messageData = messageGenerator.generate(
      SEED_CONFIG.TARGET_MESSAGE_COUNT,
      createdUsers,
      createdChannels,
      dmConversations
    );

    console.log('\n💭 Creating messages in database...');
    const createdMessages = [];
    for (let i = 0; i < messageData.length; i += 100) {
      const batch = messageData.slice(i, i + 100);
      const created = await prisma.message.createMany({
        data: batch.map(msg => ({
          content: msg.content,
          messageType: msg.messageType,
          channelId: msg.channelId,
          dmConversationId: msg.dmConversationId,
          userId: msg.userId,
          createdAt: msg.createdAt,
          isEdited: msg.isEdited,
          parentMessageId: msg.parentMessageId,
        })),
      });
      createdMessages.push(...batch);
    }
    console.log(`✅ Created ${createdMessages.length} messages\n`);

    // 生成线程回复
    console.log('🧵 Creating thread replies...');
    const threadCount = Math.floor(createdMessages.length * SEED_CONFIG.THREAD_REPLY_PROBABILITY);

    // 先查询已创建的消息（它们现在有ID了）
    const savedMessages = await prisma.message.findMany({
      where: {
        parentMessageId: null, // 只选择没有父消息的消息
      },
      take: threadCount, // 限制查询数量
    });

    for (const parentMessage of savedMessages) {
      if (parentMessage) {
        const replyUsers = createdUsers.filter(u => u.id !== parentMessage.userId);
        const replyUser = randomChoice(replyUsers);

        await prisma.message.create({
          data: {
            content: randomChoice(SHORT_MESSAGES),
            messageType: 'text',
            channelId: parentMessage.channelId,
            dmConversationId: parentMessage.dmConversationId,
            userId: replyUser.id,
            createdAt: new Date(parentMessage.createdAt.getTime() + randomInt(60, 3600) * 1000),
            parentMessageId: parentMessage.id,
          },
        });
      }
    }
    console.log(`✅ Created ${threadCount} thread replies\n`);

    // 生成互动数据
    const interactionGenerator = new InteractionGenerator();

    // 重新获取所有消息（包括线程回复）
    const allMessages = await prisma.message.findMany();

    const mentions = interactionGenerator.generateMentions(allMessages, createdUsers);
    if (mentions.length > 0) {
      await prisma.messageMention.createMany({ data: mentions });
      console.log(`✅ Created ${mentions.length} mentions\n`);
    }

    const reactions = interactionGenerator.generateReactions(allMessages, createdUsers);
    if (reactions.length > 0) {
      await prisma.messageReaction.createMany({ data: reactions });
      console.log(`✅ Created ${reactions.length} reactions\n`);
    }

    const reads = interactionGenerator.generateReads(allMessages, createdUsers);
    if (reads.length > 0) {
      await prisma.messageRead.createMany({ data: reads });
      console.log(`✅ Created ${reads.length} read statuses\n`);
    }

    // 创建通知设置
    console.log('🔔 Creating notification settings...');
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
    console.log(`✅ Created notification settings\n`);

    // 创建通知
    console.log('📨 Creating notifications...');
    const notifications = [];
    for (let i = 0; i < 1000; i++) {
      const user = randomChoice(createdUsers);
      const message = randomChoice(allMessages);
      notifications.push({
        userId: user.id,
        type: randomChoice(['mention', 'message', 'invite']),
        title: randomChoice([
          'You were mentioned',
          'New message received',
          'Channel invitation',
          'DM received',
        ]),
        content: randomChoice([
          'Someone mentioned you in a message',
          'You have a new message',
          'You have been invited to a channel',
          'New direct message',
        ]),
        relatedMessageId: message.id,
        isRead: Math.random() > 0.5,
        readAt: Math.random() > 0.5 ? randomDate(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), new Date()) : null,
      });
    }

    for (let i = 0; i < notifications.length; i += 100) {
      const batch = notifications.slice(i, i + 100);
      await prisma.notification.createMany({ data: batch });
    }
    console.log(`✅ Created ${notifications.length} notifications\n`);

    // 生成统计报告
    const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log('\n✅ =======================================');
    console.log('   Database Seeding Completed!');
    console.log('   =======================================\n');

    console.log('📊 Final Statistics:');
    console.log(`   - Users: ${await prisma.user.count()}`);
    console.log(`   - Channels: ${await prisma.channel.count()}`);
    console.log(`   - DM Conversations: ${await prisma.dMConversation.count()}`);
    console.log(`   - Messages: ${await prisma.message.count()}`);
    console.log(`   - Thread Replies: ${await prisma.message.count({ where: { parentMessageId: { not: null } } })}`);
    console.log(`   - Mentions: ${await prisma.messageMention.count()}`);
    console.log(`   - Reactions: ${await prisma.messageReaction.count()}`);
    console.log(`   - Read Statuses: ${await prisma.messageRead.count()}`);
    console.log(`   - Notifications: ${await prisma.notification.count()}`);
    console.log(`   - Total Data Records: ${await prisma.user.count() + await prisma.channel.count() + await prisma.message.count() + await prisma.messageMention.count() + await prisma.messageReaction.count() + await prisma.messageRead.count() + await prisma.notification.count()}`);

    console.log(`\n⏱️  Total Execution Time: ${totalTime}s`);

    console.log('\n🔑 Test Accounts:');
    console.log('   Admin: admin@chat.com / admin123');
    console.log('   CEO: ceo@chat.com / password123');
    for (let i = 0; i < Math.min(5, createdUsers.length - 2); i++) {
      const user = createdUsers[i + 2];
      console.log(`   ${user.displayName}: ${user.email} / password123`);
    }

    console.log('\n🎉 Enjoy your fully populated database!\n');

  } catch (error) {
    console.error('\n❌ Error during seeding:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// 执行
main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
