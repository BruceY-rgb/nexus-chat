/**
 * Tools Index - Tool Registry
 */

import { authTools } from "./auth.js";
import { channelTools } from "./channels.js";
import { messageTools } from "./messages.js";
import { userTools } from "./users.js";
import { conversationTools } from "./conversations.js";
import { notificationTools } from "./notifications.js";
import { attachmentTools } from "./attachments.js";
import { healthTools } from "./health.js";
import { threadTools } from "./threads.js";
import type { ToolDefinition } from "../types.js";

// Merge all tools
export const tools: ToolDefinition[] = [
  ...authTools,
  ...channelTools,
  ...messageTools,
  ...userTools,
  ...conversationTools,
  ...notificationTools,
  ...attachmentTools,
  ...healthTools,
  ...threadTools,
];

// Tool registry (for quick lookup)
export const toolRegistry: Map<string, ToolDefinition> = new Map(
  tools.map((tool) => [tool.name, tool]),
);
