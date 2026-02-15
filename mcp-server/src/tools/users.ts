/**
 * User Tools - 用户管理工具
 */

import { z } from 'zod';
import { apiExecutor } from '../executor.js';
import type { ToolDefinition, ExecutionContext, User, ToolResult } from '../types.js';

// Input schemas
const listUsersSchema = z.object({
  search: z.string().optional(),
  page: z.number().int().positive().optional(),
  limit: z.number().int().positive().max(100).optional(),
  activeOnly: z.boolean().optional(),
  userToken: z.string(),
});

const searchUsersSchema = z.object({
  query: z.string(),
  userToken: z.string(),
});

export const userTools: ToolDefinition[] = [
  {
    name: 'list_users',
    description: '获取用户列表，支持搜索和分页',
    parameters: listUsersSchema,
    execute: async (args, _context): Promise<ToolResult> => {
      try {
        const validatedArgs = listUsersSchema.parse(args);
        const result = await apiExecutor.get<User[]>(
          '/api/users',
          validatedArgs.userToken,
          {
            search: validatedArgs.search || '',
            page: String(validatedArgs.page || 1),
            limit: String(validatedArgs.limit || 50),
            activeOnly: String(validatedArgs.activeOnly || false),
          }
        );

        return {
          content: [{ type: 'text', text: JSON.stringify(result) }],
        };
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return {
          content: [{ type: 'text', text: JSON.stringify({ error: errorMessage }) }],
          isError: true,
        };
      }
    },
  },
  {
    name: 'search_users',
    description: '搜索用户',
    parameters: searchUsersSchema,
    execute: async (args, _context): Promise<ToolResult> => {
      try {
        const validatedArgs = searchUsersSchema.parse(args);
        const result = await apiExecutor.get<User[]>(
          '/api/users/search',
          validatedArgs.userToken,
          { query: validatedArgs.query }
        );

        return {
          content: [{ type: 'text', text: JSON.stringify(result) }],
        };
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return {
          content: [{ type: 'text', text: JSON.stringify({ error: errorMessage }) }],
          isError: true,
        };
      }
    },
  },
];
