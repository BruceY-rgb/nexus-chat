#!/bin/bash

# IP 配置验证脚本
# 用于验证所有配置文件中的 IP 地址是否正确更新为 72.62.252.67

echo "================================================"
echo "🔍 IP 地址配置验证脚本"
echo "================================================"
echo ""

# 设置正确的 IP 地址
CORRECT_IP="72.62.252.67"
OLD_IP="118.31.62.122"

# 计数器
PASS_COUNT=0
FAIL_COUNT=0

# 检查函数
check_file() {
    local file=$1
    local pattern=$2
    local description=$3

    echo -n "检查 $description... "

    if [ ! -f "$file" ]; then
        echo "❌ 文件不存在: $file"
        ((FAIL_COUNT++))
        return 1
    fi

    if grep -q "$CORRECT_IP" "$file"; then
        echo "✅ 正确 (包含 $CORRECT_IP)"
        ((PASS_COUNT++))
        return 0
    elif grep -q "$OLD_IP" "$file"; then
        echo "⚠️  仍使用旧 IP ($OLD_IP)"
        ((FAIL_COUNT++))
        return 1
    else
        echo "⚠️  未找到 IP 地址"
        ((FAIL_COUNT++))
        return 1
    fi
}

# 检查 .env.server
check_file ".env.server" "NEXT_PUBLIC_APP_URL" ".env.server 环境变量"

# 检查 nginx 配置
check_file "nginx/conf.d/default.conf" "server_name" "Nginx 配置文件"

# 检查 docker-compose.dokploy.yml
if [ -f "docker-compose.dokploy.yml" ]; then
    check_file "docker-compose.dokploy.yml" "Host.*72.62.252.67" "Dokploy 配置"
else
    echo "检查 Dokploy 配置... ℹ️  文件不存在 (docker-compose.dokploy.yml)"
fi

echo ""
echo "================================================"
echo "📊 验证结果统计"
echo "================================================"
echo "✅ 通过: $PASS_COUNT"
echo "❌ 失败: $FAIL_COUNT"
echo ""

if [ $FAIL_COUNT -eq 0 ]; then
    echo "🎉 所有检查通过！IP 地址配置正确。"
    echo ""
    echo "下一步操作："
    echo "1. 重启服务: docker-compose restart"
    echo "2. 测试访问: http://72.62.252.67"
    echo "3. 查看调试指南: cat DEBUGGING-GUIDE.md"
    exit 0
else
    echo "⚠️  发现问题！请检查上述失败的项目。"
    echo ""
    echo "解决方案："
    echo "1. 手动更新失败的文件"
    echo "2. 运行: ./scripts/update-ip.sh 72.62.252.67"
    echo "3. 重新构建: npm run build"
    exit 1
fi
