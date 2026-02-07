#!/bin/bash

# =====================================================
# 生产环境数据库修复脚本
# 一键执行数据库表结构补充
# =====================================================

set -e  # 遇到错误立即退出

echo "🚀 开始生产环境数据库修复..."
echo "================================================"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 检查参数
if [ $# -lt 3 ]; then
    echo -e "${YELLOW}使用方法: $0 <host> <username> <database> [port]${NC}"
    echo "示例: $0 localhost yangsmac slack_chat 5432"
    exit 1
fi

HOST=$1
USERNAME=$2
DATABASE=$3
PORT=${4:-5432}

echo -e "${GREEN}📋 连接信息:${NC}"
echo "   Host: $HOST"
echo "   Port: $PORT"
echo "   User: $USERNAME"
echo "   Database: $DATABASE"
echo ""

# 确认操作
read -p "⚠️  确认要继续吗？这将修改生产数据库 (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ 操作已取消"
    exit 1
fi

# 检查数据库连接
echo -e "${YELLOW}🔍 检查数据库连接...${NC}"
if ! PGPASSWORD=$PGPASSWORD psql -h "$HOST" -p "$PORT" -U "$USERNAME" -d "$DATABASE" -c "SELECT 1;" > /dev/null 2>&1; then
    echo -e "${RED}❌ 无法连接到数据库，请检查连接参数${NC}"
    echo "请设置环境变量 PGPASSWORD 或手动输入密码"
    exit 1
fi
echo -e "${GREEN}✅ 数据库连接成功${NC}"
echo ""

# 检查现有表结构
echo -e "${YELLOW}📊 检查现有表结构...${NC}"
EXISTING_TABLES=$(PGPASSWORD=$PGPASSWORD psql -h "$HOST" -p "$PORT" -U "$USERNAME" -d "$DATABASE" -t -c "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE';")

echo "现有表数量: $EXISTING_TABLES"
echo ""

# 备份现有数据（可选）
echo -e "${YELLOW}💾 备份选项:${NC}"
read -p "是否在执行前创建数据库备份? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    BACKUP_FILE="backup-${DATABASE}-$(date +%Y%m%d-%H%M%S).sql"
    echo -e "${YELLOW}正在创建备份: $BACKUP_FILE${NC}"
    if PGPASSWORD=$PGPASSWORD pg_dump -h "$HOST" -p "$PORT" -U "$USERNAME" -d "$DATABASE" > "$BACKUP_FILE"; then
        echo -e "${GREEN}✅ 备份成功: $BACKUP_FILE${NC}"
    else
        echo -e "${RED}❌ 备份失败${NC}"
        read -p "是否继续执行? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
fi
echo ""

# 执行修复脚本
echo -e "${GREEN}🔧 开始执行数据库修复...${NC}"
echo "================================================"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FIX_SCRIPT="$SCRIPT_DIR/fix-missing-tables.sql"

if [ ! -f "$FIX_SCRIPT" ]; then
    echo -e "${RED}❌ 修复脚本不存在: $FIX_SCRIPT${NC}"
    exit 1
fi

# 执行SQL脚本
if PGPASSWORD=$PGPASSWORD psql -h "$HOST" -p "$PORT" -U "$USERNAME" -d "$DATABASE" -f "$FIX_SCRIPT"; then
    echo ""
    echo -e "${GREEN}✅ 数据库修复执行成功！${NC}"
else
    echo ""
    echo -e "${RED}❌ 数据库修复执行失败${NC}"
    exit 1
fi

echo ""
echo "================================================"

# 验证修复结果
echo -e "${YELLOW}🔍 验证修复结果...${NC}"

NEW_TABLE_COUNT=$(PGPASSWORD=$PGPASSWORD psql -h "$HOST" -p "$PORT" -U "$USERNAME" -d "$DATABASE" -t -c "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE';")

echo -e "${GREEN}修复前表数量: $EXISTING_TABLES${NC}"
echo -e "${GREEN}修复后表数量: $NEW_TABLE_COUNT${NC}"

if [ "$NEW_TABLE_COUNT" -gt "$EXISTING_TABLES" ]; then
    echo -e "${GREEN}✅ 成功新增 $((NEW_TABLE_COUNT - EXISTING_TABLES)) 个表${NC}"
else
    echo -e "${YELLOW}⚠️  表数量无变化，可能表已存在${NC}"
fi

echo ""
echo -e "${YELLOW}📊 各表数据统计:${NC}"
PGPASSWORD=$PGPASSWORD psql -h "$HOST" -p "$PORT" -U "$USERNAME" -d "$DATABASE" -c "
SELECT 'users' as table_name, count(*) as count FROM users
UNION ALL
SELECT 'channels', count(*) FROM channels
UNION ALL
SELECT 'messages', count(*) FROM messages
UNION ALL
SELECT 'message_reactions', count(*) FROM message_reactions
ORDER BY table_name;
"

echo ""
echo "================================================"
echo -e "${GREEN}🎉 数据库修复完成！${NC}"
echo ""
echo -e "${YELLOW}下一步操作:${NC}"
echo "1. 检查应用是否能正常连接数据库"
echo "2. 测试新功能（消息表情反应）"
echo "3. 验证所有API端点正常工作"
echo ""

# 清理变量
unset PGPASSWORD

exit 0