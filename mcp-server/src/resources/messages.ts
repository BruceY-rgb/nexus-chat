/**
 * Message Resources - Message Resources
 */

import { apiExecutor } from '../executor.js';
import type { ResourceDefinition } from '../types.js';

export const messageResources: ResourceDefinition[] = [
  {
    uri: 'messages://recent',
    name: 'Recent Messages',
    description: 'Get recent message list',
    mimeType: 'application/json',
  },
];

export async function getRecentMessages(userToken: string, channelId?: string): Promise<string> {
  const params: Record<string, string> = {
    limit: '50',
    offset: '0',
  };
  if (channelId) {
    params.channelId = channelId;
  }
  const result = await apiExecutor.get('/api/messages', userToken, params);
  return JSON.stringify(result);
}
