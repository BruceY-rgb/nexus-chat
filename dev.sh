#!/bin/bash
# Mac开发环境启动脚本

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}"
echo "=========================================="
echo "🚀 Slack聊天应用 - Mac开发环境启动"
echo "=========================================="
echo -e "${NC}"

# 检查Docker是否运行
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}❌ Docker未运行，请先启动Docker Desktop${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Docker运行正常${NC}"

# 检查.env文件
if [ ! -f .env ]; then
    echo -e "${YELLOW}📋 复制.env模板...${NC}"
    if [ -f .env.production ]; then
        cp .env.production .env
    else
        echo -e "${RED}❌ .env.production文件不存在${NC}"
        exit 1
    fi
    echo -e "${GREEN}✅ 已创建.env文件${NC}"
    echo ""
    echo -e "${YELLOW}⚠️  请编辑.env文件，配置必要的环境变量：${NC}"
    echo -e "${YELLOW}   nano .env${NC}"
    echo ""
    read -p "配置完成后按回车继续..."
fi

# 停止并删除现有容器
echo -e "${YELLOW}🧹 清理现有容器...${NC}"
docker-compose -f docker-compose.dev.yml down || true

# 构建开发环境镜像
echo -e "${YELLOW}🔨 构建开发环境镜像...${NC}"
docker-compose -f docker-compose.dev.yml build

# 启动服务
echo -e "${YELLOW}🚀 启动开发服务...${NC}"
docker-compose -f docker-compose.dev.yml up -d

# 等待数据库准备就绪
echo -e "${YELLOW}⏳ 等待数据库启动...${NC}"
sleep 5

# 运行数据库迁移
echo -e "${YELLOW}🗄️  运行数据库迁移...${NC}"
docker-compose -f docker-compose.dev.yml exec -T app npx prisma migrate deploy || true

# 生成Prisma客户端
echo -e "${YELLOW}🔧 生成Prisma客户端...${NC}"
docker-compose -f docker-compose.dev.yml exec -T app npx prisma generate || true

# 检查服务状态
echo ""
echo -e "${GREEN}✅ 服务启动完成！${NC}"
echo ""
echo -e "${BLUE}📍 访问地址:${NC}"
echo "   应用: http://localhost:3000"
echo "   数据库: localhost:5432"
echo ""
echo -e "${BLUE}🔧 管理命令:${NC}"
echo "   查看日志: docker-compose -f docker-compose.dev.yml logs -f"
echo "   停止服务: docker-compose -f docker-compose.dev.yml down"
echo "   重启服务: docker-compose -f docker-compose.dev.yml restart"
echo "   进入容器: docker-compose -f docker-compose.dev.yml exec app sh"
echo ""
echo -e "${BLUE}📊 容器状态:${NC}"
docker-compose -f docker-compose.dev.yml ps

echo ""
echo -e "${GREEN}💡 提示: 代码修改后会自动热重载${NC}"
