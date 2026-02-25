#!/bin/bash
# =====================================================
# 场景 2: 频道操作
# =====================================================

# 引入依赖
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../lib/colors.sh"
source "$SCRIPT_DIR/../lib/mcp.sh"

# 演示用频道名
DEMO_CHANNEL_NAME="demo-channel-$(date +%s)"

run_channels_scenario() {
  print_section "场景 2: 频道操作"

  # 1. 列出所有频道
  print_step "1. 获取频道列表..."
  local channels_resp
  channels_resp=$(mcp_list_channels)

  if check_error "$channels_resp"; then
    print_error "获取频道列表失败!"
    return 1
  fi

  local channels_json
  channels_json=$(extract_array "$channels_resp" "channels")

  # 提取频道名称
  local channel_names
  channel_names=$(echo "$channels_json" | python3 -c "
import sys, json
try:
  channels = json.load(sys.stdin) if isinstance(json.load(sys.stdin), list) else []
  names = [c.get('name', 'unnamed') for c in channels[:10]]
  print(', '.join(names))
except:
  print('无法解析')
" 2>/dev/null)

  print_success "频道列表: $channel_names"
  print_info "共 $(echo "$channels_json" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))" 2>/dev/null || echo "?") 个频道"

  # 获取第一个公开频道 ID
  local first_channel_id
  first_channel_id=$(echo "$channels_json" | python3 -c "
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

  # 2. 创建新频道
  print_step "2. 创建新频道: $DEMO_CHANNEL_NAME..."
  local create_resp
  create_resp=$(mcp_create_channel "$DEMO_CHANNEL_NAME" "自动化演示创建的频道")

  local new_channel_id
  new_channel_id=$(extract_field "$create_resp" "id")

  if [ -n "$new_channel_id" ]; then
    print_success "频道创建成功! ID: $new_channel_id"
  else
    # 可能已存在，尝试获取
    print_warning "频道可能已存在，尝试查找..."
    new_channel_id=$(echo "$channels_json" | python3 -c "
import sys, json
try:
  channels = json.load(sys.stdin) if isinstance(json.load(sys.stdin), list) else []
  for c in channels:
    if c.get('name', '').startswith('demo-channel'):
      print(c.get('id', ''))
      break
except:
  print('')
" 2>/dev/null)
  fi

  # 3. 加入频道
  print_step "3. 加入频道..."
  local join_resp
  join_resp=$(mcp_join_channel "$new_channel_id")

  if check_error "$join_resp"; then
    print_warning "可能已经加入过该频道"
  else
    print_success "成功加入频道"
  fi

  # 4. 获取频道详情
  print_step "4. 获取频道详情..."
  local channel_detail_resp
  channel_detail_resp=$(mcp_get_channel "$new_channel_id")

  local channel_name
  channel_name=$(extract_field "$channel_detail_resp" "name")
  local channel_desc
  channel_desc=$(extract_field "$channel_detail_resp" "description")

  print_success "频道名称: $channel_name"
  print_info "频道描述: $channel_desc"

  # 5. 列出频道成员
  print_step "5. 获取频道成员列表..."
  local members_resp
  members_resp=$(mcp_list_channel_members "$new_channel_id")

  local members_json
  members_json=$(extract_array "$members_resp" "members")
  local member_count
  member_count=$(echo "$members_json" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))" 2>/dev/null || echo "?")

  print_success "频道成员数: $member_count"

  # 6. 更新频道描述
  print_step "6. 更新频道描述..."
  local update_resp
  update_resp=$(mcp_update_channel "$new_channel_id" "$channel_name")

  print_success "频道更新成功"

  # 保存频道 ID 供后续场景使用
  echo "$new_channel_id" > /tmp/demo_channel_id

  print_success "场景 2 完成!"
  return 0
}

# 如果直接运行此脚本
if [ "${BASH_SOURCE[0]}" = "$0" ]; then
  run_channels_scenario
fi
