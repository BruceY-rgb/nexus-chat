/**
 * Channel Resources - Channel Resources
 */

import { apiExecutor } from '../executor.js';
import type { ResourceDefinition } from '../types.js';

export const channelResources: ResourceDefinition[] = [
  {
    uri: 'channels://list',
    name: 'Channel List',
    description: 'Get all channel list',
    mimeType: 'application/json',
  },
  {
    uri: 'channels://joined',
    name: 'Joined Channels',
    description: 'Get list of channels the current user has joined',
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
