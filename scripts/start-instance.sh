#!/bin/bash

# =====================================================
# 启动实例（删除旧 volume，重新创建数据库）
# 使用方法: ./start-instance.sh <instance-name>
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
    echo "请先创建实例: ./create-instance.sh $INSTANCE_NAME"
    exit 1
fi

# 检查 .env 文件是否存在
if [ ! -f "$INSTANCE_DIR/.env" ]; then
    echo -e "${RED}错误: 配置文件不存在: $INSTANCE_DIR/.env${NC}"
    exit 1
fi

# 加载环境变量
echo -e "${BLUE}加载配置...${NC}"
set -a
source "$INSTANCE_DIR/.env"
set +a

# 设置默认值
INSTANCE_NAME=${INSTANCE_NAME:-$1}
APP_PORT=${APP_PORT:-3000}
WEBSOCKET_PORT=${WEBSOCKET_PORT:-3001}
DB_PORT=${DB_PORT:-5432}
MCP_PORT=${MCP_PORT:-3002}
DB_NAME=${DB_NAME:-slack_chat}

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}启动实例: $INSTANCE_NAME${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "配置信息:"
echo "  - 应用端口: $APP_PORT"
echo "  - WebSocket 端口: $WEBSOCKET_PORT"
echo "  - 数据库端口: $DB_PORT"
echo "  - MCP 端口: $MCP_PORT"
echo "  - 数据库名: $DB_NAME"
echo ""

# 切换到实例目录
cd "$INSTANCE_DIR"

# 检查端口是否被占用
echo -e "${BLUE}检查端口占用情况...${NC}"
for port in $APP_PORT $WEBSOCKET_PORT $DB_PORT $MCP_PORT; do
    if lsof -i:$port >/dev/null 2>&1; then
        echo -e "${YELLOW}警告: 端口 $port 已被占用${NC}"
    fi
done

# 删除旧容器和 volume（如果存在）
echo -e "${BLUE}清理旧实例（删除 volume）...${NC}"
docker-compose -p "$INSTANCE_NAME" down -v 2>/dev/null || true

# 启动服务
echo -e "${BLUE}启动 Docker 服务...${NC}"
docker-compose -p "$INSTANCE_NAME" up -d --build

# 等待数据库就绪
echo -e "${BLUE}等待数据库就绪...${NC}"
max_attempts=30
attempt=0
while [ $attempt -lt $max_attempts ]; do
    if docker-compose -p "$INSTANCE_NAME" exec -T db pg_isready -U ${DB_USER:-yangsmac} >/dev/null 2>&1; then
        echo -e "${GREEN}数据库已就绪!${NC}"
        break
    fi
    attempt=$((attempt + 1))
    echo "等待中... ($attempt/$max_attempts)"
    sleep 2
done

if [ $attempt -eq $max_attempts ]; then
    echo -e "${RED}错误: 数据库启动超时${NC}"
    exit 1
fi

# 等待应用就绪
echo -e "${BLUE}等待应用就绪...${NC}"
sleep 5

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}实例 '$INSTANCE_NAME' 启动成功!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "访问地址:"
echo "  - 应用: http://localhost:$APP_PORT"
echo "  - WebSocket: ws://localhost:$WEBSOCKET_PORT"
echo "  - MCP: http://localhost:$MCP_PORT"
echo ""
echo -e "${YELLOW}数据库已重置为初始状态（全新）${NC}"
echo ""
