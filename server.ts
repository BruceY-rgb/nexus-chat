import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { setupWebSocket } from './src/lib/websocket-server';
import { spawn } from 'child_process';
import path from 'path';
import type { Server as SocketIOServer } from 'socket.io';

// 声明全局变量类型
declare global {
  var io: SocketIOServer | undefined;
  var mcpProcess: ReturnType<typeof spawn> | undefined;
}

const dev = process.env.NODE_ENV !== 'production';
// 修复：在容器化环境中必须监听 0.0.0.0 才能接受外部连接
const hostname = process.env.NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.1';
const port = 3000;

// 添加调试日志
console.log('🔍 Debug - Environment Check:', {
  NODE_ENV: process.env.NODE_ENV,
  isProduction: process.env.NODE_ENV === 'production',
  hostname,
  dev
});

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// 启动MCP服务器
function startMCPServer() {
  if (dev) {
    console.log('🤖 Starting MCP Server...');
    const mcpDir = path.join(process.cwd(), 'mcp-server');
    const mcpProcess = spawn('npm', ['run', 'dev'], {
      cwd: mcpDir,
      stdio: 'pipe',
      shell: true,
    });

    mcpProcess.stdout?.on('data', (data) => {
      console.log(`[MCP] ${data}`);
    });

    mcpProcess.stderr?.on('data', (data) => {
      console.error(`[MCP] ${data}`);
    });

    mcpProcess.on('error', (error) => {
      console.error('Failed to start MCP Server:', error);
    });

    mcpProcess.on('close', (code) => {
      console.log(`MCP Server exited with code ${code}`);
    });

    global.mcpProcess = mcpProcess;
    console.log('🤖 MCP Server started');
  }
}

app.prepare().then(() => {
  const httpServer = createServer(async (req, res) => {
    try {
      // 解析 URL
      const parsedUrl = parse(req.url || '/', true);

      // 处理请求
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('internal server error');
    }
  });

  // 设置 WebSocket 服务器
  const io = setupWebSocket(httpServer);

  // 将 io 实例存储到全局变量，以便 API 路由可以访问
  (global as any).io = io;
  (process as any).global = (global as any).io;

  // 添加调试日志
  console.log('🔧 [Setup] Global io instance set:', {
    globalExists: typeof (global as any).io !== 'undefined',
    processExists: typeof (process as any).global !== 'undefined',
    hasEngine: !!(global as any).io?.engine,
    hasNsps: !!(global as any).io?.nsps,
    socketCount: (global as any).io?.engine?.clientsCount
  });

  // 启动MCP服务器
  startMCPServer();

  // 错误处理
  httpServer
    .once('error', (err) => {
      console.error('Server error:', err);
      process.exit(1);
    })
    .listen(port, () => {
      console.log(`🚀 Server ready at http://${hostname}:${port}`);
      console.log(`🔌 WebSocket server ready for connections`);
      console.log(`📝 API endpoints available at http://${hostname}:${port}/api`);
      console.log(`🧪 MCP Test UI available at http://${hostname}:${port}/mcp-test`);
    });
});

// 处理进程退出
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down...');
  if (global.mcpProcess) {
    global.mcpProcess.kill();
  }
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Shutting down...');
  if (global.mcpProcess) {
    global.mcpProcess.kill();
  }
  process.exit(0);
});
