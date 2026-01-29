import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { setupWebSocket } from './src/lib/websocket-server';
import type { Server as SocketIOServer } from 'socket.io';

// 声明全局变量类型
declare global {
  var io: SocketIOServer | undefined;
}

const dev = process.env.NODE_ENV !== 'production';
// 修复：在容器化环境中必须监听 0.0.0.0 才能接受外部连接
const hostname = process.env.NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.1';
const port = 3000;

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

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
  global.io = io;

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
    });
});
