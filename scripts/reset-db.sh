#!/bin/bash

# =====================================================
# 数据库重置脚本
# 警告：这将删除所有数据！
# =====================================================

set -e

echo "⚠️  警告：这将删除所有数据！"
read -p "确定要继续吗？(y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ 操作已取消"
    exit 0
fi

echo ""
echo "🗑️  开始重置数据库..."

# 加载环境变量
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

# 删除所有表
echo "📋 删除所有表..."
PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;" > /dev/null 2>&1

# 重新运行迁移
echo "🚀 重新运行迁移..."
bash scripts/migrate.sh