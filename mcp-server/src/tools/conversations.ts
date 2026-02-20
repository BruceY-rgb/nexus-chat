/**
 * Conversation Tools - 私聊管理工具
 */

import { z } from "zod";
import { apiExecutor } from "../executor.js";
import type { ToolDefinition, ExecutionContext, ToolResult } from "../types.js";

// Input schemas
const createDMSchema = z.object({
  userId: z.string(),
  userToken: z.string(),
});

const getDMSchema = z.object({
  userId: z.string(),
  userToken: z.string(),
});

const listActiveDMsSchema = z.object({
  search: z.string().optional(),
  userToken: z.string(),
});

const getReadPositionSchema = z.object({
  channelId: z.string().optional(),
  dmConversationId: z.string().optional(),
  userToken: z.string(),
});

export const conversationTools: ToolDefinition[] = [
  {
    name: "create_dm",
    description: "创建与指定用户的私聊会话",
    parameters: createDMSchema,
    execute: async (args, _context): Promise<ToolResult> => {
      try {
        const validatedArgs = createDMSchema.parse(args);
        const result = await apiExecutor.post(
          "/api/conversations/dm",
          validatedArgs.userToken,
          { userId: validatedArgs.userId },
        );

        return {
          content: [{ type: "text", text: JSON.stringify(result) }],
        };
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        return {
          content: [
            { type: "text", text: JSON.stringify({ error: errorMessage }) },
          ],
          isError: true,
        };
      }
    },
  },
  {
    name: "get_dm",
    description: "获取与指定用户的私聊会话",
    parameters: getDMSchema,
    execute: async (args, _context): Promise<ToolResult> => {
      try {
        const validatedArgs = getDMSchema.parse(args);
        const result = await apiExecutor.get(
          `/api/conversations/dm/${validatedArgs.userId}`,
          validatedArgs.userToken,
        );

        return {
          content: [{ type: "text", text: JSON.stringify(result) }],
        };
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        return {
          content: [
            { type: "text", text: JSON.stringify({ error: errorMessage }) },
          ],
          isError: true,
        };
      }
    },
  },
  {
    name: "list_active_dms",
    description: "获取活跃的私聊会话列表",
    parameters: listActiveDMsSchema,
    execute: async (args, _context): Promise<ToolResult> => {
      try {
        const validatedArgs = listActiveDMsSchema.parse(args);
        const params: Record<string, string> = {};

        if (validatedArgs.search) params.search = validatedArgs.search;

        const result = await apiExecutor.get(
          "/api/conversations/dm/active",
          validatedArgs.userToken,
          params,
        );

        return {
          content: [{ type: "text", text: JSON.stringify(result) }],
        };
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        return {
          content: [
            { type: "text", text: JSON.stringify({ error: errorMessage }) },
          ],
          isError: true,
        };
      }
    },
  },
  {
    name: "get_read_position",
    description: "获取频道或私聊的阅读位置",
    parameters: getReadPositionSchema,
    execute: async (args, _context): Promise<ToolResult> => {
      try {
        const validatedArgs = getReadPositionSchema.parse(args);
        const params: Record<string, string> = {};

        if (validatedArgs.channelId) params.channelId = validatedArgs.channelId;
        if (validatedArgs.dmConversationId)
          params.dmConversationId = validatedArgs.dmConversationId;

        const result = await apiExecutor.get(
          "/api/conversations/read-position",
          validatedArgs.userToken,
          params,
        );

        return {
          content: [{ type: "text", text: JSON.stringify(result) }],
        };
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        return {
          content: [
            { type: "text", text: JSON.stringify({ error: errorMessage }) },
          ],
          isError: true,
        };
      }
    },
  },
];
