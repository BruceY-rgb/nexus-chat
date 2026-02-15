/**
 * Conversation Tools - 私聊管理工具
 */

import { z } from 'zod';
import { apiExecutor } from '../executor.js';
import type { ToolDefinition, ExecutionContext, ToolResult } from '../types.js';

// Input schemas
const createDMSchema = z.object({
  userId: z.string(),
  userToken: z.string(),
});

const getDMSchema = z.object({
  userId: z.string(),
  userToken: z.string(),
});

export const conversationTools: ToolDefinition[] = [
  {
    name: 'create_dm',
    description: '创建与指定用户的私聊会话',
    parameters: createDMSchema,
    execute: async (args, _context): Promise<ToolResult> => {
      try {
        const validatedArgs = createDMSchema.parse(args);
        const result = await apiExecutor.post(
          '/api/conversations/dm',
          validatedArgs.userToken,
          { userId: validatedArgs.userId }
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
    name: 'get_dm',
    description: '获取与指定用户的私聊会话',
    parameters: getDMSchema,
    execute: async (args, _context): Promise<ToolResult> => {
      try {
        const validatedArgs = getDMSchema.parse(args);
        const result = await apiExecutor.get(
          `/api/conversations/dm/${validatedArgs.userId}`,
          validatedArgs.userToken
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
