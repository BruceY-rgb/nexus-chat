#!/bin/bash
# =====================================================
# 场景 3: 消息收发
# =====================================================

# 引入依赖
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../lib/colors.sh"
source "$SCRIPT_DIR/../lib/mcp.sh"

# 演示用消息内容
DEMO_MESSAGE="🤖 这是一条来自自动化演示的消息！时间: $(date +'%H:%M:%S')"

run_messages_scenario() {
  print_section "场景 3: 消息收发"

  # 1. 列出频道消息 (获取一个有效的频道 ID)
  print_step "1. 获取频道列表以查找可用频道..."
  local channels_resp
  channels_resp=$(mcp_list_channels)

  local channels_json
  channels_json=$(extract_array "$channels_resp" "channels")

  local channel_id
  channel_id=$(echo "$channels_json" | python3 -c "
import sys, json
try:
  channels = json.load(sys.stdin) if isinstance(json.load(sys.stdin), list) else []
  for c in channels:
    if not c.get('isPrivate', False):
      print(c.get('id', ''))
      break
except:
  print('')
" 2>/dev/null)

  if [ -z "$channel_id" ]; then
    print_error "未找到可用频道"
    return 1
  fi

  print_success "使用频道 ID: $channel_id"

  # 2. 列出频道历史消息
  print_step "2. 获取频道历史消息..."
  local messages_resp
  messages_resp=$(mcp_list_messages "$channel_id" 10)

  local messages_json
  messages_json=$(extract_array "$messages_resp" "messages")
  local message_count
  message_count=$(echo "$messages_json" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))" 2>/dev/null || echo "0")

  print_success "获取到 $message_count 条历史消息"

  # 提取最后一条消息 ID 用于后续操作
  local last_message_id
  last_message_id=$(echo "$messages_json" | python3 -c "
import sys, json
try:
  msgs = json.load(sys.stdin) if isinstance(json.load(sys.stdin), list) else []
  if msgs:
    print(msgs[0].get('id', ''))
except:
  print('')
" 2>/dev/null)

  # 3. 发送文本消息
  print_step "3. 发送文本消息..."
  local send_resp
  send_resp=$(mcp_send_message "$channel_id" "$DEMO_MESSAGE")

  local sent_message_id
  sent_message_id=$(extract_field "$send_resp" "id")

  if [ -n "$sent_message_id" ]; then
    print_success "消息发送成功! ID: $sent_message_id"
  else
    print_error "消息发送失败"
    print_debug "响应: $send_resp"
    return 1
  fi

  # 4. 搜索消息
  print_step "4. 搜索消息关键词..."
  local search_resp
  search_resp=$(mcp_search_messages "demo")

  local search_results_json
  search_results_json=$(extract_array "$search_resp" "results")
  local search_count
  search_count=$(echo "$search_results_json" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))" 2>/dev/null || echo "0")

  print_success "找到 $search_count 条包含 'demo' 的消息"

  # 5. 获取刚发送的消息详情
  print_step "5. 获取刚发送的消息详情..."
  local get_msg_resp
  get_msg_resp=$(mcp_get_message "$sent_message_id")

  local msg_content
  msg_content=$(extract_field "$get_msg_resp" "content")
  local msg_created_at
  msg_created_at=$(extract_field "$get_msg_resp" "createdAt")

  print_success "消息内容: ${msg_content:0:50}..."
  print_info "创建时间: $msg_created_at"

  # 6. 演示 @提及 (如果能找到其他用户)
  print_step "6. 尝试发送 @提及消息..."

  # 先搜索一些用户
  local users_resp
  users_resp=$(mcp_list_users)
  local users_json
  users_json=$(extract_array "$users_resp" "users")

  # 获取第一个其他用户的 ID
  local mentioned_user_id
  mentioned_user_id=$(echo "$users_json" | python3 -c "
import sys, json
try:
  users = json.load(sys.stdin) if isinstance(json.load(sys.stdin), list) else []
  for u in users:
    if u.get('id', '') != '$USER_ID':
      print(u.get('id', ''))
      break
except:
  print('')
" 2>/dev/null)

  if [ -n "$mentioned_user_id" ]; then
    local mention_msg="@user 这是一条提及消息!"
    local mention_resp
    mention_resp=$(mcp_send_message "$channel_id" "$mention_msg")
    print_success "@提及消息发送成功"
  else
    print_warning "未找到其他用户，跳过 @提及演示"
  fi

  # 保存消息 ID 供后续场景使用
  echo "$sent_message_id" > /tmp/demo_message_id

  print_success "场景 3 完成!"
  return 0
}

# 如果直接运行此脚本
if [ "${BASH_SOURCE[0]}" = "$0" ]; then
  run_messages_scenario
fi
