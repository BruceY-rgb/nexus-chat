/**
 * Resources Index - 资源注册表
 */

import { channelResources, getChannelList, getJoinedChannels } from './channels.js';
import { messageResources, getRecentMessages } from './messages.js';
import { userResources, getUserList } from './users.js';
import type { ResourceDefinition } from '../types.js';

// 合并所有资源
export const resources: ResourceDefinition[] = [
  ...channelResources,
  ...messageResources,
  ...userResources,
];

// 资源映射
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const resourceHandlers: Map<string, (userToken: string, params?: any) => Promise<string>> = new Map([
  ['channels://list', getChannelList],
  ['channels://joined', getJoinedChannels],
  ['messages://recent', getRecentMessages],
  ['users://list', getUserList],
]);
