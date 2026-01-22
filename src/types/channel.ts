// Channel 接口定义 - 模仿 Slack 频道属性
export interface Channel {
  id: string;
  name: string;
  description?: string;
  type: 'public' | 'private';
  createdAt: Date;
  ownerId: string;
  memberCount?: number;
  unreadCount?: number;
  lastReadAt?: Date;
  isMuted?: boolean;
}

// 检查用户是否已加入频道
export const isUserJoined = (channel: Channel, userId: string): boolean => {
  // 默认所有频道用户都已加入（根据实际需求调整）
  return true;
};

// Mock 数据 - 包含 #general 和 #random 频道
export const mockChannels: Channel[] = [
  {
    id: 'channel-1',
    name: 'general',
    description: '通用频道 - 团队日常交流',
    type: 'public',
    createdAt: new Date('2024-01-01'),
    ownerId: '1',
    memberCount: 5
  },
  {
    id: 'channel-2',
    name: 'random',
    description: '随机频道 - 随意聊天',
    type: 'public',
    createdAt: new Date('2024-01-01'),
    ownerId: '1',
    memberCount: 3
  },
  {
    id: 'channel-3',
    name: 'announcements',
    description: '公告频道 - 重要通知',
    type: 'public',
    createdAt: new Date('2024-01-01'),
    ownerId: '1',
    memberCount: 5
  },
  {
    id: 'channel-4',
    name: 'help',
    description: '帮助频道 - 提问与解答',
    type: 'public',
    createdAt: new Date('2024-01-01'),
    ownerId: '1',
    memberCount: 4
  },
  {
    id: 'channel-5',
    name: 'social',
    description: '社交频道 - 非工作相关聊天',
    type: 'public',
    createdAt: new Date('2024-01-01'),
    ownerId: '1',
    memberCount: 2
  }
];

// 获取用户已加入的频道
export const getJoinedChannels = (channels: Channel[], userId: string): Channel[] => {
  return channels.filter(channel => isUserJoined(channel, userId));
};

// 获取用户未加入的频道
export const getAvailableChannels = (channels: Channel[], userId: string): Channel[] => {
  return channels.filter(channel => !isUserJoined(channel, userId));
};
