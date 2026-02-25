# MCP 测试工具使用说明

## 概述

本项目提供了 MCP (Model Context Protocol) 测试工具，用于测试 MCP 服务器提供的各种工具功能。

## 访问地址

- **测试页面**: `http://localhost:3000/mcp-test`
- **API 端点**:
  - 获取工具列表: `GET /api/mcp/tools`
  - 执行工具: `POST /api/mcp/execute`

## 快速开始

### 1. 启动服务

```bash
npm run dev
```

服务启动后，访问 `http://localhost:3000/mcp-test`

### 2. 获取用户 Token

在使用大多数工具前，需要先登录获取 `userToken`。

#### 方式一：页面操作

1. 在测试页面点击「填充登录参数」按钮
2. 或手动输入邮箱和密码（JSON格式）：
   ```json
   {
     "email": "test@example.com",
     "password": "123456"
   }
   ```
3. 点击「执行工具」
4. 在返回结果中复制 `token` 值

#### 方式二：命令行

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"123456"}'
```

### 3. 使用 Token

将获取的 `token` 粘贴到「User Token」输入框，然后执行其他工具。

## 可用工具列表

| 工具名称 | 说明 | 认证要求 |
|---------|------|---------|
| `register` | 注册新用户 | 否 |
| `login` | 用户登录 | 否 |
| `list_channels` | 获取频道列表 | 是 |
| `get_channel` | 获取频道详情 | 是 |
| `create_channel` | 创建新频道 | 是 |
| `join_channel` | 加入频道 | 是 |
| `send_message` | 发送消息 | 是 |
| `list_messages` | 获取消息列表 | 是 |
| `list_users` | 获取用户列表 | 是 |
| `get_user` | 获取当前用户信息 | 是 |

## 工具参数说明

### register - 注册用户

```json
{
  "email": "user@example.com",
  "password": "123456",
  "name": "用户名"
}
```

### login - 用户登录

```json
{
  "email": "user@example.com",
  "password": "123456"
}
```

### list_channels - 获取频道列表

```json
{}
```

### create_channel - 创建频道

```json
{
  "name": "频道名称",
  "description": "频道描述（可选）",
  "isPrivate": false
}
```

### send_message - 发送消息

```json
{
  "channelId": "频道ID",
  "content": "消息内容"
}
```

### list_messages - 获取消息

```json
{
  "channelId": "频道ID",
  "limit": 20
}
```

## API 调用示例

### 获取工具列表

```bash
curl http://localhost:3000/api/mcp/tools
```

### 执行工具

```bash
curl -X POST http://localhost:3000/api/mcp/execute \
  -H "Content-Type: application/json" \
  -d '{
    "name": "login",
    "arguments": {
      "email": "test@example.com",
      "password": "123456"
    }
  }'
```

### 使用 Token 执行工具

```bash
curl -X POST http://localhost:3000/api/mcp/execute \
  -H "Content-Type: application/json" \
  -d '{
    "name": "list_channels",
    "arguments": {},
    "userToken": "your-token-here"
  }'
```

## 常见问题

### Q: 为什么执行工具返回 "userToken is required"？

A: 大多数工具需要认证，请在「User Token」输入框中填入登录后获取的 token。

### Q: 如何注册新用户？

A: 使用 `register` 工具，输入邮箱、密码和用户名即可注册。

### Q: Token 有效期是多久？

A: Token 的有效期请查看后端 auth 配置，默认情况下在登录后会返回一个长期有效的 token。

## 生产环境

将上述示例中的 `localhost:3000` 替换为实际域名，例如：

- `https://slack-chat.ontuotu.com/mcp-test`
- `https://slack-chat.ontuotu.com/api/mcp/tools`
