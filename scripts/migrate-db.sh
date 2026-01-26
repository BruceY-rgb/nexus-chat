#!/bin/bash
# 数据库迁移脚本 - 从本地开发环境迁移到生产环境

set -e

# 颜色输出
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}=========================================="
echo "🗄️  数据库迁移工具"
echo "==========================================${NC}"

# 检查本地数据库连接
echo -e "${YELLOW}📋 检查本地开发环境配置...${NC}"

# 读取.env文件中的本地数据库配置
if [ -f .env ]; then
    source .env
else
    echo -e "${RED}❌ .env文件不存在${NC}"
    exit 1
fi

LOCAL_DB_URL="${DATABASE_URL}"
PROD_DB_URL="postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}?schema=public"

echo -e "${GREEN}✅ 本地数据库URL: $LOCAL_DB_URL${NC}"

# 检查远程数据库连接
echo -e "${YELLOW}🔗 检查生产数据库连接...${NC}"
if docker-compose exec -T db pg_isready -U ${DB_USER} -d ${DB_NAME} &> /dev/null; then
    echo -e "${GREEN}✅ 生产数据库连接正常${NC}"
else
    echo -e "${RED}❌ 生产数据库连接失败，请检查配置${NC}"
    exit 1
fi

echo ""
echo "请选择迁移方式："
echo "1) 导出本地数据并导入到生产环境"
echo "2) 仅在生产环境运行数据库迁移（Prisma）"
echo "3) 重置生产数据库（⚠️  危险操作，会删除所有数据）"
read -p "请输入选择 [1-3]: " choice

case $choice in
    1)
        echo -e "${BLUE}开始数据迁移...${NC}"

        # 导出本地数据
        echo -e "${YELLOW}📤 导出本地数据库...${NC}"
        pg_dump "$LOCAL_DB_URL" > /tmp/local_db_backup.sql

        # 检查导出文件大小
        if [ ! -s /tmp/local_db_backup.sql ]; then
            echo -e "${RED}❌ 数据库导出失败或为空${NC}"
            exit 1
        fi

        echo -e "${GREEN}✅ 本地数据库导出成功${NC}"

        # 备份生产数据库
        echo -e "${YELLOW}💾 备份生产数据库...${NC}"
        BACKUP_FILE="/tmp/prod_db_backup_$(date +%Y%m%d_%H%M%S).sql"
        docker-compose exec -T db pg_dump -U ${DB_USER} -d ${DB_NAME} > "$BACKUP_FILE"
        echo -e "${GREEN}✅ 生产数据库备份完成: $BACKUP_FILE${NC}"

        # 清空生产数据库
        echo -e "${YELLOW}🧹 清空生产数据库...${NC}"
        docker-compose exec -T db psql -U ${DB_USER} -d ${DB_NAME} -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public; GRANT ALL ON SCHEMA public TO ${DB_USER}; GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};" || true

        # 导入本地数据
        echo -e "${YELLOW}📥 导入数据到生产数据库...${NC}"
        cat /tmp/local_db_backup.sql | docker-compose exec -T db psql -U ${DB_USER} -d ${DB_NAME}

        echo -e "${GREEN}✅ 数据迁移完成${NC}"
        ;;
    2)
        echo -e "${BLUE}运行数据库迁移...${NC}"

        # 运行Prisma迁移
        docker-compose exec -T app npx prisma migrate deploy

        echo -e "${GREEN}✅ 数据库迁移完成${NC}"
        ;;
    3)
        echo -e "${RED}⚠️  警告：这将删除生产数据库中的所有数据！${NC}"
        read -p "确认要继续吗？(输入 'yes' 确认): " confirm

        if [ "$confirm" = "yes" ]; then
            echo -e "${YELLOW}🗑️  重置生产数据库...${NC}"
            docker-compose exec -T db psql -U ${DB_USER} -d ${DB_NAME} -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public; GRANT ALL ON SCHEMA public TO ${DB_USER}; GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};"

            echo -e "${GREEN}✅ 数据库已重置${NC}"
        else
            echo -e "${YELLOW}操作已取消${NC}"
        fi
        ;;
    *)
        echo -e "${RED}无效选择${NC}"
        exit 1
        ;;
esac

echo ""
echo -e "${GREEN}🎉 迁移完成！${NC}"
echo -e "${BLUE}📊 检查数据:${NC}"
docker-compose exec -T db psql -U ${DB_USER} -d ${DB_NAME} -c "\dt"

# 清理临时文件
rm -f /tmp/local_db_backup.sql

echo ""
echo -e "${YELLOW}💡 提示: 如果遇到权限问题，请确保用户有正确的数据库权限${NC}"
