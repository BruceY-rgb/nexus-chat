/**
 * Notification Tools - Notification Preference Management Tools
 */

import { z } from 'zod';
import { apiExecutor } from '../executor.js';
import type { ToolDefinition, ToolResult } from '../types.js';

const notificationLevelEnum = z.enum(['all', 'mentions', 'nothing']);

const getChannelNotifPrefsSchema = z.object({
  channelId: z.string(),
  userToken: z.string(),
});

const updateChannelNotifPrefsSchema = z.object({
  channelId: z.string(),
  notificationLevel: notificationLevelEnum,
  userToken: z.string(),
});

const getDmNotifPrefsSchema = z.object({
  conversationId: z.string(),
  userToken: z.string(),
});

const updateDmNotifPrefsSchema = z.object({
  conversationId: z.string(),
  notificationLevel: notificationLevelEnum,
  userToken: z.string(),
});

export const notificationTools: ToolDefinition[] = [
  {
    name: 'get_channel_notification_prefs',
    description: 'Get channel notification preference settings',
    parameters: getChannelNotifPrefsSchema,
    execute: async (args, _context): Promise<ToolResult> => {
      try {
        const validatedArgs = getChannelNotifPrefsSchema.parse(args);
        const result = await apiExecutor.get(
          `/api/channels/${validatedArgs.channelId}/notification-preferences`,
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
  {
    name: 'update_channel_notification_prefs',
    description: 'Update channel notification preference settings',
    parameters: updateChannelNotifPrefsSchema,
    execute: async (args, _context): Promise<ToolResult> => {
      try {
        const validatedArgs = updateChannelNotifPrefsSchema.parse(args);
        const result = await apiExecutor.patch(
          `/api/channels/${validatedArgs.channelId}/notification-preferences`,
          validatedArgs.userToken,
          { notificationLevel: validatedArgs.notificationLevel }
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
    name: 'get_dm_notification_prefs',
    description: 'Get DM notification preference settings',
    parameters: getDmNotifPrefsSchema,
    execute: async (args, _context): Promise<ToolResult> => {
      try {
        const validatedArgs = getDmNotifPrefsSchema.parse(args);
        const result = await apiExecutor.get(
          `/api/dm-conversations/${validatedArgs.conversationId}/notification-preferences`,
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
  {
    name: 'update_dm_notification_prefs',
    description: 'Update DM notification preference settings',
    parameters: updateDmNotifPrefsSchema,
    execute: async (args, _context): Promise<ToolResult> => {
      try {
        const validatedArgs = updateDmNotifPrefsSchema.parse(args);
        const result = await apiExecutor.patch(
          `/api/dm-conversations/${validatedArgs.conversationId}/notification-preferences`,
          validatedArgs.userToken,
          { notificationLevel: validatedArgs.notificationLevel }
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
