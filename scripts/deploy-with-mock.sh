#!/bin/bash

# =====================================================
# 自动化部署脚本 - 带Mock数据
# 用于部署Slack-like聊天应用到生产环境并填充测试数据
# =====================================================

set -e

echo "🚀 开始部署流程..."

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 函数：打印带颜色的消息
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查环境变量
print_status "检查环境配置..."
if [ ! -f ".env.production" ]; then
    print_error "未找到 .env.production 文件"
    exit 1
fi

# 检查Docker是否安装
if ! command -v docker &> /dev/null; then
    print_error "Docker 未安装，请先安装 Docker"
    exit 1
fi

# 检查Docker Compose是否安装
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    print_error "Docker Compose 未安装，请先安装 Docker Compose"
    exit 1
fi

print_status "环境检查完成 ✓"

# 构建Docker镜像
print_status "构建Docker镜像..."
docker-compose -f docker-compose.dokploy.yml build --no-cache
print_status "镜像构建完成 ✓"

# 停止现有容器
print_status "停止现有容器..."
docker-compose -f docker-compose.dokploy.yml down || true
print_status "容器已停止 ✓"

# 启动数据库和应用服务
print_status "启动服务..."
docker-compose -f docker-compose.dokploy.yml up -d db
print_status "等待数据库启动..."
sleep 10

# 检查数据库连接
print_status "检查数据库连接..."
for i in {1..30}; do
    if docker-compose -f docker-compose.dokploy.yml exec -T db pg_isready -U ${DB_USER:-dokploy} > /dev/null 2>&1; then
        print_status "数据库连接成功 ✓"
        break
    fi
    if [ $i -eq 30 ]; then
        print_error "数据库连接超时"
        exit 1
    fi
    echo -n "."
    sleep 2
done

# 生成Prisma客户端
print_status "生成Prisma客户端..."
docker-compose -f docker-compose.dokploy.yml run --rm app npx prisma generate
print_status "Prisma客户端生成完成 ✓"

# 运行数据库迁移
print_status "运行数据库迁移..."
docker-compose -f docker-compose.dokploy.yml run --rm app npx prisma migrate deploy
print_status "数据库迁移完成 ✓"

# 填充Mock数据
print_status "开始填充Mock数据..."
docker-compose -f docker-compose.dokploy.yml run --rm app npm run db:seed
if [ $? -eq 0 ]; then
    print_status "Mock数据填充完成 ✓"
else
    print_warning "使用增强版Mock数据脚本..."
    docker-compose -f docker-compose.dokploy.yml run --rm app tsx scripts/seed-enhanced.ts
    print_status "增强版Mock数据填充完成 ✓"
fi

# 启动应用服务
print_status "启动应用服务..."
docker-compose -f docker-compose.dokploy.yml up -d app

# 等待应用启动
print_status "等待应用启动..."
sleep 5

# 检查应用健康状态
print_status "检查应用健康状态..."
for i in {1..30}; do
    if curl -f http://localhost:3000/api/health > /dev/null 2>&1; then
        print_status "应用启动成功 ✓"
        break
    fi
    if [ $i -eq 30 ]; then
        print_error "应用启动失败"
        docker-compose -f docker-compose.dokploy.yml logs app
        exit 1
    fi
    echo -n "."
    sleep 2
done

# 显示部署结果
print_status "部署完成！"
echo ""
echo "=========================================="
echo "📊 部署信息:"
echo "=========================================="
echo "应用地址: http://localhost:3000"
echo "WebSocket端口: 3001"
echo ""
echo "🔑 测试账户:"
echo "管理员: admin@chat.com / admin123"
echo "Alice: alice@chat.com / password123"
echo "Bob: bob@chat.com / password123"
echo "Charlie: charlie@chat.com / password123"
echo "Diana: diana@chat.com / password123"
echo ""
echo "📢 可用频道:"
echo "- #general (公共)"
echo "- #random (公共)"
echo "- #announcements (公共)"
echo "- #development (公共)"
echo "- #design (公共)"
echo "- #marketing (公共)"
echo "- #sales (公共)"
echo "- #hr (私有)"
echo "- #finance (私有)"
echo ""
echo "=========================================="
echo "📝 管理命令:"
echo "=========================================="
echo "查看日志: docker-compose -f docker-compose.dokploy.yml logs -f app"
echo "停止服务: docker-compose -f docker-compose.dokploy.yml down"
echo "重启服务: docker-compose -f docker-compose.dokploy.yml restart"
echo "重新填充数据: docker-compose -f docker-compose.dokploy.yml run --rm app tsx scripts/seed-enhanced.ts"
echo ""
echo "=========================================="
