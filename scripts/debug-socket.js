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

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const WS_URL = 'http://127.0.0.1:3000';

console.log('\n🔍 Socket 通信调试工具\n');
console.log('请选择调试方式：');
console.log('1. 手动输入 token');
console.log('2. 从环境变量获取 (DEBUG_TOKEN)');
console.log('3. 从本地存储获取');
console.log('4. 跳过认证测试（仅测试连接）\n');

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
    rl.question('请选择 (1-4): ', (answer) => {
      switch (answer) {
        case '1':
          rl.question('请输入 auth_token: ', (token) => {
            resolve(token);
          });
          break;
        case '2':
          resolve(process.env.DEBUG_TOKEN);
          break;
        case '3':
          console.log('\n请在浏览器控制台运行：');
          console.log('localStorage.getItem("auth_token") 或');
          console.log('document.cookie.split(";").find(r=>r.startsWith("auth_token=")).split("=")[1]');
          rl.question('请粘贴 token: ', (token) => {
            resolve(token);
          });
          break;
        case '4':
          resolve(null);
          break;
        default:
          log('red', '无效选择');
          process.exit(1);
      }
    });
  });
}

// 测试 WebSocket 连接
async function testConnection(token) {
  return new Promise((resolve, reject) => {
    logStep('1', '测试 WebSocket 连接...');

    const options = {
      transports: ['websocket', 'polling']
    };

    if (token) {
      options.auth = { token };
    }

    const socket = io(WS_URL, options);

    const timeout = setTimeout(() => {
      log('red', '❌ 连接超时 (5秒)');
      socket.disconnect();
      reject(new Error('Connection timeout'));
    }, 5000);

    socket.on('connect', () => {
      clearTimeout(timeout);
      log('green', `✅ WebSocket 连接成功！`);
      log('cyan', `   Socket ID: ${socket.id}`);
      resolve(socket);
    });

    socket.on('connect_error', (error) => {
      clearTimeout(timeout);
      log('red', `❌ 连接错误: ${error.message}`);
      log('yellow', `   错误类型: ${error.type}`);
      if (error.description) {
        log('yellow', `   错误描述: ${error.description}`);
      }
      reject(error);
    });

    socket.on('error', (error) => {
      log('red', `❌ Socket 错误: ${error.message}`);
    });
  });
}

// 测试频道加入
async function testJoinChannel(socket) {
  return new Promise((resolve) => {
    logStep('2', '测试频道操作...');

    rl.question('请输入频道 ID (或按回车跳过): ', async (channelId) => {
      if (!channelId) {
        log('yellow', '⏭️  跳过频道测试');
        return resolve();
      }

      socket.emit('join-channel', channelId);

      socket.once('error', (error) => {
        log('red', `❌ 加入频道失败: ${error.message}`);
        resolve();
      });

      setTimeout(() => {
        log('green', `✅ 已发送加入频道请求: ${channelId}`);
        resolve();
      }, 1000);
    });
  });
}

// 测试私聊加入
async function testJoinDM(socket) {
  return new Promise((resolve) => {
    logStep('3', '测试私聊操作...');

    rl.question('请输入私聊 ID (或按回车跳过): ', async (conversationId) => {
      if (!conversationId) {
        log('yellow', '⏭️  跳过私聊测试');
        return resolve();
      }

      socket.emit('join-dm', conversationId);

      setTimeout(() => {
        log('green', `✅ 已发送加入私聊请求: ${conversationId}`);
        resolve();
      }, 1000);
    });
  });
}

// 交互式测试
function interactiveMode(socket) {
  logStep('4', '进入交互模式');

  console.log('\n可用命令：');
  console.log('  join-channel <id>  - 加入频道');
  console.log('  join-dm <id>       - 加入私聊');
  console.log('  typing-start       - 开始打字');
  console.log('  typing-stop        - 停止打字');
  console.log('  status             - 查看连接状态');
  console.log('  events             - 监听所有事件');
  console.log('  quit               - 退出\n');

  const events = new Set();

  function listenToEvents() {
    socket.onAny((eventName, ...args) => {
      if (!events.has(eventName)) {
        events.add(eventName);
        console.log(`📡 新事件: ${eventName}`);
      }
      if (events.size <= 10) {
        console.log(`   ${eventName}:`, JSON.stringify(args[0], null, 2));
      }
    });
  }

  listenToEvents();

  rl.question('命令> ', (input) => {
    const [cmd, ...args] = input.trim().split(' ');

    switch (cmd) {
      case 'join-channel':
        if (args[0]) {
          socket.emit('join-channel', args[0]);
          console.log(`📥 已发送加入频道: ${args[0]}`);
        } else {
          console.log('❌ 请指定频道 ID');
        }
        break;

      case 'join-dm':
        if (args[0]) {
          socket.emit('join-dm', args[0]);
          console.log(`📥 已发送加入私聊: ${args[0]}`);
        } else {
          console.log('❌ 请指定私聊 ID');
        }
        break;

      case 'typing-start':
        socket.emit('typing-start', {});
        console.log('⌨️  已发送打字开始');
        break;

      case 'typing-stop':
        socket.emit('typing-stop', {});
        console.log('⌨️  已发送打字停止');
        break;

      case 'status':
        console.log('📊 连接状态:');
        console.log(`   已连接: ${socket.connected ? '是' : '否'}`);
        console.log(`   Socket ID: ${socket.id || 'N/A'}`);
        console.log(`   Socket.IO 版本: ${io.version}`);
        break;

      case 'events':
        console.log('📡 监听的事件:');
        events.forEach(e => console.log(`   - ${e}`));
        break;

      case 'quit':
        console.log('\n👋 正在关闭连接...');
        socket.close();
        rl.close();
        return;

      case '':
        // 忽略空输入
        break;

      default:
        console.log(`❌ 未知命令: ${cmd}`);
    }

    // 继续等待下一个命令
    interactiveMode(socket);
  });
}

// 发送测试消息
async function testSendMessage(token) {
  return new Promise((resolve) => {
    logStep('5', '测试消息发送');

    rl.question('是否发送测试消息? (y/N): ', async (answer) => {
      if (answer.toLowerCase() !== 'y') {
        log('yellow', '⏭️  跳过消息发送测试');
        return resolve();
      }

      rl.question('请输入消息内容: ', async (content) => {
        rl.question('请选择类型 (1.频道 2.私聊 3.跳过): ', async (type) => {
          try {
            let payload = {
              content: content || '测试消息'
            };

            if (type === '1') {
              rl.question('频道 ID: ', (id) => {
                payload.channelId = id;
                sendHTTPMessage(payload, token);
              });
            } else if (type === '2') {
              rl.question('私聊 ID: ', (id) => {
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
                  console.log(`\n📥 HTTP 响应:`);
                  console.log(`   状态: ${res.statusCode} ${res.statusMessage}`);
                  console.log(`   响应: ${body}`);

                  if (res.statusCode === 200) {
                    log('green', '✅ 消息发送成功！');
                  } else {
                    log('red', '❌ 消息发送失败');
                  }

                  resolve();
                });
              });

              req.on('error', (e) => {
                console.error(`❌ 请求错误: ${e.message}`);
                resolve();
              });

              req.write(postData);
              req.end();
            }
          } catch (error) {
            console.error(`❌ 错误: ${error.message}`);
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
    console.log('Socket 通信调试工具');
    console.log('='.repeat(50));

    const token = await getToken();

    if (!token) {
      log('yellow', '⚠️  未提供 token，将跳过认证');
    } else {
      log('green', `🔑 Token: ${token.substring(0, 20)}...`);
    }

    const socket = await testConnection(token);

    await testJoinChannel(socket);
    await testJoinDM(socket);

    await testSendMessage(token);

    console.log('\n' + '='.repeat(50));
    console.log('✅ 调试完成');
    console.log('='.repeat(50));

    rl.question('\n是否进入交互模式? (y/N): ', (answer) => {
      if (answer.toLowerCase() === 'y') {
        interactiveMode(socket);
      } else {
        console.log('\n👋 正在关闭连接...');
        socket.close();
        rl.close();
        process.exit(0);
      }
    });

  } catch (error) {
    log('red', `\n💥 调试过程中出错: ${error.message}`);
    console.error(error);
    rl.close();
    process.exit(1);
  }
}

// 优雅退出
process.on('SIGINT', () => {
  console.log('\n\n👋 正在退出...');
  process.exit(0);
});

// 运行主函数
main();
