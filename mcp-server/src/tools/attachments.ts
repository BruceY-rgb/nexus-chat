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

const createAttachmentUploadUrlSchema = z.object({
  fileName: z.string().describe('Original file name with extension, e.g. "photo.jpg"'),
  mimeType: z.string().describe('MIME type, e.g. "image/jpeg"'),
  fileSize: z.number().optional().describe('File size in bytes (for validation)'),
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
  {
    name: 'create_attachment_upload_url',
    description: '获取文件上传的预签名URL。Agent流程: 1) 调用此工具获取uploadUrl和attachment元数据 2) 用PUT请求将文件上传到uploadUrl 3) 调用send_message时在attachments中传入元数据(fileName, mimeType, fileSize, s3Key, s3Bucket, fileUrl, thumbnailUrl)',
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
