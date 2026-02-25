#!/bin/bash
# =====================================================
# 场景 1: 用户登录与个人资料
# =====================================================

# 引入依赖
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../lib/colors.sh"
source "$SCRIPT_DIR/../lib/mcp.sh"

# 测试账号 (从 Slack 导入的数据)
DEMO_EMAIL="${DEMO_EMAIL:-slackbot@slack-import.local}"
DEMO_PASSWORD="${DEMO_PASSWORD:-password123}"

run_auth_scenario() {
  print_section "场景 1: 用户登录与个人资料"

  # 1. 登录
  print_step "1. 登录系统..."
  TOKEN=$(mcp_login "$DEMO_EMAIL" "$DEMO_PASSWORD")
  local login_result=$?

  if [ $login_result -ne 0 ] || [ -z "$TOKEN" ]; then
    print_error "登录失败!"
    return 1
  fi

  print_success "登录成功! (Token: ${TOKEN:0:30}...)"
  print_info "用户 ID: $USER_ID"

  # 2. 获取当前用户信息
  print_step "2. 获取当前用户信息..."
  local me_resp
  me_resp=$(mcp_get_me)

  local displayName
  displayName=$(extract_field "$me_resp" "displayName")
  local email
  email=$(extract_field "$me_resp" "email")

  print_success "当前用户: $displayName <$email>"

  # 3. 获取个人资料
  print_step "3. 获取个人资料..."
  local profile_resp
  profile_resp=$(mcp_get_profile)

  local realName
  realName=$(extract_field "$profile_resp" "realName")
  local avatarUrl
  avatarUrl=$(extract_field "$profile_resp" "avatarUrl")

  print_success "真实姓名: $realName"
  print_info "头像: ${avatarUrl:0:60}..."

  # 4. 更新资料 (可选)
  print_step "4. 更新显示名称为 '演示用户'..."
  local update_resp
  update_resp=$(mcp_update_profile "演示用户")

  local newDisplayName
  newDisplayName=$(extract_field "$update_resp" "displayName")

  if [ "$newDisplayName" = "演示用户" ]; then
    print_success "显示名称已更新为: $newDisplayName"
  else
    print_warning "更新响应: $newDisplayName"
  fi

  print_success "场景 1 完成!"
  return 0
}

# 如果直接运行此脚本
if [ "${BASH_SOURCE[0]}" = "$0" ]; then
  run_auth_scenario
fi
