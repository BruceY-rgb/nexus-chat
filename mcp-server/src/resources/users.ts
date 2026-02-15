/**
 * User Resources - 用户资源
 */

import { apiExecutor } from '../executor.js';
import type { ResourceDefinition } from '../types.js';

export const userResources: ResourceDefinition[] = [
  {
    uri: 'users://list',
    name: 'User List',
    description: '获取所有用户列表',
    mimeType: 'application/json',
  },
];

export async function getUserList(userToken: string): Promise<string> {
  const result = await apiExecutor.get(
    '/api/users',
    userToken,
    { limit: '100' }
  );
  return JSON.stringify(result);
}
