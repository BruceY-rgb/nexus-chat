/**
 * User Resources - User Resources
 */

import { apiExecutor } from '../executor.js';
import type { ResourceDefinition } from '../types.js';

export const userResources: ResourceDefinition[] = [
  {
    uri: 'users://list',
    name: 'User List',
    description: 'Get all user list',
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
