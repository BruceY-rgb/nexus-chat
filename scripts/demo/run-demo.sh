#!/bin/bash
# =====================================================
# Slack 自动化演示主入口
# =====================================================

# 确保在正确的目录运行
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# 引入依赖
source "$SCRIPT_DIR/lib/colors.sh"
source "$SCRIPT_DIR/lib/mcp.sh"

# 配置
DEMO_EMAIL="${DEMO_EMAIL:-slackbot@slack-import.local}"
DEMO_PASSWORD="${DEMO_PASSWORD:-password123}"

# ---------------------------------------------------
# 帮助信息
# ---------------------------------------------------

show_help() {
  cat << EOF
Slack 自动化演示脚本

用法: $0 [选项]

选项:
  -h, --help           显示帮助信息
  -e, --email EMAIL    指定登录邮箱 (默认: $DEMO_EMAIL)
  -p, --password PASS  指定登录密码 (默认: $DEMO_PASSWORD)
  --skip-auth          跳过认证场景
  --skip-channels     跳过频道场景
  --skip-messages     跳过消息场景
  --skip-dm           跳过私聊场景
  --skip-interactions 跳过互动场景
  --single SCENARIO    运行单个场景 (auth|channels|messages|dm|interactions)
  --list               列出所有可用场景

示例:
  $0                           # 运行完整演示
  $0 --single messages        # 仅运行消息场景
  $0 -e alice@chat.com       # 使用指定账号

EOF
}

# ---------------------------------------------------
# 场景函数
# ---------------------------------------------------

run_scenario() {
  local scenario=$1
  local script="$SCRIPT_DIR/scenarios/${scenario}.sh"

  if [ ! -f "$script" ]; then
    print_error "场景脚本不存在: $script"
    return 1
  fi

  # 保存主脚本的 SCRIPT_DIR
  local main_script_dir="$SCRIPT_DIR"

  source "$script"

  # 恢复主脚本的 SCRIPT_DIR
  SCRIPT_DIR="$main_script_dir"

  case $scenario in
    01-auth)
      run_auth_scenario
      ;;
    02-channels)
      run_channels_scenario
      ;;
    03-messages)
      run_messages_scenario
      ;;
    04-dm)
      run_dm_scenario
      ;;
    05-interactions)
      run_interactions_scenario
      ;;
    *)
      print_error "未知场景: $scenario"
      return 1
      ;;
  esac
}

# ---------------------------------------------------
# 主函数
# ---------------------------------------------------

main() {
  local skip_auth=false
  local skip_channels=false
  local skip_messages=false
  local skip_dm=false
  local skip_interactions=false
  local single_scenario=""

  # 解析参数
  while [[ $# -gt 0 ]]; do
    case $1 in
      -h|--help)
        show_help
        exit 0
        ;;
      -e|--email)
        DEMO_EMAIL="$2"
        shift 2
        ;;
      -p|--password)
        DEMO_PASSWORD="$2"
        shift 2
        ;;
      --skip-auth)
        skip_auth=true
        shift
        ;;
      --skip-channels)
        skip_channels=true
        shift
        ;;
      --skip-messages)
        skip_messages=true
        shift
        ;;
      --skip-dm)
        skip_dm=true
        shift
        ;;
      --skip-interactions)
        skip_interactions=true
        shift
        ;;
      --single)
        single_scenario="$2"
        shift 2
        ;;
      --list)
        echo "可用场景:"
        ls -1 "$SCRIPT_DIR/scenarios/"
        exit 0
        ;;
      *)
        print_error "未知选项: $1"
        show_help
        exit 1
        ;;
    esac
  done

  # 打印标题
  print_title "=============================================="
  print_title " Slack 功能自动化演示"
  print_title " $(date '+%Y-%m-%d %H:%M:%S')"
  print_title "=============================================="
  echo ""
  print_info "演示账号: $DEMO_EMAIL"
  print_info "MCP 地址: $MCP_URL"
  echo ""

  # 检查 MCP 服务是否可用
  print_step "检查 MCP 服务状态..."
  local health_resp
  health_resp=$(mcp_health_check)

  if check_error "$health_resp"; then
    print_error "MCP 服务不可用!"
    print_info "请确保 MCP 服务器正在运行 (localhost:3002)"
    exit 1
  fi
  print_success "MCP 服务正常"
  echo ""

  # 运行单个场景
  if [ -n "$single_scenario" ]; then
    case $single_scenario in
      auth)
        run_scenario "01-auth"
        exit $?
        ;;
      channels)
        run_scenario "02-channels"
        exit $?
        ;;
      messages)
        run_scenario "03-messages"
        exit $?
        ;;
      dm)
        run_scenario "04-dm"
        exit $?
        ;;
      interactions)
        run_scenario "05-interactions"
        exit $?
        ;;
      *)
        print_error "未知场景: $single_scenario"
        exit 1
        ;;
    esac
  fi

  # 运行完整演示流程
  local total=5
  local current=0

  # 场景 1: 认证
  current=$((current + 1))
  if [ "$skip_auth" = "true" ]; then
    print_warning "[$current/$total] 跳过认证场景"
  else
    run_scenario "01-auth"
    if [ $? -ne 0 ]; then
      print_error "认证场景失败，演示终止"
      exit 1
    fi
  fi
  echo ""

  # 场景 2: 频道
  current=$((current + 1))
  if [ "$skip_channels" = "true" ]; then
    print_warning "[$current/$total] 跳过频道场景"
  else
    run_scenario "02-channels"
    # 频道场景失败不终止演示
  fi
  echo ""

  # 场景 3: 消息
  current=$((current + 1))
  if [ "$skip_messages" = "true" ]; then
    print_warning "[$current/$total] 跳过消息场景"
  else
    run_scenario "03-messages"
  fi
  echo ""

  # 场景 4: 私聊
  current=$((current + 1))
  if [ "$skip_dm" = "true" ]; then
    print_warning "[$current/$total] 跳过私聊场景"
  else
    run_scenario "04-dm"
  fi
  echo ""

  # 场景 5: 互动
  current=$((current + 1))
  if [ "$skip_interactions" = "true" ]; then
    print_warning "[$current/$total] 跳过互动场景"
  else
    run_scenario "05-interactions"
  fi
  echo ""

  # 完成
  print_title "=============================================="
  print_success "演示完成!"
  print_title "=============================================="
  echo ""
  print_info "提示: 可使用 --single <场景> 运行单个场景"
  print_info "      可使用 --list 查看所有可用场景"
}

# 运行主函数
main "$@"
