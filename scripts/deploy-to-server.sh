#!/bin/bash
# 在Linux服务器上拉取镜像并运行

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}"
echo "=========================================="
echo "🚀 在Linux服务器上部署应用"
echo "=========================================="
echo -e "${NC}"

# 检查参数
if [ $# -ne 2 ]; then
    echo -e "${YELLOW}使用方法: $0 <IMAGE_NAME> <TAG>${NC}"
    echo "例如: $0 your-username/slack-chat latest"
    exit 1
fi

IMAGE_NAME=$1
IMAGE_TAG=$2

echo -e "${BLUE}📦 镜像信息:${NC}"
echo "   名称: $IMAGE_NAME"
echo "   标签: $IMAGE_TAG"
echo ""

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

# 拉取镜像
echo -e "${YELLOW}📥 从Docker Hub拉取镜像...${NC}"
docker pull $IMAGE_NAME:$IMAGE_TAG

# 创建项目目录
echo -e "${YELLOW}📁 创建项目目录...${NC}"
mkdir -p ~/slack-chat-deploy
cd ~/slack-chat-deploy

# 下载docker-compose.yml
echo -e "${YELLOW}📄 下载docker-compose.yml...${NC}"
curl -O https://raw.githubusercontent.com/your-username/slack-chat/main/docker-compose.server.yml

# 创建.env文件
echo -e "${YELLOW}📝 创建.env文件...${NC}"
cat > .env << 'EOF'
# 生产环境配置
# 请根据实际情况修改

DB_USER=yangsmac
DB_PASSWORD=your_secure_password_here
DB_NAME=slack_chat

JWT_SECRET=your-super-secret-jwt-key-minimum-32-characters-long
JWT_EXPIRES_IN=7d

RESEND_API_KEY=re_your_resend_api_key
EMAIL_FROM="Slack聊天应用 <onboarding@resend.dev>"
EMAIL_REPLY_TO=onboarding@resend.dev
APP_NAME=Slack聊天应用

SESSION_SECRET=your-super-secret-session-key-minimum-32-characters-long

OSS_REGION=oss-cn-hangzhou
OSS_ACCESS_KEY_ID=your_oss_access_key_id
OSS_ACCESS_KEY_SECRET=your_oss_access_key_secret
OSS_BUCKET=q-and-a-chatbot
OSS_ENDPOINT=https://oss-cn-hangzhou.aliyuncs.com

NODE_ENV=production
NEXT_PUBLIC_APP_URL=https://instagram.rlenv.data4o.ai
WEBSOCKET_PORT=3001

ENABLE_FILE_UPLOAD=true
ENABLE_SEARCH=true
ENABLE_NOTIFICATIONS=true
ENABLE_EMAIL_NOTIFICATIONS=false

MAX_FILE_SIZE=10485760
ALLOWED_FILE_TYPES=image/jpeg,image/png,image/gif,image/webp,application/pdf,text/plain

RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

LOG_LEVEL=info
LOG_FORMAT=dev
EOF

echo -e "${YELLOW}⚠️  请编辑.env文件，配置所有必需的环境变量：${NC}"
echo -e "${YELLOW}   nano .env${NC}"
read -p "配置完成后按回车继续..."

# 修改docker-compose.yml中的镜像
echo -e "${YELLOW}🔧 修改docker-compose.yml中的镜像...${NC}"
sed -i "s|IMAGE_PLACEHOLDER|$IMAGE_NAME:$IMAGE_TAG|g" docker-compose.server.yml

# 创建必要目录
echo -e "${YELLOW}📁 创建必要目录...${NC}"
mkdir -p nginx/conf.d ssl db

# 停止现有容器
echo -e "${YELLOW}⏹️  停止现有容器...${NC}"
docker-compose down || true

# 启动服务
echo -e "${YELLOW}🚀 启动服务...${NC}"
docker-compose up -d

# 等待服务启动
echo -e "${YELLOW}⏳ 等待服务启动...${NC}"
sleep 10

# 运行数据库迁移
echo -e "${YELLOW}🗄️  运行数据库迁移...${NC}"
docker-compose exec -T app npx prisma migrate deploy || true

# 检查服务状态
echo -e "${YELLOW}🔍 检查服务状态...${NC}"
docker-compose ps

echo ""
echo -e "${GREEN}=========================================="
echo "🎉 部署完成！"
echo "=========================================="
echo -e "${NC}"
echo -e "${BLUE}📍 服务地址:${NC}"
echo "   应用: http://localhost:3000"
echo "   数据库: localhost:5432"
echo ""
echo -e "${YELLOW}⚠️  重要提醒:${NC}"
echo "1. 配置域名解析: instagram.rlenv.data4o.ai -> 服务器IP"
echo "2. 运行SSL证书配置: sudo bash scripts/init-ssl.sh"
echo "3. 防火墙开放端口: 80, 443"
echo ""
