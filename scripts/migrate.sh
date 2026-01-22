#!/bin/bash

# =====================================================
# 数据库迁移脚本
# Slack-like Chat Tool
# =====================================================

set -e

echo "🚀 开始数据库迁移..."

# 检查必要的工具
command -v psql >/dev/null 2>&1 || { echo "❌ PostgreSQL 客户端未安装" >&2; exit 1; }
command -v node >/dev/null 2>&1 || { echo "❌ Node.js 未安装" >&2; exit 1; }
command -v npm >/dev/null 2>&1 || { echo "❌ npm 未安装" >&2; exit 1; }

# 加载环境变量
if [ -f .env ]; then
    echo "📋 加载环境变量..."
    # 安全地加载环境变量，跳过注释和空行
    while IFS= read -r line; do
        # 跳过空行
        [[ -z "$line" ]] && continue
        # 跳过注释行
        [[ "$line" =~ ^[[:space:]]*# ]] && continue
        # 提取变量名和值（去掉行末注释）
        if [[ "$line" =~ ^([A-Za-z_][A-Za-z0-9_]*)=(.*)$ ]]; then
            var_name="${BASH_REMATCH[1]}"
            var_value="${BASH_REMATCH[2]}"
            # 移除行末注释
            var_value=$(echo "$var_value" | sed 's/[[:space:]]*#.*$//')
            # 导出变量
            export "$var_name=$var_value"
        fi
    done < <(grep -v '^#' .env | grep -v '^$' | sed 's/\r$//')
else
    echo "⚠️  未找到 .env 文件，请确保已设置环境变量"
fi

# 检查必要的环境变量
if [ -z "$DATABASE_URL" ]; then
    echo "❌ DATABASE_URL 环境变量未设置"
    exit 1
fi

# 步骤 1: 检查数据库连接
echo ""
echo "🔍 检查数据库连接..."
PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "SELECT 1;" > /dev/null 2>&1
if [ $? -ne 0 ]; then
    echo "❌ 数据库连接失败"
    exit 1
fi
echo "✅ 数据库连接成功"

# 步骤 2: 检查扩展是否存在
echo ""
echo "🔧 检查 PostgreSQL 扩展..."
PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "SELECT extname FROM pg_extension WHERE extname IN ('uuid-ossp', 'pgcrypto', 'unaccent');" > /dev/null 2>&1
if [ $? -ne 0 ]; then
    echo "❌ 扩展检查失败"
    exit 1
fi
echo "✅ PostgreSQL 扩展已安装"

# 步骤 3: 备份现有数据（如果表已存在）
echo ""
echo "💾 备份现有数据（如果存在）..."
BACKUP_FILE="backup_$(date +%Y%m%d_%H%M%S).sql"
PGPASSWORD=$DB_PASSWORD pg_dump -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME --schema-only > "${BACKUP_FILE}_schema.sql" 2>/dev/null || true
PGPASSWORD=$DB_PASSWORD pg_dump -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME --data-only > "${BACKUP_FILE}_data.sql" 2>/dev/null || true
if [ -s "${BACKUP_FILE}_schema.sql" ] || [ -s "${BACKUP_FILE}_data.sql" ]; then
    echo "✅ 数据已备份到 ${BACKUP_FILE}_*.sql"
else
    echo "ℹ️  未发现现有数据，无需备份"
    rm -f "${BACKUP_FILE}_schema.sql" "${BACKUP_FILE}_data.sql"
fi

# 步骤 4: 执行初始化 SQL 脚本
echo ""
echo "📝 执行数据库初始化脚本..."
if [ -f "database/init.sql" ]; then
    PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f "database/init.sql" > /dev/null 2>&1
    if [ $? -eq 0 ]; then
        echo "✅ 数据库初始化成功"
    else
        echo "❌ 数据库初始化失败"
        exit 1
    fi
else
    echo "⚠️  未找到 database/init.sql，跳过初始化"
fi

# 步骤 5: 安装依赖
echo ""
echo "📦 安装 Node.js 依赖..."
npm install

# 步骤 6: 生成 Prisma 客户端
echo ""
echo "🔨 生成 Prisma 客户端..."
npx prisma generate

# 步骤 7: 推送 Prisma Schema 到数据库
echo ""
echo "🚀 推送 Prisma Schema..."
npx prisma db push

# 步骤 8: 验证数据库结构
echo ""
echo "✔️  验证数据库结构..."
TABLE_COUNT=$(PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';" | xargs)
echo "✅ 创建了 $TABLE_COUNT 个表"

# 步骤 9: 创建索引（如果尚未创建）
echo ""
echo "⚡ 检查索引..."
INDEX_COUNT=$(PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "SELECT count(*) FROM pg_indexes WHERE schemaname = 'public';" | xargs)
echo "✅ 发现 $INDEX_COUNT 个索引"

# 步骤 10: 验证初始化数据
echo ""
echo "📊 验证初始化数据..."
USER_COUNT=$(PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "SELECT count(*) FROM users;" | xargs)
CHANNEL_COUNT=$(PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "SELECT count(*) FROM channels;" | xargs)
echo "✅ 创建了 $USER_COUNT 个用户"
echo "✅ 创建了 $CHANNEL_COUNT 个频道"

# 步骤 11: 运行 Prisma Studio（可选）
echo ""
read -p "🔍 是否要打开 Prisma Studio 查看数据？(y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "🌐 启动 Prisma Studio..."
    npx prisma studio
fi

# 完成
echo ""
echo "✨ 数据库迁移完成！"
echo ""
echo "📚 接下来的步骤："
echo "  1. 检查 .env 文件中的数据库配置"
echo "  2. 启动应用程序：npm run dev"
echo "  3. 查看文档：https://your-docs-url.com"
echo ""
echo "🔑 默认管理员账户："
echo "  邮箱：admin@example.com"
echo "  密码：admin123"
echo ""
echo "💡 提示："
echo "  - 使用 'npm run db:reset' 重置数据库"
echo "  - 使用 'npm run db:seed' 重新填充数据"
echo "  - 使用 'npm run db:studio' 打开 Prisma Studio"
echo ""