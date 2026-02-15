/**
 * Channel Resources - 频道资源
 */

import { apiExecutor } from '../executor.js';
import type { ResourceDefinition } from '../types.js';

export const channelResources: ResourceDefinition[] = [
  {
    uri: 'channels://list',
    name: 'Channel List',
    description: '获取所有频道列表',
    mimeType: 'application/json',
  },
  {
    uri: 'channels://joined',
    name: 'Joined Channels',
    description: '获取当前用户已加入的频道列表',
    mimeType: 'application/json',
  },
];

export async function getChannelList(userToken: string): Promise<string> {
  const result = await apiExecutor.get(
    '/api/channels',
    userToken,
    { type: 'all', limit: '100' }
  );
  return JSON.stringify(result);
}

export async function getJoinedChannels(userToken: string): Promise<string> {
  const result = await apiExecutor.get(
    '/api/channels',
    userToken,
    { type: 'joined', limit: '100' }
  );
  return JSON.stringify(result);
}
