#!/bin/bash

# =====================================================
# 删除实例（包括 volume）
# 使用方法: ./destroy-instance.sh <instance-name>
# =====================================================

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 检查参数
if [ -z "$1" ]; then
    echo -e "${RED}错误: 请指定实例名称${NC}"
    echo "使用方法: $0 <instance-name>"
    echo "示例: $0 my-instance"
    exit 1
fi

INSTANCE_NAME=$1
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INSTANCES_DIR="$(dirname "$SCRIPT_DIR")/instances"
INSTANCE_DIR="$INSTANCES_DIR/$INSTANCE_NAME"

# 检查实例目录是否存在
if [ ! -d "$INSTANCE_DIR" ]; then
    echo -e "${RED}错误: 实例 '$INSTANCE_NAME' 不存在${NC}"
    exit 1
fi

# 确认删除
echo -e "${YELLOW}警告: 此操作将删除实例 '$INSTANCE_NAME' 及其所有数据!${NC}"
echo ""
read -p "确认删除? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo "取消删除"
    exit 0
fi

# 切换到实例目录
cd "$INSTANCE_DIR"

# 停止并删除 volume
echo -e "${BLUE}删除实例: $INSTANCE_NAME（包括数据库）${NC}"
docker-compose -p "$INSTANCE_NAME" down -v

# 删除实例目录
echo -e "${BLUE}删除实例目录: $INSTANCE_DIR${NC}"
cd "$INSTANCES_DIR"
rm -rf "$INSTANCE_DIR"

echo -e "${GREEN}实例 '$INSTANCE_NAME' 已完全删除${NC}"
