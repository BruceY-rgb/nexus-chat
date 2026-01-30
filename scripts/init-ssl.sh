#!/bin/bash
# SSL证书自动配置脚本
# 使用Let's Encrypt免费SSL证书

set -e

echo "🔒 开始配置SSL证书..."

# 检查域名是否解析到当前服务器IP
DOMAIN="instagram.rlenv.data4o.ai"
SERVER_IP=$(curl -s ifconfig.me)

echo "📍 当前服务器IP: $SERVER_IP"
echo "🌐 请确保域名 $DOMAIN 已解析到此IP"
echo ""
read -p "确认域名已解析后按回车继续..."

# 创建SSL目录
mkdir -p ssl

# 安装certbot（如果未安装）
if ! command -v certbot &> /dev/null; then
    echo "📦 安装Certbot..."
    if [ -f /etc/debian_version ]; then
        apt-get update
        apt-get install -y certbot python3-certbot-nginx
    elif [ -f /etc/redhat-release ]; then
        yum install -y certbot python3-certbot-nginx
    fi
fi

# 停止nginx容器（如果正在运行）
echo "⏹️  停止Nginx容器..."
docker-compose stop nginx || true

# 临时启动一个简单的HTTP服务器来验证域名
echo "🚀 启动临时HTTP服务器验证域名..."
docker run --rm -d -p 80:80 --name temp-nginx -v $(pwd)/nginx/nginx.conf:/etc/nginx/nginx.conf nginx:alpine || true
sleep 3

# 申请SSL证书
echo "📜 申请Let's Encrypt证书..."
certbot certonly \
    --standalone \
    --preferred-challenges http \
    --email admin@rlenv.data4o.ai \
    --agree-tos \
    --no-eff-email \
    -d $DOMAIN

# 复制证书到项目目录
echo "📂 复制证书文件..."
cp /etc/letsencrypt/live/$DOMAIN/fullchain.pem ssl/
cp /etc/letsencrypt/live/$DOMAIN/privkey.pem ssl/

# 设置证书权限
chmod 600 ssl/*.pem

# 创建证书续期脚本
cat > ssl/renew-ssl.sh << 'EOF'
#!/bin/bash
# SSL证书续期脚本

DOMAIN="instagram.rlenv.data4o.ai"

# 停止nginx
docker-compose stop nginx

# 续期证书
certbot renew --quiet

# 复制新证书
cp /etc/letsencrypt/live/$DOMAIN/fullchain.pem $(dirname $0)/../ssl/
cp /etc/letsencrypt/live/$DOMAIN/privkey.pem $(dirname $0)/../ssl/

# 设置权限
chmod 600 $(dirname $0)/../ssl/*.pem

# 重启nginx
docker-compose start nginx

echo "✅ SSL证书已更新"
EOF

chmod +x ssl/renew-ssl.sh

# 停止临时容器
docker stop temp-nginx || true

# 添加crontab任务（每天检查续期）
(crontab -l 2>/dev/null; echo "0 12 * * * $(pwd)/ssl/renew-ssl.sh >> /var/log/ssl-renew.log 2>&1") | crontab -

# 启动所有服务
echo "🚀 启动所有服务..."
docker-compose up -d

echo ""
echo "✅ SSL证书配置完成！"
echo "📝 证书位置: ./ssl/"
echo "🔄 自动续期: 已设置crontab任务"
echo "🌐 访问地址: https://instagram.rlenv.data4o.ai"
echo ""
echo "📌 手动续期命令: ./ssl/renew-ssl.sh"
