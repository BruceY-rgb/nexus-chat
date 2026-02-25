#!/bin/bash
# =====================================================
# 场景 5: 消息互动 (Thread/Reaction)
# =====================================================

# 引入依赖
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../lib/colors.sh"
source "$SCRIPT_DIR/../lib/mcp.sh"

run_interactions_scenario() {
  print_section "场景 5: 消息互动"

  # 获取之前场景保存的消息 ID
  local message_id
  if [ -f /tmp/demo_message_id ]; then
    message_id=$(cat /tmp/demo_message_id)
  fi

  if [ -z "$message_id" ]; then
    print_warning "未找到消息 ID，尝试创建一个新消息..."

    # 获取一个频道
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
      print_error "无法获取频道 ID"
      return 1
    fi

    # 发送一条新消息用于互动
    local new_msg_resp
    new_msg_resp=$(mcp_send_message "$channel_id" "这是用于互动测试的消息")
    message_id=$(extract_field "$new_msg_resp" "id")

    if [ -z "$message_id" ]; then
      print_error "无法发送测试消息"
      return 1
    fi
  fi

  print_info "使用消息 ID: $message_id"

  # 1. 添加表情反应
  print_step "1. 添加表情反应 (👍)..."
  local reaction_resp
  reaction_resp=$(mcp_add_reaction "$message_id" "thumbsup")

  if check_error "$reaction_resp"; then
    print_warning "添加反应失败"
  else
    print_success "已添加 👍 表情"
  fi

  # 2. 获取消息反应
  print_step "2. 获取消息反应列表..."
  local reactions_resp
  reactions_resp=$(mcp_get_reactions "$message_id")

  local reactions_json
  reactions_json=$(extract_array "$reactions_resp" "reactions")

  local reaction_count
  reaction_count=$(echo "$reactions_json" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))" 2>/dev/null || echo "0")

  print_success "消息共有 $reaction_count 个表情反应"

  # 3. 回复消息 (Thread)
  print_step "3. 回复消息创建 Thread..."
  local reply_content="这是对原消息的回复! 时间: $(date +'%H:%M:%S')"
  local reply_resp
  reply_resp=$(mcp_reply_to_message "$message_id" "$reply_content")

  local reply_id
  reply_id=$(extract_field "$reply_resp" "id")

  if [ -n "$reply_id" ]; then
    print_success "Thread 回复成功! ID: $reply_id"
  else
    print_warning "Thread 回复可能失败"
  fi

  # 4. 获取 Thread 回复
  if [ -n "$reply_id" ]; then
    print_step "4. 获取 Thread 回复..."
    local thread_resp
    thread_resp=$(mcp_get_thread_replies "$message_id")

    local replies_json
    replies_json=$(extract_array "$thread_resp" "replies")
    local reply_count
    reply_count=$(echo "$replies_json" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))" 2>/dev/null || echo "0")

    print_success "Thread 共有 $reply_count 条回复"
  fi

  # 5. 编辑消息
  print_step "5. 编辑消息内容..."
  local edit_content="[已编辑] 这是一条被编辑过的消息 - $(date +'%H:%M:%S')"
  local edit_resp
  edit_resp=$(mcp_update_message "$message_id" "$edit_content")

  local updated_content
  updated_content=$(extract_field "$edit_resp" "content")

  if [[ "$updated_content" == *"已编辑"* ]]; then
    print_success "消息编辑成功: ${updated_content:0:50}..."
  else
    print_warning "消息编辑结果: $updated_content"
  fi

  # 6. 删除反应 (可选)
  print_step "6. 移除表情反应..."
  local remove_reaction_resp
  remove_reaction_resp=$(mcp_remove_reaction "$message_id" "thumbsup")

  if check_error "$remove_reaction_resp"; then
    print_warning "移除反应可能失败"
  else
    print_success "已移除 👍 表情"
  fi

  print_success "场景 5 完成!"
  return 0
}

# 如果直接运行此脚本
if [ "${BASH_SOURCE[0]}" = "$0" ]; then
  run_interactions_scenario
fi
