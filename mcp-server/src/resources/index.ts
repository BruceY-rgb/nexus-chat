/**
 * Resources Index - Resource Registry
 */

import { channelResources, getChannelList, getJoinedChannels } from './channels.js';
import { messageResources, getRecentMessages } from './messages.js';
import { userResources, getUserList } from './users.js';
import type { ResourceDefinition } from '../types.js';

// Merge all resources
export const resources: ResourceDefinition[] = [
  ...channelResources,
  ...messageResources,
  ...userResources,
];

// Resource mapping
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const resourceHandlers: Map<string, (userToken: string, params?: any) => Promise<string>> = new Map([
  ['channels://list', getChannelList],
  ['channels://joined', getJoinedChannels],
  ['messages://recent', getRecentMessages],
  ['users://list', getUserList],
]);
