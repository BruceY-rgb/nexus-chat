#!/usr/bin/env node

/**
 * Socket 通信调试脚本
 *
 * 使用方法：
 * 1. 确保服务器已启动：npm run dev
 * 2. 在浏览器中登录并获取 auth_token
 * 3. 运行：node scripts/debug-socket.js
 * 4. 按照提示输入 token 或使用其他选项
 */

const io = require('socket.io-client');
const readline = require('readline');

// 获取服务器 URL - 支持 HTTPS/WSS
const getServerUrl = () => {
  const url = process.env.NEXT_PUBLIC_APP_URL || 'http://127.0.0.1:3000';
  let serverUrl: string;

  if (url.startsWith('https://')) {
    // HTTPS 页面必须使用 WSS
    serverUrl = url.replace(/^https:/, 'wss:');
  } else if (url.startsWith('http://')) {
    // HTTP 页面使用 WS
    serverUrl = url.replace(/^http:/, 'ws:');
  } else {
    // 如果没有协议，根据环境判断
    const isProduction = process.env.NODE_ENV === 'production';
    const protocol = isProduction ? 'wss' : 'ws';
    serverUrl = `${protocol}://${url}`;
  }

  // 添加 socket.io 路径
  if (!serverUrl.endsWith('/socket.io')) {
    serverUrl = `${serverUrl}/socket.io`;
  }

  console.log(`Generating WebSocket URL:`, {
    originalUrl: url,
    wsUrl: serverUrl,
    protocol: serverUrl.split('://')[0]
  });

  return serverUrl;
};

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const WS_URL = getServerUrl();

console.log('\nSocket Communication Debug Tool\n');
console.log(`Server address: ${WS_URL}`);
console.log('\nSelect debug method:');
console.log('1. Manual token input');
console.log('2. Get from environment variable (DEBUG_TOKEN)');
console.log('3. Get from localStorage');
console.log('4. Skip auth test (connection only)\n');

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(color, message) {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logStep(step, message) {
  console.log(`\n${colors.cyan}[${step}]${colors.reset} ${message}`);
}

// 获取 token
async function getToken() {
  return new Promise((resolve) => {
    rl.question('Select (1-4): ', (answer) => {
      switch (answer) {
        case '1':
          rl.question('Enter auth_token: ', (token) => {
            resolve(token);
          });
          break;
        case '2':
          resolve(process.env.DEBUG_TOKEN);
          break;
        case '3':
          console.log('\nRun in browser console:');
          console.log('localStorage.getItem("auth_token") or');
          console.log('document.cookie.split(";").find(r=>r.startsWith("auth_token=")).split("=")[1]');
          rl.question('Paste token: ', (token) => {
            resolve(token);
          });
          break;
        case '4':
          resolve(null);
          break;
        default:
          log('red', 'Invalid selection');
          process.exit(1);
      }
    });
  });
}

// 测试 WebSocket 连接
async function testConnection(token) {
  return new Promise((resolve, reject) => {
    logStep('1', 'Testing WebSocket connection...');

    const options = {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
      timeout: 20000,
      // 强制安全连接（HTTPS 环境下自动使用 WSS）
      secure: true,
      // 如果使用自签名证书，允许不验证证书
      rejectUnauthorized: false,
      // 启用自动连接
      autoConnect: true,
      // 增强的连接参数
      upgrade: true,
      rememberUpgrade: true
    };

    if (token) {
      options.auth = { token };
    }

    console.log(`Connection options:`, {
      url: WS_URL,
      transports: options.transports,
      secure: options.secure,
      reconnection: options.reconnection
    });

    const socket = io(WS_URL, options);

    const timeout = setTimeout(() => {
      log('red', 'X Connection timeout (5 seconds)');
      socket.disconnect();
      reject(new Error('Connection timeout'));
    }, 5000);

    socket.on('connect', () => {
      clearTimeout(timeout);
      log('green', `X WebSocket connected!`);
      log('cyan', `   Socket ID: ${socket.id}`);
      resolve(socket);
    });

    socket.on('connect_error', (error) => {
      clearTimeout(timeout);
      log('red', `X Connection error: ${error.message}`);
      log('yellow', `   Error type: ${error.type}`);
      if (error.description) {
        log('yellow', `   Error description: ${error.description}`);
      }
      reject(error);
    });

    socket.on('error', (error) => {
      log('red', `X Socket error: ${error.message}`);
    });
  });
}

// 测试频道加入
async function testJoinChannel(socket) {
  return new Promise((resolve) => {
    logStep('2', 'Testing channel operations...');

    rl.question('Enter channel ID (or press Enter to skip): ', async (channelId) => {
      if (!channelId) {
        log('yellow', 'Skipping channel test');
        return resolve();
      }

      socket.emit('join-channel', channelId);

      socket.once('error', (error) => {
        log('red', `X Failed to join channel: ${error.message}`);
        resolve();
      });

      setTimeout(() => {
        log('green', `X Sent join channel request: ${channelId}`);
        resolve();
      }, 1000);
    });
  });
}

// 测试私聊加入
async function testJoinDM(socket) {
  return new Promise((resolve) => {
    logStep('3', 'Testing DM operations...');

    rl.question('Enter DM ID (or press Enter to skip): ', async (conversationId) => {
      if (!conversationId) {
        log('yellow', 'Skipping DM test');
        return resolve();
      }

      socket.emit('join-dm', conversationId);

      setTimeout(() => {
        log('green', `X Sent join DM request: ${conversationId}`);
        resolve();
      }, 1000);
    });
  });
}

// 交互式测试
function interactiveMode(socket) {
  logStep('4', 'Entering interactive mode');

  console.log('\nAvailable commands:');
  console.log('  join-channel <id>  - Join channel');
  console.log('  join-dm <id>       - Join DM');
  console.log('  typing-start       - Start typing');
  console.log('  typing-stop        - Stop typing');
  console.log('  status             - View connection status');
  console.log('  events             - Listen to all events');
  console.log('  quit               - Quit\n');

  const events = new Set();

  function listenToEvents() {
    socket.onAny((eventName, ...args) => {
      if (!events.has(eventName)) {
        events.add(eventName);
        console.log(`New event: ${eventName}`);
      }
      if (events.size <= 10) {
        console.log(`   ${eventName}:`, JSON.stringify(args[0], null, 2));
      }
    });
  }

  listenToEvents();

  rl.question('Command> ', (input) => {
    const [cmd, ...args] = input.trim().split(' ');

    switch (cmd) {
      case 'join-channel':
        if (args[0]) {
          socket.emit('join-channel', args[0]);
          console.log(`Sent join channel: ${args[0]}`);
        } else {
          console.log('X Please specify channel ID');
        }
        break;

      case 'join-dm':
        if (args[0]) {
          socket.emit('join-dm', args[0]);
          console.log(`Sent join DM: ${args[0]}`);
        } else {
          console.log('X Please specify DM ID');
        }
        break;

      case 'typing-start':
        socket.emit('typing-start', {});
        console.log('Sent typing start');
        break;

      case 'typing-stop':
        socket.emit('typing-stop', {});
        console.log('Sent typing stop');
        break;

      case 'status':
        console.log('Connection status:');
        console.log(`   Connected: ${socket.connected ? 'Yes' : 'No'}`);
        console.log(`   Socket ID: ${socket.id || 'N/A'}`);
        console.log(`   Socket.IO version: ${io.version}`);
        break;

      case 'events':
        console.log('Listening events:');
        events.forEach(e => console.log(`   - ${e}`));
        break;

      case 'quit':
        console.log('\nClosing connection...');
        socket.close();
        rl.close();
        return;

      case '':
        // 忽略空输入
        break;

      default:
        console.log(`X Unknown command: ${cmd}`);
    }

    // 继续等待下一个命令
    interactiveMode(socket);
  });
}

// 发送测试消息
async function testSendMessage(token) {
  return new Promise((resolve) => {
    logStep('5', 'Testing message sending');

    rl.question('Send test message? (y/N): ', async (answer) => {
      if (answer.toLowerCase() !== 'y') {
        log('yellow', 'Skipping message send test');
        return resolve();
      }

      rl.question('Enter message content: ', async (content) => {
        rl.question('Select type (1.Channel 2.DM 3.Skip): ', async (type) => {
          try {
            let payload = {
              content: content || 'Test message'
            };

            if (type === '1') {
              rl.question('Channel ID: ', (id) => {
                payload.channelId = id;
                sendHTTPMessage(payload, token);
              });
            } else if (type === '2') {
              rl.question('DM ID: ', (id) => {
                payload.dmConversationId = id;
                sendHTTPMessage(payload, token);
              });
            } else {
              return resolve();
            }

            function sendHTTPMessage(data, authToken) {
              const http = require('http');
              const postData = JSON.stringify(data);

              const headers = {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData)
              };

              // 添加认证 Cookie
              if (authToken) {
                headers['Cookie'] = `auth_token=${authToken}`;
              }

              const options = {
                hostname: '127.0.0.1',
                port: 3000,
                path: '/api/messages',
                method: 'POST',
                headers: headers
              };

              const req = http.request(options, (res) => {
                let body = '';
                res.on('data', (chunk) => {
                  body += chunk;
                });
                res.on('end', () => {
                  console.log(`\nHTTP Response:`);
                  console.log(`   Status: ${res.statusCode} ${res.statusMessage}`);
                  console.log(`   Response: ${body}`);

                  if (res.statusCode === 200) {
                    log('green', 'X Message sent successfully!');
                  } else {
                    log('red', 'X Message sending failed');
                  }

                  resolve();
                });
              });

              req.on('error', (e) => {
                console.error(`X Request error: ${e.message}`);
                resolve();
              });

              req.write(postData);
              req.end();
            }
          } catch (error) {
            console.error(`X Error: ${error.message}`);
            resolve();
          }
        });
      });
    });
  });
}

// 主函数
async function main() {
  try {
    console.log('='.repeat(50));
    console.log('Socket Communication Debug Tool');
    console.log('='.repeat(50));

    const token = await getToken();

    if (!token) {
      log('yellow', 'No token provided, skipping auth');
    } else {
      log('green', `Token: ${token.substring(0, 20)}...`);
    }

    const socket = await testConnection(token);

    await testJoinChannel(socket);
    await testJoinDM(socket);

    await testSendMessage(token);

    console.log('\n' + '='.repeat(50));
    console.log('X Debug completed');
    console.log('='.repeat(50));

    rl.question('\nEnter interactive mode? (y/N): ', (answer) => {
      if (answer.toLowerCase() === 'y') {
        interactiveMode(socket);
      } else {
        console.log('\nClosing connection...');
        socket.close();
        rl.close();
        process.exit(0);
      }
    });

  } catch (error) {
    log('red', `\nError during debug: ${error.message}`);
    console.error(error);
    rl.close();
    process.exit(1);
  }
}

// 优雅退出
process.on('SIGINT', () => {
  console.log('\n\nExiting...');
  process.exit(0);
});

// 运行主函数
main();
