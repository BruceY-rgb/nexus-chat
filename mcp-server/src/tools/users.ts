/**
 * User Tools - User Management Tools
 */

import { z } from "zod";
import { apiExecutor } from "../executor.js";
import type {
  ToolDefinition,
  ExecutionContext,
  User,
  ToolResult,
} from "../types.js";

// Input schemas
const listUsersSchema = z.object({
  search: z.string().optional(),
  page: z.number().int().positive().optional(),
  limit: z.number().int().positive().max(100).optional(),
  activeOnly: z.boolean().optional(),
  userToken: z.string().optional(),
});

const searchUsersSchema = z.object({
  query: z.string(),
  userToken: z.string().optional(),
});

const getUnreadCountsSchema = z.object({
  userToken: z.string().optional(),
});

const getStarredUsersSchema = z.object({
  userToken: z.string().optional(),
});

const getUserSchema = z.object({
  userId: z.string(),
  userToken: z.string().optional(),
});

const toggleStarredUserSchema = z.object({
  starredUserId: z.string(),
  userToken: z.string().optional(),
});

export const userTools: ToolDefinition[] = [
  {
    name: "list_users",
    description: "Get user list with search and pagination support",
    parameters: listUsersSchema,
    execute: async (args, _context): Promise<ToolResult> => {
      try {
        const validatedArgs = listUsersSchema.parse(args);
        const result = await apiExecutor.get<User[]>(
          "/api/users",
          validatedArgs.userToken,
          {
            search: validatedArgs.search || "",
            page: String(validatedArgs.page || 1),
            limit: String(validatedArgs.limit || 50),
            activeOnly: String(validatedArgs.activeOnly || false),
          },
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
    name: "search_users",
    description: "Search users",
    parameters: searchUsersSchema,
    execute: async (args, _context): Promise<ToolResult> => {
      try {
        const validatedArgs = searchUsersSchema.parse(args);
        const result = await apiExecutor.get<User[]>(
          "/api/users/search",
          validatedArgs.userToken,
          { q: validatedArgs.query },
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
    name: "get_user",
    description: "Get specified user information",
    parameters: getUserSchema,
    execute: async (args, _context): Promise<ToolResult> => {
      try {
        const validatedArgs = getUserSchema.parse(args);
        const result = await apiExecutor.get(
          "/api/users",
          validatedArgs.userToken,
          { userId: validatedArgs.userId },
        );
        return {
          content: [{ type: "text", text: JSON.stringify(result) }],
        };
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        return {
          content: [{ type: "text", text: JSON.stringify({ error: errorMessage }) }],
          isError: true,
        };
      }
    },
  },
  {
    name: "get_unread_counts",
    description: "Get unread message count for all channels and DMs",
    parameters: getUnreadCountsSchema,
    execute: async (args, _context): Promise<ToolResult> => {
      try {
        const validatedArgs = getUnreadCountsSchema.parse(args);
        const result = await apiExecutor.get(
          "/api/users/unread-counts",
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
    name: "get_starred_users",
    description: "Get starred users list",
    parameters: getStarredUsersSchema,
    execute: async (args, _context): Promise<ToolResult> => {
      try {
        const validatedArgs = getStarredUsersSchema.parse(args);
        const result = await apiExecutor.get(
          "/api/users/starred",
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
    name: "toggle_starred_user",
    description: "Toggle user's starred status",
    parameters: toggleStarredUserSchema,
    execute: async (args, _context): Promise<ToolResult> => {
      try {
        const validatedArgs = toggleStarredUserSchema.parse(args);
        const result = await apiExecutor.post(
          "/api/users/starred",
          validatedArgs.userToken,
          { starredUserId: validatedArgs.starredUserId },
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
