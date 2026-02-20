/**
 * MCP Server Types
 */

import { z } from "zod";

// API Response types
export interface APIResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Tool execution context
export interface ExecutionContext {
  userId: string;
  userToken: string;
}

// Tool definition
export interface ToolDefinition {
  name: string;
  description: string;
  parameters: z.ZodSchema;
  execute: (args: unknown, context: ExecutionContext) => Promise<ToolResult>;
}

// Tool result
export interface ToolResult {
  content: Array<{
    type: "text" | "image" | "resource";
    text?: string;
    data?: string;
    mimeType?: string;
  }>;
  isError?: boolean;
}

// Resource definition
export interface ResourceDefinition {
  uri: string;
  name: string;
  description: string;
  mimeType: string;
}

// Channel types
export interface Channel {
  id: string;
  name: string;
  description?: string;
  isPrivate: boolean;
  createdAt: string;
  updatedAt: string;
}

// Message types
export interface Message {
  id: string;
  content: string;
  channelId?: string;
  dmConversationId?: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

// User types
export interface User {
  id: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
  createdAt: string;
}

// Auth types
export interface LoginResponse {
  user: User;
  token: string;
}

export interface RegisterInput {
  email: string;
  password: string;
  displayName: string;
}

export interface LoginInput {
  email: string;
  password: string;
}
