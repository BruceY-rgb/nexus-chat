/**
 * Message Tools - 消息管理工具
 */

import { z } from "zod";
import { apiExecutor } from "../executor.js";
import type {
  ToolDefinition,
  ExecutionContext,
  Message,
  ToolResult,
} from "../types.js";

// Input schemas
const listMessagesSchema = z.object({
  channelId: z.string().optional(),
  dmConversationId: z.string().optional(),
  limit: z.number().int().positive().max(100).optional(),
  offset: z.number().int().nonnegative().optional(),
  userToken: z.string(),
});

const sendMessageSchema = z.object({
  content: z.string().optional(),
  channelId: z.string().optional(),
  dmConversationId: z.string().optional(),
  attachments: z.array(z.any()).optional(),
  quote: z
    .object({
      messageId: z.string(),
      content: z.string(),
      userId: z.string(),
      userName: z.string(),
      avatarUrl: z.string().optional(),
      createdAt: z.string(),
    })
    .optional(),
  userToken: z.string(),
});

const getMessageSchema = z.object({
  messageId: z.string(),
  userToken: z.string(),
});

const updateMessageSchema = z.object({
  messageId: z.string(),
  content: z.string(),
  userToken: z.string(),
});

const deleteMessageSchema = z.object({
  messageId: z.string(),
  userToken: z.string(),
});

const replyToMessageSchema = z.object({
  messageId: z.string(),
  content: z.string().optional(),
  attachments: z.array(z.any()).optional(),
  userToken: z.string(),
});

const getThreadRepliesSchema = z.object({
  messageId: z.string(),
  userToken: z.string(),
});

const addReactionSchema = z.object({
  messageId: z.string(),
  emoji: z.string(),
  userToken: z.string(),
});

const removeReactionSchema = z.object({
  messageId: z.string(),
  emoji: z.string(),
  userToken: z.string(),
});

const searchMessagesSchema = z.object({
  query: z.string().optional(),
  channelId: z.string().optional(),
  dmConversationId: z.string().optional(),
  userId: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  userToken: z.string(),
});

const getReactionsSchema = z.object({
  messageId: z.string(),
  userToken: z.string(),
});

const contextSearchMessagesSchema = z.object({
  query: z.string(),
  channelId: z.string().optional(),
  dmConversationId: z.string().optional(),
  userToken: z.string(),
});

const markMessagesReadSchema = z.object({
  channelId: z.string().optional(),
  dmConversationId: z.string().optional(),
  lastReadMessageId: z.string().optional(),
  userToken: z.string(),
});

const markAllMessagesReadSchema = z.object({
  userToken: z.string(),
});

const clearMessagesSchema = z.object({
  channelId: z.string().optional(),
  dmConversationId: z.string().optional(),
  userToken: z.string(),
});

export const messageTools: ToolDefinition[] = [
  {
    name: "list_messages",
    description: "获取频道或私聊的消息列表",
    parameters: listMessagesSchema,
    execute: async (args, _context): Promise<ToolResult> => {
      try {
        const validatedArgs = listMessagesSchema.parse(args);
        const params: Record<string, string> = {};

        if (validatedArgs.channelId) params.channelId = validatedArgs.channelId;
        if (validatedArgs.dmConversationId)
          params.dmConversationId = validatedArgs.dmConversationId;
        params.limit = String(validatedArgs.limit || 50);
        params.offset = String(validatedArgs.offset || 0);

        const result = await apiExecutor.get<Message[]>(
          "/api/messages",
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
    name: "send_message",
    description: "发送消息到频道或私聊",
    parameters: sendMessageSchema,
    execute: async (args, _context): Promise<ToolResult> => {
      try {
        const validatedArgs = sendMessageSchema.parse(args);
        const result = await apiExecutor.post<Message>(
          "/api/messages",
          validatedArgs.userToken,
          {
            content: validatedArgs.content,
            channelId: validatedArgs.channelId,
            dmConversationId: validatedArgs.dmConversationId,
            attachments: validatedArgs.attachments,
            quote: validatedArgs.quote,
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
    name: "get_message",
    description: "获取单条消息详情",
    parameters: getMessageSchema,
    execute: async (args, _context): Promise<ToolResult> => {
      try {
        const validatedArgs = getMessageSchema.parse(args);
        const result = await apiExecutor.get<Message>(
          `/api/messages/${validatedArgs.messageId}`,
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
    name: "update_message",
    description: "更新消息内容",
    parameters: updateMessageSchema,
    execute: async (args, _context): Promise<ToolResult> => {
      try {
        const validatedArgs = updateMessageSchema.parse(args);
        const result = await apiExecutor.put<Message>(
          `/api/messages/${validatedArgs.messageId}`,
          validatedArgs.userToken,
          { content: validatedArgs.content },
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
    name: "delete_message",
    description: "删除消息",
    parameters: deleteMessageSchema,
    execute: async (args, _context): Promise<ToolResult> => {
      try {
        const validatedArgs = deleteMessageSchema.parse(args);
        await apiExecutor.delete(
          `/api/messages/${validatedArgs.messageId}`,
          validatedArgs.userToken,
        );

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: true,
                message: "Message deleted",
              }),
            },
          ],
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
    name: "reply_to_message",
    description: "回复消息（创建线程）",
    parameters: replyToMessageSchema,
    execute: async (args, _context): Promise<ToolResult> => {
      try {
        const validatedArgs = replyToMessageSchema.parse(args);
        const result = await apiExecutor.post<Message>(
          `/api/messages/${validatedArgs.messageId}/reply`,
          validatedArgs.userToken,
          {
            content: validatedArgs.content,
            attachments: validatedArgs.attachments,
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
    name: "get_thread_replies",
    description: "获取消息的线程回复",
    parameters: getThreadRepliesSchema,
    execute: async (args, _context): Promise<ToolResult> => {
      try {
        const validatedArgs = getThreadRepliesSchema.parse(args);
        const result = await apiExecutor.get<Message[]>(
          `/api/messages/${validatedArgs.messageId}/thread-replies`,
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
    name: "add_reaction",
    description: "为消息添加反应",
    parameters: addReactionSchema,
    execute: async (args, _context): Promise<ToolResult> => {
      try {
        const validatedArgs = addReactionSchema.parse(args);
        await apiExecutor.post(
          `/api/messages/${validatedArgs.messageId}/reactions`,
          validatedArgs.userToken,
          { emoji: validatedArgs.emoji },
        );

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: true,
                message: "Reaction added",
              }),
            },
          ],
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
    name: "remove_reaction",
    description: "移除消息的反应",
    parameters: removeReactionSchema,
    execute: async (args, _context): Promise<ToolResult> => {
      try {
        const validatedArgs = removeReactionSchema.parse(args);
        await apiExecutor.delete(
          `/api/messages/${validatedArgs.messageId}/reactions?emoji=${encodeURIComponent(validatedArgs.emoji)}`,
          validatedArgs.userToken,
        );

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: true,
                message: "Reaction removed",
              }),
            },
          ],
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
    name: "search_messages",
    description: "搜索消息，支持关键词、频道、用户、时间范围过滤",
    parameters: searchMessagesSchema,
    execute: async (args, _context): Promise<ToolResult> => {
      try {
        const validatedArgs = searchMessagesSchema.parse(args);
        const params: Record<string, string> = {};

        if (validatedArgs.query) params.query = validatedArgs.query;
        if (validatedArgs.channelId) params.channelId = validatedArgs.channelId;
        if (validatedArgs.dmConversationId)
          params.dmConversationId = validatedArgs.dmConversationId;
        if (validatedArgs.userId) params.userId = validatedArgs.userId;
        if (validatedArgs.startDate) params.startDate = validatedArgs.startDate;
        if (validatedArgs.endDate) params.endDate = validatedArgs.endDate;

        const result = await apiExecutor.get<Message[]>(
          "/api/messages/search",
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
    name: "get_reactions",
    description: "获取消息的反应列表",
    parameters: getReactionsSchema,
    execute: async (args, _context): Promise<ToolResult> => {
      try {
        const validatedArgs = getReactionsSchema.parse(args);
        const result = await apiExecutor.get(
          `/api/messages/${validatedArgs.messageId}/reactions`,
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
    name: "context_search_messages",
    description: "在指定频道或私聊中搜索消息",
    parameters: contextSearchMessagesSchema,
    execute: async (args, _context): Promise<ToolResult> => {
      try {
        const validatedArgs = contextSearchMessagesSchema.parse(args);
        const params: Record<string, string> = {};

        params.query = validatedArgs.query;
        if (validatedArgs.channelId) params.channelId = validatedArgs.channelId;
        if (validatedArgs.dmConversationId)
          params.dmConversationId = validatedArgs.dmConversationId;

        const result = await apiExecutor.get(
          "/api/messages/context-search",
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
    name: "mark_messages_read",
    description: "标记频道或私聊消息为已读",
    parameters: markMessagesReadSchema,
    execute: async (args, _context): Promise<ToolResult> => {
      try {
        const validatedArgs = markMessagesReadSchema.parse(args);
        const result = await apiExecutor.post(
          "/api/messages/read",
          validatedArgs.userToken,
          {
            channelId: validatedArgs.channelId,
            dmConversationId: validatedArgs.dmConversationId,
            lastReadMessageId: validatedArgs.lastReadMessageId,
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
    name: "mark_all_messages_read",
    description: "标记所有消息为已读",
    parameters: markAllMessagesReadSchema,
    execute: async (args, _context): Promise<ToolResult> => {
      try {
        const validatedArgs = markAllMessagesReadSchema.parse(args);
        const result = await apiExecutor.post(
          "/api/messages/read-all",
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
    name: "clear_messages",
    description: "清空频道或私聊的所有消息",
    parameters: clearMessagesSchema,
    execute: async (args, _context): Promise<ToolResult> => {
      try {
        const validatedArgs = clearMessagesSchema.parse(args);
        const result = await apiExecutor.post(
          "/api/messages/clear",
          validatedArgs.userToken,
          {
            channelId: validatedArgs.channelId,
            dmConversationId: validatedArgs.dmConversationId,
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
];
