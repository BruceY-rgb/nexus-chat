/**
 * Attachment Tools - 附件管理工具
 */

import { z } from 'zod';
import { apiExecutor } from '../executor.js';
import type { ToolDefinition, ToolResult } from '../types.js';

const getAttachmentsSchema = z.object({
  conversationId: z.string(),
  conversationType: z.enum(['channel', 'dm']),
  userToken: z.string(),
});

const deleteAttachmentSchema = z.object({
  attachmentId: z.string(),
  userToken: z.string(),
});

export const attachmentTools: ToolDefinition[] = [
  {
    name: 'get_attachments',
    description: '获取会话的附件列表',
    parameters: getAttachmentsSchema,
    execute: async (args, _context): Promise<ToolResult> => {
      try {
        const validatedArgs = getAttachmentsSchema.parse(args);
        const result = await apiExecutor.get(
          '/api/attachments',
          validatedArgs.userToken,
          {
            conversationId: validatedArgs.conversationId,
            conversationType: validatedArgs.conversationType,
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
    name: 'delete_attachment',
    description: '删除附件',
    parameters: deleteAttachmentSchema,
    execute: async (args, _context): Promise<ToolResult> => {
      try {
        const validatedArgs = deleteAttachmentSchema.parse(args);
        await apiExecutor.delete(
          `/api/attachments?id=${validatedArgs.attachmentId}`,
          validatedArgs.userToken
        );

        return {
          content: [{ type: 'text', text: JSON.stringify({ success: true, message: 'Attachment deleted' }) }],
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
