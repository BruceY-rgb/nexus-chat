#!/bin/bash
# 在Mac上构建生产镜像并推送到Docker Hub

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}"
echo "=========================================="
echo "🏗️  构建生产镜像 - Mac平台"
echo "=========================================="
echo -e "${NC}"

# 检查Docker Desktop是否运行
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}❌ Docker未运行，请先启动Docker Desktop${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Docker运行正常${NC}"

# 询问Docker Hub用户名
read -p "请输入Docker Hub用户名: " DOCKER_USERNAME

if [ -z "$DOCKER_USERNAME" ]; then
    echo -e "${RED}❌ 用户名不能为空${NC}"
    exit 1
fi

# 读取.env.production文件
if [ ! -f .env.production ]; then
    echo -e "${RED}❌ .env.production文件不存在${NC}"
    exit 1
fi

# 提取镜像名称和标签
IMAGE_NAME="$DOCKER_USERNAME/slack-chat"
IMAGE_TAG="latest"

echo ""
echo -e "${BLUE}📦 镜像信息:${NC}"
echo "   名称: $IMAGE_NAME"
echo "   标签: $IMAGE_TAG"
echo ""

# 登录Docker Hub
echo -e "${YELLOW}🔐 登录Docker Hub...${NC}"
docker login

# 构建生产镜像
echo -e "${YELLOW}🔨 构建生产镜像...${NC}"
docker build -t $IMAGE_NAME:$IMAGE_TAG .

# 推送到Docker Hub
echo -e "${YELLOW}📤 推送到Docker Hub...${NC}"
docker push $IMAGE_NAME:$IMAGE_TAG

echo -e "${GREEN}✅ 镜像推送完成！${NC}"

echo ""
echo -e "${BLUE}📋 下一步操作:${NC}"
echo "1. 在Linux服务器上运行: ./scripts/deploy-to-server.sh $IMAGE_NAME $IMAGE_TAG"
echo "2. 或者手动拉取镜像:"
echo "   docker pull $IMAGE_NAME:$IMAGE_TAG"
echo ""
echo -e "${YELLOW}💡 提示: 请确保服务器已安装Docker和Docker Compose${NC}"
