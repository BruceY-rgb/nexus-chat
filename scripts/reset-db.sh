#!/bin/bash

# =====================================================
# 数据库重置脚本
# 通过 docker-compose 重新运行 db-init 服务来重置数据库
# 用法: bash scripts/reset-db.sh <instance-name>
# 示例: bash scripts/reset-db.sh instance-1
# =====================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

INSTANCE_NAME="$1"
if [ -z "$INSTANCE_NAME" ]; then
    echo "❌ 请指定实例名称"
    echo "用法: bash scripts/reset-db.sh <instance-name>"
    echo "示例: bash scripts/reset-db.sh instance-1"
    exit 1
fi

INSTANCE_DIR="$PROJECT_DIR/instances/$INSTANCE_NAME"
ENV_FILE="$INSTANCE_DIR/.env"
COMPOSE_FILE="$INSTANCE_DIR/docker-compose.yml"

if [ ! -f "$ENV_FILE" ]; then
    echo "❌ 未找到实例配置文件: $ENV_FILE"
    exit 1
fi
if [ ! -f "$COMPOSE_FILE" ]; then
    echo "❌ 未找到实例 docker-compose 文件: $COMPOSE_FILE"
    exit 1
fi

echo "🗑️  开始重置数据库 [$INSTANCE_NAME]..."

# 停止并删除旧的 db-init 容器，忽略不存在的情况
echo "🔄 停止旧的 db-init 容器..."
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" rm -fsv db-init 2>/dev/null || true

# 重新运行 db-init 服务
echo "🚀 运行 db-init..."
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" run --rm db-init

echo ""
echo "✨ 实例 [$INSTANCE_NAME] 数据库重置完成！"
