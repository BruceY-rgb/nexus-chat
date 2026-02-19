#!/bin/bash

# =====================================================
# 创建新实例
# 使用方法: ./create-instance.sh <instance-name>
# =====================================================

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
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
TEMPLATE_DIR="$INSTANCES_DIR/template"
INSTANCE_DIR="$INSTANCES_DIR/$INSTANCE_NAME"

# 检查模板目录是否存在
if [ ! -d "$TEMPLATE_DIR" ]; then
    echo -e "${RED}错误: 模板目录不存在: $TEMPLATE_DIR${NC}"
    exit 1
fi

# 检查实例是否已存在
if [ -d "$INSTANCE_DIR" ]; then
    echo -e "${RED}错误: 实例 '$INSTANCE_NAME' 已存在${NC}"
    exit 1
fi

# 创建实例目录
echo -e "${GREEN}创建实例目录: $INSTANCE_DIR${NC}"
mkdir -p "$INSTANCE_DIR"

# 复制 docker-compose.yml（使用符号链接指向模板）
echo -e "${GREEN}创建 docker-compose.yml${NC}"
ln -sf ../template/docker-compose.yml "$INSTANCE_DIR/docker-compose.yml"

# 复制 .env.example 为 .env
echo -e "${GREEN}创建 .env 配置文件${NC}"
cp "$TEMPLATE_DIR/.env.example" "$INSTANCE_DIR/.env"

# 设置环境变量使符号链接正确解析
cd "$INSTANCE_DIR"

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}实例 '$INSTANCE_NAME' 创建成功!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "配置步骤:"
echo "1. 进入实例目录: cd instances/$INSTANCE_NAME"
echo "2. 修改 .env 配置文件（特别是端口）"
echo "3. 启动实例: ../scripts/start-instance.sh $INSTANCE_NAME"
echo ""
echo -e "${YELLOW}注意: 请修改 .env 中的以下配置以避免端口冲突:${NC}"
echo "  - APP_PORT (默认 3000)"
echo "  - WEBSOCKET_PORT (默认 3001)"
echo "  - DB_PORT (默认 5432)"
echo "  - MCP_PORT (默认 3002)"
echo "  - DB_NAME (数据库名)"
echo "  - INSTANCE_NAME (实例名)"
echo ""
