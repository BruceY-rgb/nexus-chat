// Channel interface definition - mimicking Slack channel properties
export interface Channel {
  id: string;
  name: string;
  description?: string;
  type: 'public' | 'private';
  isPrivate?: boolean; // Database field for private channel
  createdAt: Date;
  ownerId: string;
  memberCount?: number;
  unreadCount?: number;
  lastReadAt?: Date;
  isMuted?: boolean;
}

// Check if user has joined channel
export const isUserJoined = (channel: Channel, userId: string): boolean => {
  // Default all channel users are joined (adjust according to actual needs)
  return true;
};

// Mock data - including #general and #random channels
export const mockChannels: Channel[] = [
  {
    id: 'channel-1',
    name: 'general',
    description: 'General channel - daily team communication',
    type: 'public',
    createdAt: new Date('2024-01-01'),
    ownerId: '1',
    memberCount: 5
  },
  {
    id: 'channel-2',
    name: 'random',
    description: 'Random channel - casual chat',
    type: 'public',
    createdAt: new Date('2024-01-01'),
    ownerId: '1',
    memberCount: 3
  },
  {
    id: 'channel-3',
    name: 'announcements',
    description: 'Announcement channel - important notifications',
    type: 'public',
    createdAt: new Date('2024-01-01'),
    ownerId: '1',
    memberCount: 5
  },
  {
    id: 'channel-4',
    name: 'help',
    description: 'Help channel - questions and answers',
    type: 'public',
    createdAt: new Date('2024-01-01'),
    ownerId: '1',
    memberCount: 4
  },
  {
    id: 'channel-5',
    name: 'social',
    description: 'Social channel - non-work related chat',
    type: 'public',
    createdAt: new Date('2024-01-01'),
    ownerId: '1',
    memberCount: 2
  }
];

// Get user's joined channels
export const getJoinedChannels = (channels: Channel[], userId: string): Channel[] => {
  return channels.filter(channel => isUserJoined(channel, userId));
};

// Get user's unjoined channels
export const getAvailableChannels = (channels: Channel[], userId: string): Channel[] => {
  return channels.filter(channel => !isUserJoined(channel, userId));
};
