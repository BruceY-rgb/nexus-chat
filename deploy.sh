#!/bin/bash
# Slack聊天应用 - 一键部署脚本
# 部署到阿里云服务器

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}"
echo "=========================================="
echo "🚀 Slack聊天应用 - 一键部署脚本"
echo "=========================================="
echo -e "${NC}"

# 检查是否为root用户
if [ "$EUID" -eq 0 ]; then
    echo -e "${RED}❌ 请不要使用root用户运行此脚本${NC}"
    exit 1
fi

# 检查Docker是否安装
if ! command -v docker &> /dev/null; then
    echo -e "${YELLOW}📦 Docker未安装，开始安装...${NC}"
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    sudo usermod -aG docker $USER
    echo -e "${GREEN}✅ Docker安装完成，请重新登录后运行此脚本${NC}"
    exit 1
fi

# 检查Docker Compose是否安装
if ! command -v docker-compose &> /dev/null; then
    echo -e "${YELLOW}📦 Docker Compose未安装，开始安装...${NC}"
    sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
    echo -e "${GREEN}✅ Docker Compose安装完成${NC}"
fi

echo -e "${GREEN}✅ Docker环境检查通过${NC}"

# 检查.env.production文件
if [ ! -f .env.production ]; then
    echo -e "${RED}❌ .env.production文件不存在${NC}"
    echo "请复制.env.production模板并配置环境变量："
    echo "cp .env.production .env.production.bak"
    echo "nano .env.production"
    exit 1
fi

echo -e "${GREEN}✅ 环境配置文件检查通过${NC}"

# 复制生产环境配置
if [ ! -f .env ]; then
    echo -e "${YELLOW}📋 复制生产环境配置...${NC}"
    cp .env.production .env
    echo -e "${GREEN}✅ 已复制.env.production到.env${NC}"
    echo ""
    echo -e "${YELLOW}⚠️  请编辑.env文件，配置所有必需的环境变量：${NC}"
    echo -e "${YELLOW}   nano .env${NC}"
    echo ""
    read -p "配置完成后按回车继续..."
fi

# 创建必要目录
echo -e "${YELLOW}📁 创建必要目录...${NC}"
mkdir -p nginx/conf.d ssl db

# 停止现有容器
echo -e "${YELLOW}⏹️  停止现有容器...${NC}"
docker-compose down || true

# 清理旧镜像
echo -e "${YELLOW}🧹 清理旧镜像...${NC}"
docker-compose down --rmi all --volumes --remove-orphans || true

# 构建并启动服务
echo -e "${YELLOW}🔨 构建应用镜像...${NC}"
docker-compose build --no-cache

echo -e "${YELLOW}🚀 启动服务...${NC}"
docker-compose up -d

# 等待服务启动
echo -e "${YELLOW}⏳ 等待服务启动...${NC}"
sleep 10

# 检查服务状态
echo -e "${YELLOW}🔍 检查服务状态...${NC}"
docker-compose ps

# 运行数据库迁移
echo -e "${YELLOW}🗄️  运行数据库迁移...${NC}"
docker-compose exec -T app npx prisma migrate deploy || true

# 生成Prisma客户端
echo -e "${YELLOW}🔧 生成Prisma客户端...${NC}"
docker-compose exec -T app npx prisma generate || true

# 检查应用健康状态
echo -e "${YELLOW}💓 检查应用健康状态...${NC}"
sleep 5
if curl -f http://localhost:3000/api/health &> /dev/null; then
    echo -e "${GREEN}✅ 应用运行正常${NC}"
else
    echo -e "${YELLOW}⚠️  应用可能仍在启动中，请稍后访问${NC}"
fi

# 显示日志
echo ""
echo -e "${BLUE}📜 应用日志（最近50行）:${NC}"
docker-compose logs --tail=50 app

echo ""
echo -e "${GREEN}=========================================="
echo "🎉 部署完成！"
echo "=========================================="
echo -e "${NC}"
echo -e "${BLUE}📍 服务地址:${NC}"
echo "   应用: http://localhost:3000"
echo "   数据库: localhost:5432"
echo ""
echo -e "${BLUE}🔧 管理命令:${NC}"
echo "   查看日志: docker-compose logs -f"
echo "   停止服务: docker-compose down"
echo "   重启服务: docker-compose restart"
echo "   更新应用: ./deploy.sh"
echo ""
echo -e "${BLUE}📊 容器状态:${NC}"
docker-compose ps

echo ""
echo -e "${YELLOW}⚠️  重要提醒:${NC}"
echo "1. 配置域名解析: www.ontuotu.com -> 服务器IP"
echo "2. 运行SSL证书配置: sudo bash scripts/init-ssl.sh"
echo "3. 防火墙开放端口: 80, 443"
echo ""
