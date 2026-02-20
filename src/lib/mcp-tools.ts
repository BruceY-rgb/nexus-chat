"use strict";
/**
 * MCP Tools Executor - MCP tool executor that can be used in Next.js
 *
 * This module provides the ability to directly call MCP tools for HTTP API testing endpoints
 */

import { z } from "zod";

// Type definitions
interface ToolResult {
  content: Array<{
    type: "text" | "image" | "resource";
    text?: string;
    data?: string;
    mimeType?: string;
  }>;
  isError?: boolean;
}

interface ExecutionContext {
  userId: string;
  userToken: string;
}

// Tool definitions
interface ToolDefinition {
  name: string;
  description: string;
  parameters: z.ZodSchema;
  execute: (args: unknown, context: ExecutionContext) => Promise<ToolResult>;
}

// API Executor
class APIExecutor {
  private baseURL: string;

  constructor(baseURL?: string) {
    this.baseURL =
      baseURL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  }

  private async request<T>(
    method: string,
    endpoint: string,
    userToken: string,
    body?: unknown,
  ): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;

    const options: RequestInit = {
      method,
      headers: {
        "Content-Type": "application/json",
        Cookie: `auth_token=${userToken}`,
      },
    };

    if (body && method !== "GET") {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);

    if (!response.ok) {
      let errorMessage = `API error: ${response.status}`;
      try {
        const errorData = (await response.json()) as {
          message?: string;
          error?: string;
        };
        errorMessage = errorData.message || errorData.error || errorMessage;
      } catch {
        // Ignore parse errors
      }
      throw new Error(errorMessage);
    }

    const data = (await response.json()) as {
      success: boolean;
      data?: T;
      error?: string;
    };

    if (!data.success) {
      throw new Error(data.error || "Unknown error");
    }

    return data.data as T;
  }

  async get<T>(endpoint: string, userToken: string): Promise<T> {
    return this.request<T>("GET", endpoint, userToken);
  }

  async post<T>(
    endpoint: string,
    userToken: string,
    body?: unknown,
  ): Promise<T> {
    return this.request<T>("POST", endpoint, userToken, body);
  }

  async put<T>(
    endpoint: string,
    userToken: string,
    body?: unknown,
  ): Promise<T> {
    return this.request<T>("PUT", endpoint, userToken, body);
  }

  async patch<T>(
    endpoint: string,
    userToken: string,
    body?: unknown,
  ): Promise<T> {
    return this.request<T>("PATCH", endpoint, userToken, body);
  }

  async delete<T>(endpoint: string, userToken: string): Promise<T> {
    return this.request<T>("DELETE", endpoint, userToken);
  }

  async deleteWithBody<T>(
    endpoint: string,
    userToken: string,
    body?: unknown,
  ): Promise<T> {
    return this.request<T>("DELETE", endpoint, userToken, body);
  }

  // Requests that don't require authentication
  async publicPost<T>(endpoint: string, body?: unknown): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;

    const options: RequestInit = {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);

    if (!response.ok) {
      let errorMessage = `API error: ${response.status}`;
      try {
        const errorData = (await response.json()) as {
          message?: string;
          error?: string;
        };
        errorMessage = errorData.message || errorData.error || errorMessage;
      } catch {
        // Ignore parse errors
      }
      throw new Error(errorMessage);
    }

    const data = (await response.json()) as {
      success: boolean;
      data?: T;
      error?: string;
    };

    if (!data.success) {
      throw new Error(data.error || "Unknown error");
    }

    return data.data as T;
  }
}

const apiExecutor = new APIExecutor();

// Tool registry
const toolRegistry = new Map<string, ToolDefinition>();

// Register tool
function registerTool(tool: ToolDefinition) {
  toolRegistry.set(tool.name, tool);
}

// Auth Tools
registerTool({
  name: "register",
  description: "Register a new user",
  parameters: z.object({
    email: z.string().email(),
    password: z.string().min(6),
    name: z.string().min(1),
  }),
  execute: async (args): Promise<ToolResult> => {
    try {
      const result = await apiExecutor.publicPost<{
        user: { id: string; name: string; email: string };
        token: string;
      }>("/api/auth/register", args);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: true,
              message: "User registered successfully",
              userId: result.user.id,
              userName: result.user.name,
              email: result.user.email,
              token: result.token,
            }),
          },
        ],
      };
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ success: false, error: errorMessage }),
          },
        ],
        isError: true,
      };
    }
  },
});

registerTool({
  name: "login",
  description: "User login, get authentication token",
  parameters: z.object({
    email: z.string().email(),
    password: z.string(),
  }),
  execute: async (args): Promise<ToolResult> => {
    try {
      const result = await apiExecutor.publicPost<{
        user: { id: string; name: string; email: string };
        token: string;
      }>("/api/auth/login", args);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: true,
              message: "Login successful",
              userId: result.user.id,
              userName: result.user.name,
              email: result.user.email,
              token: result.token,
            }),
          },
        ],
      };
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ success: false, error: errorMessage }),
          },
        ],
        isError: true,
      };
    }
  },
});

// Channel Tools
registerTool({
  name: "list_channels",
  description: "Get all channel list",
  parameters: z.object({
    userToken: z.string().optional(),
  }),
  execute: async (args, context): Promise<ToolResult> => {
    try {
      const userToken =
        (args as { userToken?: string }).userToken || context.userToken;
      if (!userToken) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ error: "userToken is required" }),
            },
          ],
          isError: true,
        };
      }

      const result = await apiExecutor.get<{
        channels: Array<{
          id: string;
          name: string;
          description?: string;
          isPrivate: boolean;
        }>;
      }>("/api/channels", userToken);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: true,
              channels: result.channels,
              count: result.channels.length,
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
});

registerTool({
  name: "get_channel",
  description: "Get channel details",
  parameters: z.object({
    channelId: z.string(),
    userToken: z.string().optional(),
  }),
  execute: async (args, context): Promise<ToolResult> => {
    try {
      const { channelId } = args as { channelId: string; userToken?: string };
      const userToken =
        (args as { userToken?: string }).userToken || context.userToken;

      if (!userToken) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ error: "userToken is required" }),
            },
          ],
          isError: true,
        };
      }

      const result = await apiExecutor.get<{
        id: string;
        name: string;
        description?: string;
        isPrivate: boolean;
      }>(`/api/channels/${channelId}`, userToken);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ success: true, channel: result }),
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
});

registerTool({
  name: "create_channel",
  description: "Create a new channel",
  parameters: z.object({
    name: z.string(),
    description: z.string().optional(),
    isPrivate: z.boolean().optional(),
    userToken: z.string().optional(),
  }),
  execute: async (args, context): Promise<ToolResult> => {
    try {
      const userToken =
        (args as { userToken?: string }).userToken || context.userToken;

      if (!userToken) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ error: "userToken is required" }),
            },
          ],
          isError: true,
        };
      }

      const result = await apiExecutor.post<{
        id: string;
        name: string;
        description?: string;
        isPrivate: boolean;
      }>("/api/channels", userToken, args);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ success: true, channel: result }),
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
});

registerTool({
  name: "join_channel",
  description: "Join a channel",
  parameters: z.object({
    channelId: z.string(),
    userToken: z.string().optional(),
  }),
  execute: async (args, context): Promise<ToolResult> => {
    try {
      const { channelId } = args as { channelId: string; userToken?: string };
      const userToken =
        (args as { userToken?: string }).userToken || context.userToken;

      if (!userToken) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ error: "userToken is required" }),
            },
          ],
          isError: true,
        };
      }

      await apiExecutor.post(`/api/channels/${channelId}/join`, userToken, {});

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: true,
              message: "Joined channel successfully",
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
});

// Message Tools
registerTool({
  name: "send_message",
  description: "Send message to channel",
  parameters: z.object({
    channelId: z.string(),
    content: z.string(),
    userToken: z.string().optional(),
  }),
  execute: async (args, context): Promise<ToolResult> => {
    try {
      const { channelId, content } = args as {
        channelId: string;
        content: string;
        userToken?: string;
      };
      const userToken =
        (args as { userToken?: string }).userToken || context.userToken;

      if (!userToken) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ error: "userToken is required" }),
            },
          ],
          isError: true,
        };
      }

      const result = await apiExecutor.post<{
        id: string;
        content: string;
        channelId: string;
      }>(`/api/channels/${channelId}/messages`, userToken, { content });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ success: true, message: result }),
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
});

registerTool({
  name: "list_messages",
  description: "Get channel message list",
  parameters: z.object({
    channelId: z.string(),
    limit: z.number().optional(),
    userToken: z.string().optional(),
  }),
  execute: async (args, context): Promise<ToolResult> => {
    try {
      const { channelId, limit } = args as {
        channelId: string;
        limit?: number;
        userToken?: string;
      };
      const userToken =
        (args as { userToken?: string }).userToken || context.userToken;

      if (!userToken) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ error: "userToken is required" }),
            },
          ],
          isError: true,
        };
      }

      const queryParams = limit ? `?limit=${limit}` : "";
      const result = await apiExecutor.get<{
        messages: Array<{
          id: string;
          content: string;
          userId: string;
          createdAt: string;
        }>;
      }>(`/api/channels/${channelId}/messages${queryParams}`, userToken);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ success: true, messages: result.messages }),
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
});

// User Tools
registerTool({
  name: "list_users",
  description: "Get user list",
  parameters: z.object({
    userToken: z.string().optional(),
  }),
  execute: async (args, context): Promise<ToolResult> => {
    try {
      const userToken =
        (args as { userToken?: string }).userToken || context.userToken;

      if (!userToken) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ error: "userToken is required" }),
            },
          ],
          isError: true,
        };
      }

      const result = await apiExecutor.get<{
        users: Array<{
          id: string;
          name: string;
          email: string;
          avatarUrl?: string;
        }>;
      }>("/api/users", userToken);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ success: true, users: result.users }),
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
});

registerTool({
  name: "get_user",
  description: "Get current user information",
  parameters: z.object({
    userToken: z.string().optional(),
  }),
  execute: async (args, context): Promise<ToolResult> => {
    try {
      const userToken =
        (args as { userToken?: string }).userToken || context.userToken;

      if (!userToken) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ error: "userToken is required" }),
            },
          ],
          isError: true,
        };
      }

      const result = await apiExecutor.get<{
        id: string;
        name: string;
        email: string;
        avatarUrl?: string;
      }>("/api/users/me", userToken);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ success: true, user: result }),
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
});

// Helper to reduce boilerplate for tool execute functions
function getToken(args: unknown, context: ExecutionContext): string | null {
  return (
    (args as { userToken?: string }).userToken || context.userToken || null
  );
}

function errResult(msg: string): ToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify({ error: msg }) }],
    isError: true,
  };
}

function okResult(data: unknown): ToolResult {
  return { content: [{ type: "text", text: JSON.stringify(data) }] };
}

// Auth Tools (additional)
registerTool({
  name: "logout",
  description: "Logout current user",
  parameters: z.object({ userToken: z.string().optional() }),
  execute: async (args, context): Promise<ToolResult> => {
    try {
      const userToken = getToken(args, context);
      if (!userToken) return errResult("userToken is required");
      await apiExecutor.post("/api/auth/logout", userToken, {});
      return okResult({ success: true, message: "Logged out successfully" });
    } catch (error: unknown) {
      return errResult(
        error instanceof Error ? error.message : "Unknown error",
      );
    }
  },
});

registerTool({
  name: "get_me",
  description: "Get current authenticated user info",
  parameters: z.object({ userToken: z.string().optional() }),
  execute: async (args, context): Promise<ToolResult> => {
    try {
      const userToken = getToken(args, context);
      if (!userToken) return errResult("userToken is required");
      const result = await apiExecutor.get("/api/auth/me", userToken);
      return okResult(result);
    } catch (error: unknown) {
      return errResult(
        error instanceof Error ? error.message : "Unknown error",
      );
    }
  },
});

registerTool({
  name: "get_profile",
  description: "Get current user profile",
  parameters: z.object({ userToken: z.string().optional() }),
  execute: async (args, context): Promise<ToolResult> => {
    try {
      const userToken = getToken(args, context);
      if (!userToken) return errResult("userToken is required");
      const result = await apiExecutor.get("/api/auth/profile", userToken);
      return okResult(result);
    } catch (error: unknown) {
      return errResult(
        error instanceof Error ? error.message : "Unknown error",
      );
    }
  },
});

registerTool({
  name: "update_profile",
  description: "Update current user profile",
  parameters: z.object({
    displayName: z.string().optional(),
    realName: z.string().optional(),
    avatarUrl: z.string().optional(),
    timezone: z.string().optional(),
    userToken: z.string().optional(),
  }),
  execute: async (args, context): Promise<ToolResult> => {
    try {
      const { displayName, realName, avatarUrl, timezone } = args as {
        displayName?: string;
        realName?: string;
        avatarUrl?: string;
        timezone?: string;
      };
      const userToken = getToken(args, context);
      if (!userToken) return errResult("userToken is required");
      const result = await apiExecutor.put("/api/auth/profile", userToken, {
        displayName,
        realName,
        avatarUrl,
        timezone,
      });
      return okResult(result);
    } catch (error: unknown) {
      return errResult(
        error instanceof Error ? error.message : "Unknown error",
      );
    }
  },
});

registerTool({
  name: "send_verification",
  description: "Send email verification link",
  parameters: z.object({ email: z.string().email() }),
  execute: async (args): Promise<ToolResult> => {
    try {
      const result = await apiExecutor.publicPost(
        "/api/auth/send-verification",
        args,
      );
      return okResult(result);
    } catch (error: unknown) {
      return errResult(
        error instanceof Error ? error.message : "Unknown error",
      );
    }
  },
});

// Channel Tools (additional)
registerTool({
  name: "update_channel",
  description: "Update channel details",
  parameters: z.object({
    channelId: z.string(),
    name: z.string().optional(),
    description: z.string().optional(),
    isPrivate: z.boolean().optional(),
    userToken: z.string().optional(),
  }),
  execute: async (args, context): Promise<ToolResult> => {
    try {
      const { channelId, name, description, isPrivate } = args as {
        channelId: string;
        name?: string;
        description?: string;
        isPrivate?: boolean;
      };
      const userToken = getToken(args, context);
      if (!userToken) return errResult("userToken is required");
      const result = await apiExecutor.patch(
        `/api/channels/${channelId}`,
        userToken,
        {
          name,
          description,
          isPrivate,
        },
      );
      return okResult(result);
    } catch (error: unknown) {
      return errResult(
        error instanceof Error ? error.message : "Unknown error",
      );
    }
  },
});

registerTool({
  name: "leave_channel",
  description: "Leave a channel",
  parameters: z.object({
    channelId: z.string(),
    userToken: z.string().optional(),
  }),
  execute: async (args, context): Promise<ToolResult> => {
    try {
      const { channelId } = args as { channelId: string };
      const userToken = getToken(args, context);
      if (!userToken) return errResult("userToken is required");
      await apiExecutor.post(`/api/channels/${channelId}/leave`, userToken, {});
      return okResult({ success: true, message: "Left channel successfully" });
    } catch (error: unknown) {
      return errResult(
        error instanceof Error ? error.message : "Unknown error",
      );
    }
  },
});

registerTool({
  name: "join_all_channel_members",
  description: "Add all users to a channel",
  parameters: z.object({
    channelId: z.string(),
    userToken: z.string().optional(),
  }),
  execute: async (args, context): Promise<ToolResult> => {
    try {
      const { channelId } = args as { channelId: string };
      const userToken = getToken(args, context);
      if (!userToken) return errResult("userToken is required");
      const result = await apiExecutor.post(
        `/api/channels/${channelId}/join-all`,
        userToken,
        {},
      );
      return okResult(result);
    } catch (error: unknown) {
      return errResult(
        error instanceof Error ? error.message : "Unknown error",
      );
    }
  },
});

registerTool({
  name: "remove_channel_member",
  description: "Remove a member from a channel",
  parameters: z.object({
    channelId: z.string(),
    userId: z.string(),
    userToken: z.string().optional(),
  }),
  execute: async (args, context): Promise<ToolResult> => {
    try {
      const { channelId, userId } = args as {
        channelId: string;
        userId: string;
      };
      const userToken = getToken(args, context);
      if (!userToken) return errResult("userToken is required");
      const result = await apiExecutor.deleteWithBody(
        `/api/channels/${channelId}/members/remove`,
        userToken,
        { userId },
      );
      return okResult(result);
    } catch (error: unknown) {
      return errResult(
        error instanceof Error ? error.message : "Unknown error",
      );
    }
  },
});

registerTool({
  name: "list_channel_members",
  description: "List members of a channel",
  parameters: z.object({
    channelId: z.string(),
    userToken: z.string().optional(),
  }),
  execute: async (args, context): Promise<ToolResult> => {
    try {
      const { channelId } = args as { channelId: string };
      const userToken = getToken(args, context);
      if (!userToken) return errResult("userToken is required");
      const result = await apiExecutor.get(
        `/api/channels/${channelId}/members`,
        userToken,
      );
      return okResult(result);
    } catch (error: unknown) {
      return errResult(
        error instanceof Error ? error.message : "Unknown error",
      );
    }
  },
});

registerTool({
  name: "invite_channel_member",
  description: "Invite a user to a channel",
  parameters: z.object({
    channelId: z.string(),
    userId: z.string(),
    userToken: z.string().optional(),
  }),
  execute: async (args, context): Promise<ToolResult> => {
    try {
      const { channelId, userId } = args as {
        channelId: string;
        userId: string;
      };
      const userToken = getToken(args, context);
      if (!userToken) return errResult("userToken is required");
      const result = await apiExecutor.post(
        `/api/channels/${channelId}/invite`,
        userToken,
        { userIds: [userId] },
      );
      return okResult(result);
    } catch (error: unknown) {
      return errResult(
        error instanceof Error ? error.message : "Unknown error",
      );
    }
  },
});

registerTool({
  name: "delete_channel",
  description: "Delete a channel",
  parameters: z.object({
    channelId: z.string(),
    userToken: z.string().optional(),
  }),
  execute: async (args, context): Promise<ToolResult> => {
    try {
      const { channelId } = args as { channelId: string };
      const userToken = getToken(args, context);
      if (!userToken) return errResult("userToken is required");
      const result = await apiExecutor.delete(
        `/api/channels/${channelId}`,
        userToken,
      );
      return okResult(result);
    } catch (error: unknown) {
      return errResult(
        error instanceof Error ? error.message : "Unknown error",
      );
    }
  },
});

// Message Tools (additional)
registerTool({
  name: "update_message",
  description: "Update a message",
  parameters: z.object({
    messageId: z.string(),
    content: z.string(),
    userToken: z.string().optional(),
  }),
  execute: async (args, context): Promise<ToolResult> => {
    try {
      const { messageId, content } = args as {
        messageId: string;
        content: string;
      };
      const userToken = getToken(args, context);
      if (!userToken) return errResult("userToken is required");
      const result = await apiExecutor.patch(
        `/api/messages/${messageId}`,
        userToken,
        { content },
      );
      return okResult(result);
    } catch (error: unknown) {
      return errResult(
        error instanceof Error ? error.message : "Unknown error",
      );
    }
  },
});

registerTool({
  name: "delete_message",
  description: "Delete a message",
  parameters: z.object({
    messageId: z.string(),
    userToken: z.string().optional(),
  }),
  execute: async (args, context): Promise<ToolResult> => {
    try {
      const { messageId } = args as { messageId: string };
      const userToken = getToken(args, context);
      if (!userToken) return errResult("userToken is required");
      const result = await apiExecutor.delete(
        `/api/messages/${messageId}`,
        userToken,
      );
      return okResult(result);
    } catch (error: unknown) {
      return errResult(
        error instanceof Error ? error.message : "Unknown error",
      );
    }
  },
});

registerTool({
  name: "reply_to_message",
  description: "Reply to a message in a thread",
  parameters: z.object({
    messageId: z.string(),
    content: z.string(),
    userToken: z.string().optional(),
  }),
  execute: async (args, context): Promise<ToolResult> => {
    try {
      const { messageId, content } = args as {
        messageId: string;
        content: string;
      };
      const userToken = getToken(args, context);
      if (!userToken) return errResult("userToken is required");
      const result = await apiExecutor.post(
        `/api/messages/${messageId}/reply`,
        userToken,
        { content },
      );
      return okResult(result);
    } catch (error: unknown) {
      return errResult(
        error instanceof Error ? error.message : "Unknown error",
      );
    }
  },
});

registerTool({
  name: "get_thread_replies",
  description: "Get thread replies for a message",
  parameters: z.object({
    messageId: z.string(),
    userToken: z.string().optional(),
  }),
  execute: async (args, context): Promise<ToolResult> => {
    try {
      const { messageId } = args as { messageId: string };
      const userToken = getToken(args, context);
      if (!userToken) return errResult("userToken is required");
      const result = await apiExecutor.get(
        `/api/messages/${messageId}/thread-replies`,
        userToken,
      );
      return okResult(result);
    } catch (error: unknown) {
      return errResult(
        error instanceof Error ? error.message : "Unknown error",
      );
    }
  },
});

registerTool({
  name: "add_reaction",
  description: "Add a reaction to a message",
  parameters: z.object({
    messageId: z.string(),
    emoji: z.string(),
    userToken: z.string().optional(),
  }),
  execute: async (args, context): Promise<ToolResult> => {
    try {
      const { messageId, emoji } = args as { messageId: string; emoji: string };
      const userToken = getToken(args, context);
      if (!userToken) return errResult("userToken is required");
      const result = await apiExecutor.post(
        `/api/messages/${messageId}/reactions`,
        userToken,
        { emoji },
      );
      return okResult(result);
    } catch (error: unknown) {
      return errResult(
        error instanceof Error ? error.message : "Unknown error",
      );
    }
  },
});

registerTool({
  name: "remove_reaction",
  description: "Remove a reaction from a message",
  parameters: z.object({
    messageId: z.string(),
    emoji: z.string(),
    userToken: z.string().optional(),
  }),
  execute: async (args, context): Promise<ToolResult> => {
    try {
      const { messageId, emoji } = args as { messageId: string; emoji: string };
      const userToken = getToken(args, context);
      if (!userToken) return errResult("userToken is required");
      const result = await apiExecutor.delete(
        `/api/messages/${messageId}/reactions?emoji=${encodeURIComponent(emoji)}`,
        userToken,
      );
      return okResult(result);
    } catch (error: unknown) {
      return errResult(
        error instanceof Error ? error.message : "Unknown error",
      );
    }
  },
});

registerTool({
  name: "get_reactions",
  description: "Get reactions for a message",
  parameters: z.object({
    messageId: z.string(),
    userToken: z.string().optional(),
  }),
  execute: async (args, context): Promise<ToolResult> => {
    try {
      const { messageId } = args as { messageId: string };
      const userToken = getToken(args, context);
      if (!userToken) return errResult("userToken is required");
      const result = await apiExecutor.get(
        `/api/messages/${messageId}/reactions`,
        userToken,
      );
      return okResult(result);
    } catch (error: unknown) {
      return errResult(
        error instanceof Error ? error.message : "Unknown error",
      );
    }
  },
});

registerTool({
  name: "search_messages",
  description: "Search messages with optional filters",
  parameters: z.object({
    query: z.string(),
    channelId: z.string().optional(),
    userId: z.string().optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    userToken: z.string().optional(),
  }),
  execute: async (args, context): Promise<ToolResult> => {
    try {
      const { query, channelId, userId, startDate, endDate } = args as {
        query: string;
        channelId?: string;
        userId?: string;
        startDate?: string;
        endDate?: string;
      };
      const userToken = getToken(args, context);
      if (!userToken) return errResult("userToken is required");
      const params = new URLSearchParams({ query });
      if (channelId) params.set("channelId", channelId);
      if (userId) params.set("userId", userId);
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);
      const result = await apiExecutor.get(
        `/api/messages/search?${params.toString()}`,
        userToken,
      );
      return okResult(result);
    } catch (error: unknown) {
      return errResult(
        error instanceof Error ? error.message : "Unknown error",
      );
    }
  },
});

registerTool({
  name: "context_search_messages",
  description: "Search messages with context in a channel or DM",
  parameters: z.object({
    query: z.string(),
    channelId: z.string().optional(),
    dmConversationId: z.string().optional(),
    userToken: z.string().optional(),
  }),
  execute: async (args, context): Promise<ToolResult> => {
    try {
      const { query, channelId, dmConversationId } = args as {
        query: string;
        channelId?: string;
        dmConversationId?: string;
      };
      const userToken = getToken(args, context);
      if (!userToken) return errResult("userToken is required");
      const params = new URLSearchParams({ query });
      if (channelId) params.set("channelId", channelId);
      if (dmConversationId) params.set("dmConversationId", dmConversationId);
      const result = await apiExecutor.get(
        `/api/messages/context-search?${params.toString()}`,
        userToken,
      );
      return okResult(result);
    } catch (error: unknown) {
      return errResult(
        error instanceof Error ? error.message : "Unknown error",
      );
    }
  },
});

registerTool({
  name: "mark_messages_read",
  description: "Mark messages as read in a channel or DM",
  parameters: z.object({
    channelId: z.string().optional(),
    dmConversationId: z.string().optional(),
    lastReadMessageId: z.string().optional(),
    userToken: z.string().optional(),
  }),
  execute: async (args, context): Promise<ToolResult> => {
    try {
      const { channelId, dmConversationId, lastReadMessageId } = args as {
        channelId?: string;
        dmConversationId?: string;
        lastReadMessageId?: string;
      };
      const userToken = getToken(args, context);
      if (!userToken) return errResult("userToken is required");
      const result = await apiExecutor.post("/api/messages/read", userToken, {
        channelId,
        dmConversationId,
        lastReadMessageId,
      });
      return okResult(result);
    } catch (error: unknown) {
      return errResult(
        error instanceof Error ? error.message : "Unknown error",
      );
    }
  },
});

registerTool({
  name: "mark_all_messages_read",
  description: "Mark all messages as read",
  parameters: z.object({ userToken: z.string().optional() }),
  execute: async (args, context): Promise<ToolResult> => {
    try {
      const userToken = getToken(args, context);
      if (!userToken) return errResult("userToken is required");
      const result = await apiExecutor.post(
        "/api/messages/read-all",
        userToken,
        {},
      );
      return okResult(result);
    } catch (error: unknown) {
      return errResult(
        error instanceof Error ? error.message : "Unknown error",
      );
    }
  },
});

registerTool({
  name: "clear_messages",
  description: "Clear messages in a channel or DM",
  parameters: z.object({
    channelId: z.string().optional(),
    dmConversationId: z.string().optional(),
    userToken: z.string().optional(),
  }),
  execute: async (args, context): Promise<ToolResult> => {
    try {
      const { channelId, dmConversationId } = args as {
        channelId?: string;
        dmConversationId?: string;
      };
      const userToken = getToken(args, context);
      if (!userToken) return errResult("userToken is required");
      const result = await apiExecutor.post("/api/messages/clear", userToken, {
        channelId,
        dmConversationId,
      });
      return okResult(result);
    } catch (error: unknown) {
      return errResult(
        error instanceof Error ? error.message : "Unknown error",
      );
    }
  },
});

// User Tools (additional)
registerTool({
  name: "search_users",
  description: "Search users by query",
  parameters: z.object({ query: z.string(), userToken: z.string().optional() }),
  execute: async (args, context): Promise<ToolResult> => {
    try {
      const { query } = args as { query: string };
      const userToken = getToken(args, context);
      if (!userToken) return errResult("userToken is required");
      const result = await apiExecutor.get(
        `/api/users/search?q=${encodeURIComponent(query)}`,
        userToken,
      );
      return okResult(result);
    } catch (error: unknown) {
      return errResult(
        error instanceof Error ? error.message : "Unknown error",
      );
    }
  },
});

registerTool({
  name: "get_unread_counts",
  description: "Get unread message counts",
  parameters: z.object({ userToken: z.string().optional() }),
  execute: async (args, context): Promise<ToolResult> => {
    try {
      const userToken = getToken(args, context);
      if (!userToken) return errResult("userToken is required");
      const result = await apiExecutor.get(
        "/api/users/unread-counts",
        userToken,
      );
      return okResult(result);
    } catch (error: unknown) {
      return errResult(
        error instanceof Error ? error.message : "Unknown error",
      );
    }
  },
});

registerTool({
  name: "get_starred_users",
  description: "Get list of starred users",
  parameters: z.object({ userToken: z.string().optional() }),
  execute: async (args, context): Promise<ToolResult> => {
    try {
      const userToken = getToken(args, context);
      if (!userToken) return errResult("userToken is required");
      const result = await apiExecutor.get("/api/users/starred", userToken);
      return okResult(result);
    } catch (error: unknown) {
      return errResult(
        error instanceof Error ? error.message : "Unknown error",
      );
    }
  },
});

registerTool({
  name: "toggle_starred_user",
  description: "Toggle starred status for a user",
  parameters: z.object({
    starredUserId: z.string(),
    userToken: z.string().optional(),
  }),
  execute: async (args, context): Promise<ToolResult> => {
    try {
      const { starredUserId } = args as { starredUserId: string };
      const userToken = getToken(args, context);
      if (!userToken) return errResult("userToken is required");
      const result = await apiExecutor.post("/api/users/starred", userToken, {
        starredUserId,
      });
      return okResult(result);
    } catch (error: unknown) {
      return errResult(
        error instanceof Error ? error.message : "Unknown error",
      );
    }
  },
});

// Conversation Tools
registerTool({
  name: "create_dm",
  description: "Create a direct message conversation",
  parameters: z.object({
    userId: z.string(),
    userToken: z.string().optional(),
  }),
  execute: async (args, context): Promise<ToolResult> => {
    try {
      const { userId } = args as { userId: string };
      const userToken = getToken(args, context);
      if (!userToken) return errResult("userToken is required");
      const result = await apiExecutor.post(
        "/api/conversations/dm",
        userToken,
        { userId },
      );
      return okResult(result);
    } catch (error: unknown) {
      return errResult(
        error instanceof Error ? error.message : "Unknown error",
      );
    }
  },
});

registerTool({
  name: "get_dm",
  description: "Get a direct message conversation with a user",
  parameters: z.object({
    userId: z.string(),
    userToken: z.string().optional(),
  }),
  execute: async (args, context): Promise<ToolResult> => {
    try {
      const { userId } = args as { userId: string };
      const userToken = getToken(args, context);
      if (!userToken) return errResult("userToken is required");
      const result = await apiExecutor.get(
        `/api/conversations/dm/${userId}`,
        userToken,
      );
      return okResult(result);
    } catch (error: unknown) {
      return errResult(
        error instanceof Error ? error.message : "Unknown error",
      );
    }
  },
});

registerTool({
  name: "list_active_dms",
  description: "List active direct message conversations",
  parameters: z.object({
    search: z.string().optional(),
    userToken: z.string().optional(),
  }),
  execute: async (args, context): Promise<ToolResult> => {
    try {
      const { search } = args as { search?: string };
      const userToken = getToken(args, context);
      if (!userToken) return errResult("userToken is required");
      const qs = search ? `?search=${encodeURIComponent(search)}` : "";
      const result = await apiExecutor.get(
        `/api/conversations/dm/active${qs}`,
        userToken,
      );
      return okResult(result);
    } catch (error: unknown) {
      return errResult(
        error instanceof Error ? error.message : "Unknown error",
      );
    }
  },
});

registerTool({
  name: "get_read_position",
  description: "Get read position for a channel or DM",
  parameters: z.object({
    channelId: z.string().optional(),
    dmConversationId: z.string().optional(),
    userToken: z.string().optional(),
  }),
  execute: async (args, context): Promise<ToolResult> => {
    try {
      const { channelId, dmConversationId } = args as {
        channelId?: string;
        dmConversationId?: string;
      };
      const userToken = getToken(args, context);
      if (!userToken) return errResult("userToken is required");
      const params = new URLSearchParams();
      if (channelId) params.set("channelId", channelId);
      if (dmConversationId) params.set("dmConversationId", dmConversationId);
      const result = await apiExecutor.get(
        `/api/conversations/read-position?${params.toString()}`,
        userToken,
      );
      return okResult(result);
    } catch (error: unknown) {
      return errResult(
        error instanceof Error ? error.message : "Unknown error",
      );
    }
  },
});

// Thread Tools
registerTool({
  name: "get_thread_count",
  description: "Get count of threads for the current user",
  parameters: z.object({ userToken: z.string().optional() }),
  execute: async (args, context): Promise<ToolResult> => {
    try {
      const userToken = getToken(args, context);
      if (!userToken) return errResult("userToken is required");
      const result = await apiExecutor.get("/api/threads/count", userToken);
      return okResult(result);
    } catch (error: unknown) {
      return errResult(
        error instanceof Error ? error.message : "Unknown error",
      );
    }
  },
});

registerTool({
  name: "get_unread_threads",
  description: "Get unread threads for the current user",
  parameters: z.object({
    limit: z.number().optional(),
    offset: z.number().optional(),
    userToken: z.string().optional(),
  }),
  execute: async (args, context): Promise<ToolResult> => {
    try {
      const { limit, offset } = args as { limit?: number; offset?: number };
      const userToken = getToken(args, context);
      if (!userToken) return errResult("userToken is required");
      const params = new URLSearchParams();
      if (limit !== undefined) params.set("limit", String(limit));
      if (offset !== undefined) params.set("offset", String(offset));
      const qs = params.toString();
      const result = await apiExecutor.get(
        `/api/threads/unread${qs ? `?${qs}` : ""}`,
        userToken,
      );
      return okResult(result);
    } catch (error: unknown) {
      return errResult(
        error instanceof Error ? error.message : "Unknown error",
      );
    }
  },
});

registerTool({
  name: "mark_thread_read",
  description: "Mark a thread as read",
  parameters: z.object({
    threadId: z.string(),
    userToken: z.string().optional(),
  }),
  execute: async (args, context): Promise<ToolResult> => {
    try {
      const { threadId } = args as { threadId: string };
      const userToken = getToken(args, context);
      if (!userToken) return errResult("userToken is required");
      const result = await apiExecutor.patch(
        `/api/threads/${threadId}/read`,
        userToken,
        {},
      );
      return okResult(result);
    } catch (error: unknown) {
      return errResult(
        error instanceof Error ? error.message : "Unknown error",
      );
    }
  },
});

// Notification Tools
registerTool({
  name: "get_channel_notification_prefs",
  description: "Get notification preferences for a channel",
  parameters: z.object({
    channelId: z.string(),
    userToken: z.string().optional(),
  }),
  execute: async (args, context): Promise<ToolResult> => {
    try {
      const { channelId } = args as { channelId: string };
      const userToken = getToken(args, context);
      if (!userToken) return errResult("userToken is required");
      const result = await apiExecutor.get(
        `/api/channels/${channelId}/notification-preferences`,
        userToken,
      );
      return okResult(result);
    } catch (error: unknown) {
      return errResult(
        error instanceof Error ? error.message : "Unknown error",
      );
    }
  },
});

registerTool({
  name: "update_channel_notification_prefs",
  description: "Update notification preferences for a channel",
  parameters: z.object({
    channelId: z.string(),
    notificationLevel: z.enum(["all", "mentions", "nothing"]),
    userToken: z.string().optional(),
  }),
  execute: async (args, context): Promise<ToolResult> => {
    try {
      const { channelId, notificationLevel } = args as {
        channelId: string;
        notificationLevel: string;
      };
      const userToken = getToken(args, context);
      if (!userToken) return errResult("userToken is required");
      const result = await apiExecutor.patch(
        `/api/channels/${channelId}/notification-preferences`,
        userToken,
        {
          notificationLevel,
        },
      );
      return okResult(result);
    } catch (error: unknown) {
      return errResult(
        error instanceof Error ? error.message : "Unknown error",
      );
    }
  },
});

registerTool({
  name: "get_dm_notification_prefs",
  description: "Get notification preferences for a DM conversation",
  parameters: z.object({
    conversationId: z.string(),
    userToken: z.string().optional(),
  }),
  execute: async (args, context): Promise<ToolResult> => {
    try {
      const { conversationId } = args as { conversationId: string };
      const userToken = getToken(args, context);
      if (!userToken) return errResult("userToken is required");
      const result = await apiExecutor.get(
        `/api/dm-conversations/${conversationId}/notification-preferences`,
        userToken,
      );
      return okResult(result);
    } catch (error: unknown) {
      return errResult(
        error instanceof Error ? error.message : "Unknown error",
      );
    }
  },
});

registerTool({
  name: "update_dm_notification_prefs",
  description: "Update notification preferences for a DM conversation",
  parameters: z.object({
    conversationId: z.string(),
    notificationLevel: z.enum(["all", "mentions", "nothing"]),
    userToken: z.string().optional(),
  }),
  execute: async (args, context): Promise<ToolResult> => {
    try {
      const { conversationId, notificationLevel } = args as {
        conversationId: string;
        notificationLevel: string;
      };
      const userToken = getToken(args, context);
      if (!userToken) return errResult("userToken is required");
      const result = await apiExecutor.patch(
        `/api/dm-conversations/${conversationId}/notification-preferences`,
        userToken,
        {
          notificationLevel,
        },
      );
      return okResult(result);
    } catch (error: unknown) {
      return errResult(
        error instanceof Error ? error.message : "Unknown error",
      );
    }
  },
});

// Attachment Tools
registerTool({
  name: "get_attachments",
  description: "Get attachments for a channel or DM conversation",
  parameters: z.object({
    conversationId: z.string(),
    conversationType: z.enum(["channel", "dm"]),
    userToken: z.string().optional(),
  }),
  execute: async (args, context): Promise<ToolResult> => {
    try {
      const { conversationId, conversationType } = args as {
        conversationId: string;
        conversationType: string;
      };
      const userToken = getToken(args, context);
      if (!userToken) return errResult("userToken is required");
      const result = await apiExecutor.get(
        `/api/attachments?conversationId=${encodeURIComponent(conversationId)}&conversationType=${encodeURIComponent(conversationType)}`,
        userToken,
      );
      return okResult(result);
    } catch (error: unknown) {
      return errResult(
        error instanceof Error ? error.message : "Unknown error",
      );
    }
  },
});

registerTool({
  name: "delete_attachment",
  description: "Delete an attachment",
  parameters: z.object({
    attachmentId: z.string(),
    userToken: z.string().optional(),
  }),
  execute: async (args, context): Promise<ToolResult> => {
    try {
      const { attachmentId } = args as { attachmentId: string };
      const userToken = getToken(args, context);
      if (!userToken) return errResult("userToken is required");
      const result = await apiExecutor.delete(
        `/api/attachments?id=${encodeURIComponent(attachmentId)}`,
        userToken,
      );
      return okResult(result);
    } catch (error: unknown) {
      return errResult(
        error instanceof Error ? error.message : "Unknown error",
      );
    }
  },
});

// Health Tool
registerTool({
  name: "health_check",
  description: "Check API health status",
  parameters: z.object({ userToken: z.string().optional() }),
  execute: async (): Promise<ToolResult> => {
    try {
      const url = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/health`;
      const response = await fetch(url);
      const data = await response.json();
      return okResult(data);
    } catch (error: unknown) {
      return errResult(
        error instanceof Error ? error.message : "Unknown error",
      );
    }
  },
});

// Export tool list
const tools = Array.from(toolRegistry.values());

export interface ExecuteToolParams {
  name: string;
  arguments: Record<string, unknown>;
  userToken?: string;
}

export interface ToolInfo {
  name: string;
  description: string;
  parameters: {
    properties: Record<string, unknown>;
    required: string[];
  };
}

/**
 * Get list of all available tools
 */
export function getMCPTools(): ToolInfo[] {
  return tools.map((tool) => {
    const shape =
      (
        tool.parameters as { _def?: { shape?: () => Record<string, unknown> } }
      )._def?.shape?.() || {};
    const properties: Record<string, unknown> = {};
    const required: string[] = [];

    for (const [key, value] of Object.entries(shape)) {
      if (key === "userToken") continue;

      const zodDef = (
        value as {
          _def?: {
            typeName?: string;
            innerType?: unknown;
            options?: unknown[];
          };
        }
      )._def;
      if (!zodDef) continue;

      const prop: Record<string, unknown> = {};
      const typeName = zodDef.typeName;

      if (typeName === "ZodString") {
        prop.type = "string";
      } else if (typeName === "ZodNumber") {
        prop.type = "number";
      } else if (typeName === "ZodBoolean") {
        prop.type = "boolean";
      } else if (typeName === "ZodOptional") {
        const inner = (zodDef.innerType as { _def?: { typeName?: string } })
          ?._def;
        if (inner?.typeName === "ZodString") prop.type = "string";
        else if (inner?.typeName === "ZodNumber") prop.type = "number";
        else if (inner?.typeName === "ZodBoolean") prop.type = "boolean";
        continue;
      } else if (typeName === "ZodEnum") {
        prop.type = "string";
        prop.enum = zodDef.options;
      } else if (typeName === "ZodArray") {
        prop.type = "array";
      } else if (typeName === "ZodObject") {
        prop.type = "object";
      }

      properties[key] = prop;
      required.push(key);
    }

    return {
      name: tool.name,
      description: tool.description,
      parameters: { properties, required },
    };
  });
}

/**
 * Execute MCP tool
 */
export async function executeMCPTool(
  params: ExecuteToolParams,
): Promise<ToolResult> {
  const { name, arguments: args, userToken = "" } = params;

  // Public tools don't need userToken
  if (
    name === "register" ||
    name === "login" ||
    name === "send_verification" ||
    name === "health_check"
  ) {
    const tool = toolRegistry.get(name);
    if (!tool) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ error: `Tool '${name}' not found` }),
          },
        ],
        isError: true,
      };
    }

    try {
      const result = await tool.execute(args, { userId: "", userToken: "" });
      return result;
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
  }

  // Other tools need userToken
  if (!userToken) {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ error: "userToken is required" }),
        },
      ],
      isError: true,
    };
  }

  const tool = toolRegistry.get(name);
  if (!tool) {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ error: `Tool '${name}' not found` }),
        },
      ],
      isError: true,
    };
  }

  try {
    const result = await tool.execute(args, { userId: "", userToken });
    return result;
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
}

export { toolRegistry, tools };
