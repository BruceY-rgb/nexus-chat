
#!/bin/bash
# =====================================================
# MCP 调用封装库
# 提供便捷的 MCP 工具调用功能
# =====================================================

# MCP 服务器地址
MCP_URL="${MCP_URL:-http://localhost:3002/mcp/messages}"

# 全局变量 (只在未定义时初始化)
: ${TOKEN:=}
: ${USER_ID:=}

# ---------------------------------------------------
# 辅助函数: 解析 JSON 响应
# ---------------------------------------------------

# 从登录响应中提取 token
extract_token() {
  local response="$1"
  echo "$response" | python3 -c "
import sys, json
try:
  r = json.load(sys.stdin)
  t = json.loads(r['result']['content'][0]['text'])
  print(t.get('token', ''))
except:
  print('')
" 2>/dev/null
}

# 从响应中提取 userId
extract_user_id() {
  local response="$1"
  echo "$response" | python3 -c "
import sys, json
try:
  r = json.load(sys.stdin)
  t = json.loads(r['result']['content'][0]['text'])
  print(t.get('userId', ''))
except:
  print('')
" 2>/dev/null
}

# 从响应中提取指定字段
extract_field() {
  local response="$1"
  local field="$2"
  echo "$response" | python3 -c "
import sys, json
try:
  r = json.load(sys.stdin)
  t = json.loads(r['result']['content'][0]['text'])
  print(t.get('$field', ''))
except:
  print('')
" 2>/dev/null
}

# 从响应中提取数组 (如频道列表)
extract_array() {
  local response="$1"
  local field="$2"
  echo "$response" | python3 -c "
import sys, json
try:
  r = json.load(sys.stdin)
  t = json.loads(r['result']['content'][0]['text'])
  arr = t.get('$field', [])
  print(json.dumps(arr))
except:
  print('[]')
" 2>/dev/null
}

# 检查响应是否有错误
check_error() {
  local response="$1"
  local is_error=$(echo "$response" | python3 -c "
import sys, json
try:
  r = json.load(sys.stdin)
  print('ERROR' if r.get('result',{}).get('isError') or 'error' in r else 'OK')
except:
  print('ERROR')
" 2>/dev/null)
  [ "$is_error" = "ERROR" ]
}

# 获取响应文本内容
get_text() {
  local response="$1"
  echo "$response" | python3 -c "
import sys, json
try:
  r = json.load(sys.stdin)
  c = r.get('result',{}).get('content',[])
  if c:
    print(c[0]['text'])
  else:
    print(json.dumps(r.get('error',{})))
except:
  print('ERROR')
" 2>/dev/null
}

# ---------------------------------------------------
# 核心函数: 调用 MCP 工具
# ---------------------------------------------------

# 调用 MCP 工具 (无 token)
mcp_call_no_auth() {
  local tool="$1"
  local args="$2"

  local response
  response=$(curl -s "$MCP_URL" \
    -H "Content-Type: application/json" \
    -d "{
      \"jsonrpc\": \"2.0\",
      \"id\": $RANDOM,
      \"method\": \"tools/call\",
      \"params\": {
        \"name\": \"$tool\",
        \"arguments\": $args
      }
    }" 2>/dev/null)

  echo "$response"
}

# 调用 MCP 工具 (需要 token)
mcp_call() {
  local tool="$1"
  local args="$2"

  local response
  response=$(curl -s "$MCP_URL" \
    -H "Content-Type: application/json" \
    -d "{
      \"jsonrpc\": \"2.0\",
      \"id\": $RANDOM,
      \"method\": \"tools/call\",
      \"params\": {
        \"name\": \"$tool\",
        \"arguments\": $args
      }
    }" 2>/dev/null)

  echo "$response"
}

# ---------------------------------------------------
# 认证函数
# ---------------------------------------------------

# 登录并设置全局 TOKEN
mcp_login() {
  local email="$1"
  local password="$2"

  local response
  response=$(mcp_call_no_auth "login" "{\"email\":\"$email\",\"password\":\"$password\"}")

  if check_error "$response"; then
    return 1
  fi

  local token
  token=$(extract_token "$response")
  local user_id
  user_id=$(extract_user_id "$response")

  if [ -z "$token" ]; then
    return 1
  fi

  # 设置全局变量，供所有场景使用
  TOKEN="$token"
  USER_ID="$user_id"

  # 输出 token
  echo "$token"
  return 0
}

# 获取当前用户信息
mcp_get_me() {
  mcp_call "get_me" "{\"userToken\":\"$TOKEN\"}"
}

# 获取个人资料
mcp_get_profile() {
  mcp_call "get_profile" "{\"userToken\":\"$TOKEN\"}"
}

# 更新个人资料
mcp_update_profile() {
  local displayName="$1"
  mcp_call "update_profile" "{\"userToken\":\"$TOKEN\",\"displayName\":\"$displayName\"}"
}

# ---------------------------------------------------
# 频道函数
# ---------------------------------------------------

# 列出所有频道
mcp_list_channels() {
  mcp_call "list_channels" "{\"userToken\":\"$TOKEN\"}"
}

# 获取频道详情
mcp_get_channel() {
  local channelId="$1"
  mcp_call "get_channel" "{\"userToken\":\"$TOKEN\",\"channelId\":\"$channelId\"}"
}

# 创建频道
mcp_create_channel() {
  local name="$1"
  local description="${2:-}"
  mcp_call "create_channel" "{\"userToken\":\"$TOKEN\",\"name\":\"$name\",\"description\":\"$description\"}"
}

# 更新频道
mcp_update_channel() {
  local channelId="$1"
  local name="$2"
  mcp_call "update_channel" "{\"userToken\":\"$TOKEN\",\"channelId\":\"$channelId\",\"name\":\"$name\"}"
}

# 删除频道
mcp_delete_channel() {
  local channelId="$1"
  mcp_call "delete_channel" "{\"userToken\":\"$TOKEN\",\"channelId\":\"$channelId\"}"
}

# 加入频道
mcp_join_channel() {
  local channelId="$1"
  mcp_call "join_channel" "{\"userToken\":\"$TOKEN\",\"channelId\":\"$channelId\"}"
}

# 离开频道
mcp_leave_channel() {
  local channelId="$1"
  mcp_call "leave_channel" "{\"userToken\":\"$TOKEN\",\"channelId\":\"$channelId\"}"
}

# 列出频道成员
mcp_list_channel_members() {
  local channelId="$1"
  mcp_call "list_channel_members" "{\"userToken\":\"$TOKEN\",\"channelId\":\"$channelId\"}"
}

# ---------------------------------------------------
# 私聊函数
# ---------------------------------------------------

# 创建私聊
mcp_create_dm() {
  local userId="$1"
  mcp_call "create_dm" "{\"userToken\":\"$TOKEN\",\"userId\":\"$userId\"}"
}

# 获取私聊
mcp_get_dm() {
  local dmId="$1"
  mcp_call "get_dm" "{\"userToken\":\"$TOKEN\",\"dmId\":\"$dmId\"}"
}

# 列出活跃私聊
mcp_list_active_dms() {
  mcp_call "list_active_dms" "{\"userToken\":\"$TOKEN\"}"
}

# ---------------------------------------------------
# 消息函数
# ---------------------------------------------------

# 列出消息
mcp_list_messages() {
  local channelId="$1"
  local limit="${2:-20}"
  mcp_call "list_messages" "{\"userToken\":\"$TOKEN\",\"channelId\":\"$channelId\",\"limit\":$limit}"
}

# 发送消息
mcp_send_message() {
  local channelId="$1"
  local content="$2"
  mcp_call "send_message" "{\"userToken\":\"$TOKEN\",\"channelId\":\"$channelId\",\"content\":\"$content\"}"
}

# 发送私聊消息
mcp_send_dm_message() {
  local dmId="$1"
  local content="$2"
  mcp_call "send_message" "{\"userToken\":\"$TOKEN\",\"dmId\":\"$dmId\",\"content\":\"$content\"}"
}

# 获取消息
mcp_get_message() {
  local messageId="$1"
  mcp_call "get_message" "{\"userToken\":\"$TOKEN\",\"messageId\":\"$messageId\"}"
}

# 更新消息
mcp_update_message() {
  local messageId="$1"
  local content="$2"
  mcp_call "update_message" "{\"userToken\":\"$TOKEN\",\"messageId\":\"$messageId\",\"content\":\"$content\"}"
}

# 删除消息
mcp_delete_message() {
  local messageId="$1"
  mcp_call "delete_message" "{\"userToken\":\"$TOKEN\",\"messageId\":\"$messageId\"}"
}

# 回复消息 (Thread)
mcp_reply_to_message() {
  local messageId="$1"
  local content="$2"
  mcp_call "reply_to_message" "{\"userToken\":\"$TOKEN\",\"parentMessageId\":\"$messageId\",\"content\":\"$content\"}"
}

# 获取线程回复
mcp_get_thread_replies() {
  local messageId="$1"
  mcp_call "get_thread_replies" "{\"userToken\":\"$TOKEN\",\"parentMessageId\":\"$messageId\"}"
}

# 搜索消息
mcp_search_messages() {
  local query="$1"
  mcp_call "search_messages" "{\"userToken\":\"$TOKEN\",\"query\":\"$query\"}"
}

# 添加反应
mcp_add_reaction() {
  local messageId="$1"
  local emoji="$2"
  mcp_call "add_reaction" "{\"userToken\":\"$TOKEN\",\"messageId\":\"$messageId\",\"emoji\":\"$emoji\"}"
}

# 移除反应
mcp_remove_reaction() {
  local messageId="$1"
  local emoji="$2"
  mcp_call "remove_reaction" "{\"userToken\":\"$TOKEN\",\"messageId\":\"$messageId\",\"emoji\":\"$emoji\"}"
}

# 获取反应
mcp_get_reactions() {
  local messageId="$1"
  mcp_call "get_reactions" "{\"userToken\":\"$TOKEN\",\"messageId\":\"$messageId\"}"
}

# 标记消息已读
mcp_mark_messages_read() {
  local channelId="$1"
  mcp_call "mark_messages_read" "{\"userToken\":\"$TOKEN\",\"channelId\":\"$channelId\"}"
}

# 标记所有消息已读
mcp_mark_all_messages_read() {
  mcp_call "mark_all_messages_read" "{\"userToken\":\"$TOKEN\"}"
}

# ---------------------------------------------------
# 用户函数
# ---------------------------------------------------

# 列出用户
mcp_list_users() {
  mcp_call "list_users" "{\"userToken\":\"$TOKEN\"}"
}

# 搜索用户
mcp_search_users() {
  local query="$1"
  mcp_call "search_users" "{\"userToken\":\"$TOKEN\",\"query\":\"$query\"}"
}

# 获取用户
mcp_get_user() {
  local userId="$1"
  mcp_call "get_user" "{\"userToken\":\"$TOKEN\",\"userId\":\"$userId\"}"
}

# 获取未读计数
mcp_get_unread_counts() {
  mcp_call "get_unread_counts" "{\"userToken\":\"$TOKEN\"}"
}

# ---------------------------------------------------
# 健康检查
# ---------------------------------------------------

# 健康检查
mcp_health_check() {
  mcp_call_no_auth "health_check" "{}"
}
