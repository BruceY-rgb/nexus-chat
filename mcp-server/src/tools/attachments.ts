/**
 * Attachment Tools - Attachment Management Tools
 */

import { z } from 'zod';
import { apiExecutor } from '../executor.js';
import type { ToolDefinition, ToolResult } from '../types.js';

const getAttachmentsSchema = z.object({
  conversationId: z.string(),
  conversationType: z.enum(['channel', 'dm']),
  userToken: z.string().optional(),
});

const deleteAttachmentSchema = z.object({
  attachmentId: z.string(),
  userToken: z.string().optional(),
});

const createAttachmentUploadUrlSchema = z.object({
  fileName: z.string().describe('Original file name with extension, e.g. "photo.jpg"'),
  mimeType: z.string().describe('MIME type, e.g. "image/jpeg"'),
  fileSize: z.number().optional().describe('File size in bytes (for validation)'),
  userToken: z.string().optional(),
});

export const attachmentTools: ToolDefinition[] = [
  {
    name: 'get_attachments',
    description: 'Get attachments list for conversation',
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
    description: 'Delete attachment',
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
  {
    name: 'create_attachment_upload_url',
    description: 'Get presigned URL for file upload. Agent flow: 1) Call this tool to get uploadUrl and attachment metadata 2) Use PUT request to upload file to uploadUrl 3) Pass metadata (fileName, mimeType, fileSize, s3Key, s3Bucket, fileUrl, thumbnailUrl) in attachments when calling send_message',
    parameters: createAttachmentUploadUrlSchema,
    execute: async (args, _context): Promise<ToolResult> => {
      try {
        const validatedArgs = createAttachmentUploadUrlSchema.parse(args);
        const result = await apiExecutor.post(
          '/api/upload/presign',
          validatedArgs.userToken,
          {
            fileName: validatedArgs.fileName,
            mimeType: validatedArgs.mimeType,
            fileSize: validatedArgs.fileSize,
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
];
