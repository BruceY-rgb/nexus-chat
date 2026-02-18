/**
 * MCP HTTP 服务器
 * 提供 RESTful 接口供 Claude Desktop / Cursor 连接
 */

import express, { Request, Response } from 'express';
import cors from 'cors';
import { login as authLogin, verifyToken } from './auth.js';
import { tools, toolRegistry } from './tools/index.js';
import { resources, resourceHandlers } from './resources/index.js';
import type { ToolResult } from './types.js';

const app = express();

// 中间件
app.use(cors());
app.use(express.json());

// 全局请求日志中间件（用于调试请求是否到达）
app.use((req: Request, _res: Response, next) => {
  console.log('');
  console.log('========== 收到请求 ==========');
  console.log(`📌 Method: ${req.method}`);
  console.log(`🔗 URL: ${req.url}`);
  console.log(`📋 Headers:`, JSON.stringify(req.headers, null, 2));
  console.log('================================');
  console.log('');
  next();
});

// 端口配置
const PORT = process.env.PORT || 3002;
const HOST = process.env.HOST || '0.0.0.0';

// 外部访问 URL（用于日志显示）
const INTERNAL_API_URL = process.env.INTERNAL_API_URL || `http://${HOST}:${PORT}`;

// 路由

// 健康检查
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 登录接口
app.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const result = await authLogin(email, password);

    if (!result.success || !result.token) {
      return res.status(401).json({ error: result.error || 'Login failed' });
    }

    res.json({
      token: result.token,
      user: result.user,
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// MCP 消息处理
app.post('/mcp/messages', async (req: Request, res: Response) => {
  try {
    const message = req.body;
    const id = message?.id;

    // 验证 JSON-RPC 版本
    if (message?.jsonrpc !== '2.0') {
      return res.json({
        jsonrpc: '2.0',
        id,
        error: { code: -32600, message: 'Invalid JSON-RPC version' },
      });
    }

    const method = message?.method;
    const params = message?.params || {};

    // 从 Authorization header 获取 token
    const authHeader = req.headers.authorization;
    let userToken: string | null = null;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      userToken = authHeader.substring(7);
    }

    // 如果没有 token，检查 params 中的 userToken
    if (!userToken) {
      userToken = params?.arguments?.userToken as string;
    }

    // 对于不需要认证的工具，放行
    if (method === 'tools/call' && (params?.name === 'register' || params?.name === 'login')) {
      const result = await handleToolCall(params.name, params.arguments || {}, null);
      return res.json({ jsonrpc: '2.0', id, result });
    }

    // 验证 token
    if (!userToken) {
      return res.json({
        jsonrpc: '2.0',
        id,
        error: { code: -32001, message: 'Unauthorized: userToken is required' },
      });
    }

    const decoded = verifyToken(userToken);
    if (!decoded) {
      return res.json({
        jsonrpc: '2.0',
        id,
        error: { code: -32001, message: 'Unauthorized: invalid token' },
      });
    }

    // 处理 MCP 方法
    let result: unknown;

    switch (method) {
      case 'tools/list':
        result = {
          tools: tools.map((tool) => ({
            name: tool.name,
            description: tool.description,
            inputSchema: {
              type: 'object',
              properties: {}, // 简化处理
            },
          })),
        };
        break;

      case 'tools/call':
        result = await handleToolCall(params.name, params.arguments || {}, userToken);
        break;

      case 'resources/list':
        result = {
          resources: resources.map((resource) => ({
            uri: resource.uri,
            name: resource.name,
            description: resource.description,
            mimeType: resource.mimeType,
          })),
        };
        break;

      case 'resources/read':
        result = await handleResourceRead(params.uri, userToken);
        break;

      default:
        return res.json({
          jsonrpc: '2.0',
          id,
          error: { code: -32601, message: 'Method not found' },
        });
    }

    return res.json({ jsonrpc: '2.0', id, result });
  } catch (error) {
    console.error('MCP message error:', error);
    return res.json({
      jsonrpc: '2.0',
      id: req.body?.id,
      error: {
        code: -32603,
        message: error instanceof Error ? error.message : 'Internal error',
      },
    });
  }
});

// 处理工具调用
async function handleToolCall(
  toolName: string,
  args: Record<string, unknown>,
  userToken: string | null
): Promise<ToolResult> {
  // 认证工具不需要验证 token
  if (toolName === 'register' || toolName === 'login') {
    const tool = toolRegistry.get(toolName);
    if (!tool) {
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: `Tool '${toolName}' not found` }) }],
        isError: true,
      };
    }

    try {
      return await tool.execute(args, { userId: '', userToken: '' });
    } catch (error) {
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }) }],
        isError: true,
      };
    }
  }

  // 其他工具需要验证 token
  if (!userToken) {
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: 'userToken is required' }) }],
      isError: true,
    };
  }

  const tool = toolRegistry.get(toolName);
  if (!tool) {
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: `Tool '${toolName}' not found` }) }],
      isError: true,
    };
  }

  try {
    return await tool.execute(args, { userId: '', userToken });
  } catch (error) {
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }) }],
      isError: true,
    };
  }
}

// 处理资源读取
async function handleResourceRead(uri: string, userToken: string): Promise<{ contents: Array<{ uri: string; mimeType: string; text: string }> }> {
  const url = new URL(uri);
  const tokenParam = url.searchParams.get('userToken');

  // 优先使用 header 中的 token
  const actualToken = userToken || tokenParam;

  if (!actualToken) {
    return {
      contents: [
        {
          uri,
          mimeType: 'application/json',
          text: JSON.stringify({ error: 'userToken is required as query parameter' }),
        },
      ],
    };
  }

  const baseUri = `${url.protocol}//${url.host}${url.pathname}`;
  const handler = resourceHandlers.get(baseUri);

  if (!handler) {
    return {
      contents: [
        {
          uri,
          mimeType: 'application/json',
          text: JSON.stringify({ error: `Resource '${baseUri}' not found` }),
        },
      ],
    };
  }

  try {
    const params: Record<string, string> = {};
    url.searchParams.forEach((value, key) => {
      if (key !== 'userToken') {
        params[key] = value;
      }
    });

    const data = await handler(actualToken, params);
    return {
      contents: [
        {
          uri,
          mimeType: 'application/json',
          text: data,
        },
      ],
    };
  } catch (error) {
    return {
      contents: [
        {
          uri,
          mimeType: 'application/json',
          text: JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
        },
      ],
    };
  }
}

// SSE 端点（可选，用于未来扩展）
app.get('/mcp/sse', (_req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  // 发送连接消息
  res.write(`data: ${JSON.stringify({ type: 'connected' })}\n\n`);

  // 保持连接
  const keepAlive = setInterval(() => {
    res.write(`: keepalive\n\n`);
  }, 30000);

  _req.on('close', () => {
    clearInterval(keepAlive);
    res.end();
  });
});

// 启动服务器
export function startHttpServer(): Promise<void> {
  return new Promise((resolve) => {
    const port = typeof PORT === 'string' ? parseInt(PORT, 10) : PORT;
    const baseUrl = INTERNAL_API_URL || `http://localhost:${port}`;
    app.listen(port, HOST, () => {
      const startTime = new Date().toISOString();
      const MCP_MODE = process.env.MCP_MODE || 'http';

      console.log('');
      console.log('========================================');
      console.log('🚀 MCP Server 启动成功');
      console.log('========================================');
      console.log(`🌐 模式: ${MCP_MODE.toUpperCase()}`);
      console.log(`📍 端口: ${port}`);
      console.log(`🔗 健康检查: ${baseUrl}/health`);
      console.log(`🔐 登录接口: POST ${baseUrl}/login`);
      console.log(`📬 MCP消息: POST ${baseUrl}/mcp/messages`);
      console.log(`⏰ 启动时间: ${startTime}`);
      console.log('========================================');
      console.log('');

      resolve();
    });
  });
}

export { app };
