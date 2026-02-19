#!/bin/bash

# =====================================================
# 停止实例（保留 volume）
# 使用方法: ./stop-instance.sh <instance-name>
# =====================================================

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
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

# 切换到实例目录
cd "$INSTANCE_DIR"

echo -e "${BLUE}停止实例: $INSTANCE_NAME${NC}"
docker-compose -p "$INSTANCE_NAME" down

echo -e "${GREEN}实例 '$INSTANCE_NAME' 已停止（数据已保留）${NC}"
