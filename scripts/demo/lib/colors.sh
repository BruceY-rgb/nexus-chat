#!/bin/bash
# =====================================================
# 彩色输出定义
# =====================================================

# 颜色代码
COLOR_RESET='\033[0m'
COLOR_BOLD='\033[1m'

# 前景色
COLOR_BLACK='\033[30m'
COLOR_RED='\033[31m'
COLOR_GREEN='\033[32m'
COLOR_YELLOW='\033[33m'
COLOR_BLUE='\033[34m'
COLOR_MAGENTA='\033[35m'
COLOR_CYAN='\033[36m'
COLOR_WHITE='\033[37m'

# 背景色
BG_BLACK='\033[40m'
BG_RED='\033[41m'
BG_GREEN='\033[42m'
BG_YELLOW='\033[43m'
BG_BLUE='\033[44m'
BG_MAGENTA='\033[45m'
BG_CYAN='\033[46m'
BG_WHITE='\033[47m'

# ---------------------------------------------------
# 便捷函数
# ---------------------------------------------------

# 标题
print_title() {
  echo -e "${COLOR_BOLD}${COLOR_CYAN}$1${COLOR_RESET}"
}

# 成功
print_success() {
  echo -e "${COLOR_GREEN}✓ $1${COLOR_RESET}"
}

# 错误
print_error() {
  echo -e "${COLOR_RED}✗ $1${COLOR_RESET}"
}

# 警告
print_warning() {
  echo -e "${COLOR_YELLOW}⚠ $1${COLOR_RESET}"
}

# 信息
print_info() {
  echo -e "${COLOR_BLUE}ℹ $1${COLOR_RESET}"
}

# 步骤
print_step() {
  echo -e "${COLOR_MAGENTA}▶ $1${COLOR_RESET}"
}

# 调试
print_debug() {
  [ "$DEBUG" = "1" ] && echo -e "${COLOR_GRAY}$1${COLOR_RESET}"
}

# 分隔线
print_separator() {
  echo -e "${COLOR_BLUE}──────────────────────────────────────────────────${COLOR_RESET}"
}

# 章节标题
print_section() {
  echo ""
  print_separator
  print_title "$1"
  print_separator
}

# ---------------------------------------------------
# 进度显示
# ---------------------------------------------------

# 进度条
print_progress() {
  local current=$1
  local total=$2
  local message="${3:-}"
  local percent=$((current * 100 / total))
  local filled=$((percent / 5))
  local empty=$((20 - filled))

  printf "\r${COLOR_GREEN}["
  printf "%${filled}s" | tr ' ' '='
  printf "%${empty}s" | tr ' ' '-'
  printf "] %3d%% %s${COLOR_RESET}" "$percent" "$message"
  echo ""
}
