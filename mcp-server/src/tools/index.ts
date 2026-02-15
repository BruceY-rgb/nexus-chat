/**
 * Tools Index - 工具注册表
 */

import { authTools } from './auth.js';
import { channelTools } from './channels.js';
import { messageTools } from './messages.js';
import { userTools } from './users.js';
import { conversationTools } from './conversations.js';
import type { ToolDefinition } from '../types.js';

// 合并所有工具
export const tools: ToolDefinition[] = [
  ...authTools,
  ...channelTools,
  ...messageTools,
  ...userTools,
  ...conversationTools,
];

// 工具注册表 (用于快速查找)
export const toolRegistry: Map<string, ToolDefinition> = new Map(
  tools.map((tool) => [tool.name, tool])
);
