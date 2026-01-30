#!/bin/bash
# =====================================================
# 一键推送到服务器脚本
# 适用于：Docker已构建完成，只需上传到服务器
# =====================================================

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m'

print_message() {
    echo -e "${2}${1}${NC}"
}

show_header() {
    clear
    print_message "========================================" "$BLUE"
    print_message "🚀 推送应用到服务器" "$BLUE"
    print_message "========================================" "$BLUE"
    echo ""
}

# 服务器配置
SERVER_IP="72.62.252.67"
# ❗ 需要确认正确的用户名（通常为 root 或 ubuntu）
SERVER_USER="root"
PROJECT_PATH="/Users/yangsmac/Desktop/Slack/slack-chat"

# 检查参数
check_params() {
    if [ $# -eq 0 ]; then
        print_message "❌ 请提供 Docker Hub 用户名" "$RED"
        print_message "💡 用法: ./push-to-server.sh <your-dockerhub-username>" "$BLUE"
        print_message "💡 示例: ./push-to-server.sh yourname" "$BLUE"
        exit 1
    fi

    DOCKERHUB_USER=$1
    IMAGE_NAME="$DOCKERHUB_USER/slack-chat"
    print_message "📋 部署配置:" "$PURPLE"
    echo "   服务器: $SERVER_USER@$SERVER_IP"
    echo "   镜像名: $IMAGE_NAME:latest"
    echo ""
}

# 验证服务器连接
test_connection() {
    print_message "🔍 测试服务器连接..." "$YELLOW"

    # 测试IP连通性
    if ! ping -c 2 "$SERVER_IP" > /dev/null 2>&1; then
        print_message "❌ 无法连接到服务器 $SERVER_IP" "$RED"
        print_message "💡 请检查:" "$BLUE"
        print_message "   1. 服务器IP是否正确" "$CYAN"
        print_message "   2. 服务器是否开机" "$CYAN"
        print_message "   3. 网络是否正常" "$CYAN"
        exit 1
    fi

    print_message "✅ 服务器连接正常" "$GREEN"
    echo ""

    # 测试SSH连接（不执行命令）
    print_message "🔑 测试SSH认证..." "$YELLOW"
    if ! ssh -o ConnectTimeout=5 -o BatchMode=yes "$SERVER_USER@$SERVER_IP" echo "SSH连接成功" > /dev/null 2>&1; then
        print_message "⚠️  SSH密钥认证失败" "$YELLOW"
        print_message "💡 将尝试密码认证..." "$CYAN"
        echo ""
        read -p "请输入服务器密码: " -s SERVER_PASSWORD
        echo ""
    else
        print_message "✅ SSH密钥认证成功" "$GREEN"
        echo ""
    fi
}

# 检查本地Docker镜像
check_local_image() {
    print_message "🔍 检查本地Docker镜像..." "$YELLOW"

    if docker images slack-chat-app > /dev/null 2>&1; then
        print_message "✅ 找到本地镜像" "$GREEN"
        docker images | grep slack-chat-app
    elif docker images | grep "slack-chat" > /dev/null 2>&1; then
        print_message "✅ 找到相关镜像" "$GREEN"
        docker images | grep slack-chat
    else
        print_message "❌ 未找到Docker镜像" "$RED"
        print_message "💡 请先构建镜像: ./build.sh" "$BLUE"
        exit 1
    fi
    echo ""
}

# 推送镜像到Docker Hub
push_image() {
    print_message "📤 推送镜像到Docker Hub..." "$YELLOW"
    echo ""

    # 检查是否登录
    if ! docker info | grep -q "Username:"; then
        print_message "🔑 请登录Docker Hub..." "$YELLOW"
        docker login
    fi

    # 打标签
    print_message "🏷️  标记镜像..." "$CYAN"
    docker tag slack-chat-app:latest "$IMAGE_NAME:latest"
    docker tag slack-chat-app:latest "$IMAGE_NAME:$(date +%Y%m%d)"

    # 推送
    print_message "⬆️  推送镜像..." "$CYAN"
    docker push "$IMAGE_NAME:latest"
    docker push "$IMAGE_NAME:$(date +%Y%m%d)"

    print_message "✅ 镜像推送完成" "$GREEN"
    echo ""
}

# 上传项目文件
upload_project() {
    print_message "📤 上传项目文件到服务器..." "$YELLOW"

    # 创建部署包
    print_message "   创建部署包..." "$CYAN"
    cd "$PROJECT_PATH"
    tar -czf /tmp/slack-chat-deploy.tar.gz \
        --exclude='node_modules' \
        --exclude='.next' \
        --exclude='dist' \
        --exclude='*.log' \
        --exclude='.git' \
        .

    # 上传文件
    print_message "   上传部署包..." "$CYAN"
    scp /tmp/slack-chat-deploy.tar.gz "$SERVER_USER@$SERVER_IP:/tmp/"

    print_message "✅ 项目文件上传完成" "$GREEN"
    echo ""
}

# 在服务器上部署
deploy_on_server() {
    print_message "🚀 在服务器上部署应用..." "$YELLOW"
    echo ""

    # SSH命令
    SSH_CMD="ssh $SERVER_USER@$SERVER_IP"

    # 如果有密码，使用sshpass
    if [ -n "$SERVER_PASSWORD" ]; then
        SSH_CMD="sshpass -p '$SERVER_PASSWORD' ssh -o StrictHostKeyChecking=no $SERVER_USER@$SERVER_IP"
    fi

    # 在服务器上执行部署
    $SSH_CMD << 'EOF'
# 解压项目
echo "📦 解压项目文件..."
cd /tmp
tar -xzf slack-chat-deploy.tar.gz
sudo mv slack-chat /opt/
cd /opt/slack-chat

# 安装Docker（如果未安装）
echo "🐳 检查Docker..."
if ! command -v docker > /dev/null 2>&1; then
    echo "📦 安装Docker..."
    curl -fsSL https://get.docker.com | sudo sh
    sudo usermod -aG docker $USER
fi

# 停止现有容器
echo "🧹 停止现有容器..."
sudo docker-compose down --remove-orphans 2>/dev/null || true

# 拉取镜像
echo "📥 拉取最新镜像..."
sudo docker pull DOCKERHUB_USER/slack-chat:latest

# 更新docker-compose.yml
echo "⚙️  更新配置..."
sed -i.bak "s|image: .*|image: DOCKERHUB_USER/slack-chat:latest|g" docker-compose.yml

# 启动服务
echo "🚀 启动服务..."
sudo docker-compose up -d

# 等待数据库
echo "⏳ 等待数据库..."
timeout=60
while [ $timeout -gt 0 ]; do
    if sudo docker-compose exec -T db pg_isready -U yangsmac > /dev/null 2>&1; then
        break
    fi
    sleep 2
    timeout=$((timeout - 2))
done

# 运行迁移
echo "🗄️  运行数据库迁移..."
sudo docker-compose exec -T app npx prisma migrate deploy || sudo docker-compose exec -T app npx prisma migrate dev --name init || true

echo ""
echo "✅ 部署完成！"
echo ""
echo "📍 访问地址:"
echo "   应用: http://localhost:3000"
echo "   域名: https://instagram.rlenv.data4o.ai (需要配置Nginx)"
echo ""
echo "🔧 管理命令:"
echo "   查看状态: sudo docker-compose ps"
echo "   查看日志: sudo docker-compose logs -f app"
echo "   停止服务: sudo docker-compose down"
echo "   重启服务: sudo docker-compose restart"
echo ""

EOF

    # 替换变量
    $SSH_CMD "sed -i 's/DOCKERHUB_USER/$DOCKERHUB_USER/g' /tmp/deploy-commands.sh"
}

# 显示完成信息
show_completion() {
    echo ""
    print_message "========================================" "$GREEN"
    print_message "✅ 推送到服务器完成！" "$GREEN"
    print_message "========================================" "$GREEN"
    echo ""

    print_message "📍 访问信息:" "$BLUE"
    echo "   服务器: $SERVER_IP"
    echo "   应用: http://$SERVER_IP:3000"
    echo "   域名: https://instagram.rlenv.data4o.ai"
    echo ""

    print_message "🔧 服务器管理命令:" "$BLUE"
    echo "   登录服务器: ssh $SERVER_USER@$SERVER_IP"
    echo "   查看状态: sudo docker-compose -f /opt/slack-chat/docker-compose.yml ps"
    echo "   查看日志: sudo docker-compose -f /opt/slack-chat/docker-compose.yml logs -f app"
    echo "   重启应用: sudo docker-compose -f /opt/slack-chat/docker-compose.yml restart"
    echo ""
}

# 主函数
main() {
    show_header

    check_params "$@"
    test_connection
    check_local_image
    push_image
    upload_project
    deploy_on_server

    show_completion
}

# 显示帮助
if [ "$1" == "-h" ] || [ "$1" == "--help" ]; then
    echo ""
    echo "用法: $0 <dockerhub-username>"
    echo ""
    echo "示例:"
    echo "  $0 yourname          # 推送镜像到 yourname/slack-chat"
    echo ""
    echo "前置条件:"
    echo "  1. 本地Docker镜像已构建完成"
    echo "  2. 已登录Docker Hub (docker login)"
    echo "  3. 服务器SSH访问权限"
    echo ""
    exit 0
fi

# 执行主函数
main "$@"
