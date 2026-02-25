#!/bin/bash
# =====================================================
# 场景 4: 私聊 DM
# =====================================================

# 引入依赖
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../lib/colors.sh"
source "$SCRIPT_DIR/../lib/mcp.sh"

run_dm_scenario() {
  print_section "场景 4: 私聊 DM"

  # 1. 列出所有用户
  print_step "1. 获取用户列表..."
  local users_resp
  users_resp=$(mcp_list_users)

  local users_json
  users_json=$(extract_array "$users_resp" "users")

  # 排除当前用户
  local other_users_json
  other_users_json=$(echo "$users_json" | python3 -c "
import sys, json
try:
  users = json.load(sys.stdin) if isinstance(json.load(sys.stdin), list) else []
  other = [u for u in users if u.get('id', '') != '$USER_ID']
  print(json.dumps(other[:5]))
except:
  print('[]')
" 2>/dev/null)

  local user_count
  user_count=$(echo "$other_users_json" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))" 2>/dev/null || echo "0")

  print_success "找到 $user_count 个其他用户"

  # 获取第一个其他用户的 ID
  local target_user_id
  target_user_id=$(echo "$other_users_json" | python3 -c "
import sys, json
try:
  users = json.load(sys.stdin) if isinstance(json.load(sys.stdin), list) else []
  if users:
    print(users[0].get('id', ''))
except:
  print('')
" 2>/dev/null)

  local target_user_name
  target_user_name=$(echo "$other_users_json" | python3 -c "
import sys, json
try:
  users = json.load(sys.stdin) if isinstance(json.load(sys.stdin), list) else []
  if users:
    print(users[0].get('displayName', users[0].get('email', 'Unknown')))
except:
  print('Unknown')
" 2>/dev/null)

  if [ -z "$target_user_id" ]; then
    print_error "未找到其他用户，无法创建私聊"
    return 1
  fi

  print_info "目标用户: $target_user_name (ID: $target_user_id)"

  # 2. 创建私聊
  print_step "2. 创建私聊会话..."
  local create_dm_resp
  create_dm_resp=$(mcp_create_dm "$target_user_id")

  local dm_id
  dm_id=$(extract_field "$create_dm_resp" "id")

  if [ -z "$dm_id" ]; then
    # 可能已经存在，尝试列出
    print_warning "创建私聊失败，尝试查找已有私聊..."
    local dms_resp
    dms_resp=$(mcp_list_active_dms)

    local dms_json
    dms_json=$(extract_array "$dms_resp" "dms")

    dm_id=$(echo "$dms_json" | python3 -c "
import sys, json
try:
  dms = json.load(sys.stdin) if isinstance(json.load(sys.stdin), list) else []
  for dm in dms:
    members = dm.get('members', [])
    for m in members:
      if m.get('user', {}).get('id', '') == '$target_user_id':
        print(dm.get('id', ''))
        break
except:
  print('')
" 2>/dev/null)
  fi

  if [ -z "$dm_id" ]; then
    print_error "无法创建或找到私聊会话"
    return 1
  fi

  print_success "私聊创建成功! DM ID: $dm_id"

  # 3. 获取私聊详情
  print_step "3. 获取私聊详情..."
  local dm_detail_resp
  dm_detail_resp=$(mcp_get_dm "$dm_id")

  local dm_members_json
  dm_members_json=$(extract_array "$dm_detail_resp" "members")
  local member_count
  member_count=$(echo "$dm_members_json" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))" 2>/dev/null || echo "0")

  print_success "私聊成员数: $member_count"

  # 4. 发送私聊消息
  print_step "4. 发送私聊消息..."
  local dm_message="👋 你好! 这是一条来自自动化演示的私聊消息! 时间: $(date +'%H:%M:%S')"
  local send_dm_resp
  send_dm_resp=$(mcp_send_dm_message "$dm_id" "$dm_message")

  local dm_msg_id
  dm_msg_id=$(extract_field "$send_dm_resp" "id")

  if [ -n "$dm_msg_id" ]; then
    print_success "私聊消息发送成功! ID: $dm_msg_id"
  else
    print_error "私聊消息发送失败"
    return 1
  fi

  # 5. 列出活跃私聊
  print_step "5. 获取活跃私聊列表..."
  local active_dms_resp
  active_dms_resp=$(mcp_list_active_dms)

  local active_dms_json
  active_dms_json=$(extract_array "$active_dms_resp" "dms")
  local active_dm_count
  active_dm_count=$(echo "$active_dms_json" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))" 2>/dev/null || echo "0")

  print_success "当前活跃私聊数: $active_dm_count"

  # 保存 DM ID 供后续场景使用
  echo "$dm_id" > /tmp/demo_dm_id

  print_success "场景 4 完成!"
  return 0
}

# 如果直接运行此脚本
if [ "${BASH_SOURCE[0]}" = "$0" ]; then
  run_dm_scenario
fi
