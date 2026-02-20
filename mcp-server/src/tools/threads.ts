/**
 * Thread Tools - 线程管理工具
 */

import { z } from "zod";
import { apiExecutor } from "../executor.js";
import type { ToolDefinition, ExecutionContext, ToolResult } from "../types.js";

// Input schemas
const getThreadCountSchema = z.object({
  userToken: z.string(),
});

const getUnreadThreadsSchema = z.object({
  limit: z.number().int().positive().optional(),
  offset: z.number().int().nonnegative().optional(),
  userToken: z.string(),
});

const markThreadReadSchema = z.object({
  threadId: z.string(),
  userToken: z.string(),
});

export const threadTools: ToolDefinition[] = [
  {
    name: "get_thread_count",
    description: "获取未读线程数量和未读回复总数",
    parameters: getThreadCountSchema,
    execute: async (args, _context): Promise<ToolResult> => {
      try {
        const validatedArgs = getThreadCountSchema.parse(args);
        const result = await apiExecutor.get(
          "/api/threads/count",
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
    name: "get_unread_threads",
    description: "获取有未读回复的线程列表",
    parameters: getUnreadThreadsSchema,
    execute: async (args, _context): Promise<ToolResult> => {
      try {
        const validatedArgs = getUnreadThreadsSchema.parse(args);
        const params: Record<string, string> = {};

        if (validatedArgs.limit) params.limit = String(validatedArgs.limit);
        if (validatedArgs.offset) params.offset = String(validatedArgs.offset);

        const result = await apiExecutor.get(
          "/api/threads/unread",
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
    name: "mark_thread_read",
    description: "标记线程为已读",
    parameters: markThreadReadSchema,
    execute: async (args, _context): Promise<ToolResult> => {
      try {
        const validatedArgs = markThreadReadSchema.parse(args);
        const result = await apiExecutor.patch(
          `/api/threads/${validatedArgs.threadId}/read`,
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
];
