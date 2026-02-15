'use strict';
/**
 * MCP Tools Executor - 可在Next.js中使用的MCP工具执行器
 *
 * 这个模块提供了直接调用MCP工具的能力，用于HTTP API测试端点
 */

import { z } from 'zod';

// 类型定义
interface ToolResult {
  content: Array<{
    type: 'text' | 'image' | 'resource';
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

// 工具定义
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
    this.baseURL = baseURL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  }

  private async request<T>(
    method: string,
    endpoint: string,
    userToken: string,
    body?: unknown
  ): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;

    const options: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `auth_token=${userToken}`,
      },
    };

    if (body && method !== 'GET') {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);

    if (!response.ok) {
      let errorMessage = `API error: ${response.status}`;
      try {
        const errorData = await response.json() as { message?: string; error?: string };
        errorMessage = errorData.message || errorData.error || errorMessage;
      } catch {
        // Ignore parse errors
      }
      throw new Error(errorMessage);
    }

    const data = await response.json() as { success: boolean; data?: T; error?: string };

    if (!data.success) {
      throw new Error(data.error || 'Unknown error');
    }

    return data.data as T;
  }

  async get<T>(endpoint: string, userToken: string): Promise<T> {
    return this.request<T>('GET', endpoint, userToken);
  }

  async post<T>(endpoint: string, userToken: string, body?: unknown): Promise<T> {
    return this.request<T>('POST', endpoint, userToken, body);
  }

  async put<T>(endpoint: string, userToken: string, body?: unknown): Promise<T> {
    return this.request<T>('PUT', endpoint, userToken, body);
  }

  async delete<T>(endpoint: string, userToken: string): Promise<T> {
    return this.request<T>('DELETE', endpoint, userToken);
  }

  // 不需要认证的请求
  async publicPost<T>(endpoint: string, body?: unknown): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;

    const options: RequestInit = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);

    if (!response.ok) {
      let errorMessage = `API error: ${response.status}`;
      try {
        const errorData = await response.json() as { message?: string; error?: string };
        errorMessage = errorData.message || errorData.error || errorMessage;
      } catch {
        // Ignore parse errors
      }
      throw new Error(errorMessage);
    }

    const data = await response.json() as { success: boolean; data?: T; error?: string };

    if (!data.success) {
      throw new Error(data.error || 'Unknown error');
    }

    return data.data as T;
  }
}

const apiExecutor = new APIExecutor();

// 工具注册表
const toolRegistry = new Map<string, ToolDefinition>();

// 注册工具
function registerTool(tool: ToolDefinition) {
  toolRegistry.set(tool.name, tool);
}

// Auth Tools
registerTool({
  name: 'register',
  description: '注册新用户',
  parameters: z.object({
    email: z.string().email(),
    password: z.string().min(6),
    name: z.string().min(1),
  }),
  execute: async (args): Promise<ToolResult> => {
    try {
      const result = await apiExecutor.publicPost<{ user: { id: string; name: string; email: string }; token: string }>(
        '/api/auth/register',
        args
      );

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              message: 'User registered successfully',
              userId: result.user.id,
              userName: result.user.name,
              email: result.user.email,
              token: result.token,
            }),
          },
        ],
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ success: false, error: errorMessage }),
          },
        ],
        isError: true,
      };
    }
  },
});

registerTool({
  name: 'login',
  description: '用户登录，获取认证Token',
  parameters: z.object({
    email: z.string().email(),
    password: z.string(),
  }),
  execute: async (args): Promise<ToolResult> => {
    try {
      const result = await apiExecutor.publicPost<{ user: { id: string; name: string; email: string }; token: string }>(
        '/api/auth/login',
        args
      );

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              message: 'Login successful',
              userId: result.user.id,
              userName: result.user.name,
              email: result.user.email,
              token: result.token,
            }),
          },
        ],
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        content: [
          {
            type: 'text',
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
  name: 'list_channels',
  description: '获取所有频道列表',
  parameters: z.object({
    userToken: z.string().optional(),
  }),
  execute: async (args, context): Promise<ToolResult> => {
    try {
      const userToken = (args as { userToken?: string }).userToken || context.userToken;
      if (!userToken) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ error: 'userToken is required' }) }],
          isError: true,
        };
      }

      const result = await apiExecutor.get<{ channels: Array<{ id: string; name: string; description?: string; isPrivate: boolean }> }>(
        '/api/channels',
        userToken
      );

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              channels: result.channels,
              count: result.channels.length,
            }),
          },
        ],
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: errorMessage }) }],
        isError: true,
      };
    }
  },
});

registerTool({
  name: 'get_channel',
  description: '获取频道详情',
  parameters: z.object({
    channelId: z.string(),
    userToken: z.string().optional(),
  }),
  execute: async (args, context): Promise<ToolResult> => {
    try {
      const { channelId } = args as { channelId: string; userToken?: string };
      const userToken = (args as { userToken?: string }).userToken || context.userToken;

      if (!userToken) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ error: 'userToken is required' }) }],
          isError: true,
        };
      }

      const result = await apiExecutor.get<{ id: string; name: string; description?: string; isPrivate: boolean }>(
        `/api/channels/${channelId}`,
        userToken
      );

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ success: true, channel: result }),
          },
        ],
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: errorMessage }) }],
        isError: true,
      };
    }
  },
});

registerTool({
  name: 'create_channel',
  description: '创建新频道',
  parameters: z.object({
    name: z.string(),
    description: z.string().optional(),
    isPrivate: z.boolean().optional(),
    userToken: z.string().optional(),
  }),
  execute: async (args, context): Promise<ToolResult> => {
    try {
      const userToken = (args as { userToken?: string }).userToken || context.userToken;

      if (!userToken) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ error: 'userToken is required' }) }],
          isError: true,
        };
      }

      const result = await apiExecutor.post<{ id: string; name: string; description?: string; isPrivate: boolean }>(
        '/api/channels',
        userToken,
        args
      );

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ success: true, channel: result }),
          },
        ],
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: errorMessage }) }],
        isError: true,
      };
    }
  },
});

registerTool({
  name: 'join_channel',
  description: '加入频道',
  parameters: z.object({
    channelId: z.string(),
    userToken: z.string().optional(),
  }),
  execute: async (args, context): Promise<ToolResult> => {
    try {
      const { channelId } = args as { channelId: string; userToken?: string };
      const userToken = (args as { userToken?: string }).userToken || context.userToken;

      if (!userToken) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ error: 'userToken is required' }) }],
          isError: true,
        };
      }

      await apiExecutor.post(
        `/api/channels/${channelId}/join`,
        userToken,
        {}
      );

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ success: true, message: 'Joined channel successfully' }),
          },
        ],
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: errorMessage }) }],
        isError: true,
      };
    }
  },
});

// Message Tools
registerTool({
  name: 'send_message',
  description: '发送消息到频道',
  parameters: z.object({
    channelId: z.string(),
    content: z.string(),
    userToken: z.string().optional(),
  }),
  execute: async (args, context): Promise<ToolResult> => {
    try {
      const { channelId, content } = args as { channelId: string; content: string; userToken?: string };
      const userToken = (args as { userToken?: string }).userToken || context.userToken;

      if (!userToken) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ error: 'userToken is required' }) }],
          isError: true,
        };
      }

      const result = await apiExecutor.post<{ id: string; content: string; channelId: string }>(
        `/api/channels/${channelId}/messages`,
        userToken,
        { content }
      );

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ success: true, message: result }),
          },
        ],
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: errorMessage }) }],
        isError: true,
      };
    }
  },
});

registerTool({
  name: 'list_messages',
  description: '获取频道消息列表',
  parameters: z.object({
    channelId: z.string(),
    limit: z.number().optional(),
    userToken: z.string().optional(),
  }),
  execute: async (args, context): Promise<ToolResult> => {
    try {
      const { channelId, limit } = args as { channelId: string; limit?: number; userToken?: string };
      const userToken = (args as { userToken?: string }).userToken || context.userToken;

      if (!userToken) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ error: 'userToken is required' }) }],
          isError: true,
        };
      }

      const queryParams = limit ? `?limit=${limit}` : '';
      const result = await apiExecutor.get<{ messages: Array<{ id: string; content: string; userId: string; createdAt: string }> }>(
        `/api/channels/${channelId}/messages${queryParams}`,
        userToken
      );

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ success: true, messages: result.messages }),
          },
        ],
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: errorMessage }) }],
        isError: true,
      };
    }
  },
});

// User Tools
registerTool({
  name: 'list_users',
  description: '获取用户列表',
  parameters: z.object({
    userToken: z.string().optional(),
  }),
  execute: async (args, context): Promise<ToolResult> => {
    try {
      const userToken = (args as { userToken?: string }).userToken || context.userToken;

      if (!userToken) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ error: 'userToken is required' }) }],
          isError: true,
        };
      }

      const result = await apiExecutor.get<{ users: Array<{ id: string; name: string; email: string; avatarUrl?: string }> }>(
        '/api/users',
        userToken
      );

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ success: true, users: result.users }),
          },
        ],
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: errorMessage }) }],
        isError: true,
      };
    }
  },
});

registerTool({
  name: 'get_user',
  description: '获取当前用户信息',
  parameters: z.object({
    userToken: z.string().optional(),
  }),
  execute: async (args, context): Promise<ToolResult> => {
    try {
      const userToken = (args as { userToken?: string }).userToken || context.userToken;

      if (!userToken) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ error: 'userToken is required' }) }],
          isError: true,
        };
      }

      const result = await apiExecutor.get<{ id: string; name: string; email: string; avatarUrl?: string }>(
        '/api/users/me',
        userToken
      );

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ success: true, user: result }),
          },
        ],
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: errorMessage }) }],
        isError: true,
      };
    }
  },
});

// 导出工具列表
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
 * 获取所有可用工具列表
 */
export function getMCPTools(): ToolInfo[] {
  return tools.map((tool) => {
    const shape = (tool.parameters as { _def?: { shape?: () => Record<string, unknown> } })._def?.shape?.() || {};
    const properties: Record<string, unknown> = {};
    const required: string[] = [];

    for (const [key, value] of Object.entries(shape)) {
      if (key === 'userToken') continue;

      const zodDef = (value as { _def?: { typeName?: string; innerType?: unknown; options?: unknown[] } })._def;
      if (!zodDef) continue;

      const prop: Record<string, unknown> = {};
      const typeName = zodDef.typeName;

      if (typeName === 'ZodString') {
        prop.type = 'string';
      } else if (typeName === 'ZodNumber') {
        prop.type = 'number';
      } else if (typeName === 'ZodBoolean') {
        prop.type = 'boolean';
      } else if (typeName === 'ZodOptional') {
        const inner = (zodDef.innerType as { _def?: { typeName?: string } })?._def;
        if (inner?.typeName === 'ZodString') prop.type = 'string';
        else if (inner?.typeName === 'ZodNumber') prop.type = 'number';
        else if (inner?.typeName === 'ZodBoolean') prop.type = 'boolean';
        continue;
      } else if (typeName === 'ZodEnum') {
        prop.type = 'string';
        prop.enum = zodDef.options;
      } else if (typeName === 'ZodArray') {
        prop.type = 'array';
      } else if (typeName === 'ZodObject') {
        prop.type = 'object';
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
 * 执行MCP工具
 */
export async function executeMCPTool(params: ExecuteToolParams): Promise<ToolResult> {
  const { name, arguments: args, userToken = '' } = params;

  // 注册和登录工具不需要userToken
  if (name === 'register' || name === 'login') {
    const tool = toolRegistry.get(name);
    if (!tool) {
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: `Tool '${name}' not found` }) }],
        isError: true,
      };
    }

    try {
      const result = await tool.execute(args, { userId: '', userToken: '' });
      return result;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: errorMessage }) }],
        isError: true,
      };
    }
  }

  // 其他工具需要userToken
  if (!userToken) {
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: 'userToken is required' }) }],
      isError: true,
    };
  }

  const tool = toolRegistry.get(name);
  if (!tool) {
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: `Tool '${name}' not found` }) }],
      isError: true,
    };
  }

  try {
    const result = await tool.execute(args, { userId: '', userToken });
    return result;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: errorMessage }) }],
      isError: true,
    };
  }
}

export { toolRegistry, tools };
