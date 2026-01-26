#!/bin/sh

# Docker 启动时自动执行数据库迁移
echo "🚀 启动时执行数据库迁移..."

# 等待数据库就绪
echo "⏳ 等待数据库连接..."
sleep 5

# 生成 Prisma 客户端
echo "🔨 生成 Prisma 客户端..."
npx prisma generate

# 执行数据库迁移
echo "📦 执行数据库迁移..."
npx prisma migrate deploy

echo "✅ 迁移完成，启动应用..."
exec "$@"
